import { IS_CLOUD } from "../../../lib/const";

export type OverviewBlockWidth = "half" | "full";

export interface OverviewLayoutBlock {
  id: string;
  width: OverviewBlockWidth;
  hidden?: boolean;
  /** Ordered pane (tab) ids for tabbed blocks; absent on standalone blocks and legacy saves. */
  panes?: string[];
}

export const OVERVIEW_BLOCK_IDS = [
  "referrers",
  "pages",
  "devices",
  "countries",
  "events",
  "weekdays",
  "search-console",
] as const;

export type OverviewBlockId = (typeof OVERVIEW_BLOCK_IDS)[number];

// Blocks with bespoke, tab-less cards. Everything else is a container of panes,
// and containers can be created dynamically (e.g. splitting UTM into its own block).
export const STANDALONE_BLOCK_IDS: OverviewBlockId[] = ["weekdays", "search-console"];

// Every movable tab, mapped to the block it lives in by default.
// Insertion order defines the default tab order within each block.
export const OVERVIEW_PANE_HOMES = {
  referrers: "referrers",
  channels: "referrers",
  utm: "referrers",
  pages: "pages",
  page_title: "pages",
  entry_pages: "pages",
  exit_pages: "pages",
  hostname: "pages",
  browsers: "devices",
  devices: "devices",
  os: "devices",
  dimensions: "devices",
  countries: "countries",
  regions: "countries",
  cities: "countries",
  languages: "countries",
  map: "countries",
  timezones: "countries",
  events: "events",
  outbound: "events",
  buttons: "events",
  forms: "events",
  copies: "events",
} as const satisfies Record<string, OverviewBlockId>;

export type OverviewPaneId = keyof typeof OVERVIEW_PANE_HOMES;

export const OVERVIEW_PANE_IDS = Object.keys(OVERVIEW_PANE_HOMES) as OverviewPaneId[];

export function isOverviewPaneId(id: string): id is OverviewPaneId {
  return id in OVERVIEW_PANE_HOMES;
}

export function isStandaloneBlock(id: string): boolean {
  return STANDALONE_BLOCK_IDS.includes(id as OverviewBlockId);
}

/** Generate an id for a dynamically created block that doesn't collide with existing ones. */
export function makeBlockId(pane: string, taken: Set<string>): string {
  let id = `block-${pane}`;
  let n = 2;
  while (taken.has(id)) id = `block-${pane}-${n++}`;
  return id;
}

export function getDefaultPanes(blockId: string): OverviewPaneId[] {
  return OVERVIEW_PANE_IDS.filter(pane => OVERVIEW_PANE_HOMES[pane] === blockId);
}

// Search Console is cloud-only; every other block is always available.
export function getAvailableBlockIds(): OverviewBlockId[] {
  return OVERVIEW_BLOCK_IDS.filter(id => id !== "search-console" || IS_CLOUD);
}

export const DEFAULT_OVERVIEW_LAYOUT: OverviewLayoutBlock[] = OVERVIEW_BLOCK_IDS.map(id => ({
  id,
  width: "half",
  ...(isStandaloneBlock(id) ? {} : { panes: getDefaultPanes(id) }),
}));

/**
 * Turn a saved layout into a renderable one:
 * - drop blocks and panes that no longer exist (or aren't available here),
 * - fill panes on legacy saves that predate per-tab layouts,
 * - drop duplicate panes (first occurrence wins),
 * - re-home panes the save doesn't mention so new tabs still show up,
 * - append standalone blocks the save predates,
 * - drop tabbed blocks whose tabs have all been moved elsewhere.
 */
export function normalizeOverviewLayout(saved: OverviewLayoutBlock[] | null | undefined): OverviewLayoutBlock[] {
  const available = getAvailableBlockIds();
  const source = saved?.length ? saved : DEFAULT_OVERVIEW_LAYOUT;

  const seenPanes = new Set<string>();
  const blocks: OverviewLayoutBlock[] = source
    .filter(b => !isStandaloneBlock(b.id) || available.includes(b.id as OverviewBlockId))
    .map(b => {
      if (isStandaloneBlock(b.id)) {
        return { id: b.id, width: b.width, ...(b.hidden ? { hidden: true } : {}) };
      }
      // Legacy saves predate per-tab layouts: blocks named after a default
      // container get its default panes; anything else keeps what it lists.
      const rawPanes = b.panes ?? (getDefaultPanes(b.id).length ? getDefaultPanes(b.id) : []);
      const panes = rawPanes.filter(p => isOverviewPaneId(p) && !seenPanes.has(p));
      panes.forEach(p => seenPanes.add(p));
      return { id: b.id, width: b.width, ...(b.hidden ? { hidden: true } : {}), panes };
    });

  // A pane assigned nowhere is one this save predates (removed panes still live
  // in hidden blocks): append it to its home block, creating it if needed.
  for (const pane of OVERVIEW_PANE_IDS) {
    if (seenPanes.has(pane)) continue;
    const home = OVERVIEW_PANE_HOMES[pane];
    let block = blocks.find(b => b.id === home && !isStandaloneBlock(b.id));
    if (!block) {
      block = { id: home, width: "half", panes: [] };
      blocks.push(block);
    }
    block.panes = [...(block.panes ?? []), pane];
    seenPanes.add(pane);
  }

  for (const id of available) {
    if (isStandaloneBlock(id) && !blocks.some(b => b.id === id)) {
      blocks.push({ id, width: "half" });
    }
  }

  return blocks.filter(b => isStandaloneBlock(b.id) || (b.panes?.length ?? 0) > 0);
}

function panesEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b) return !a === !b;
  return a.length === b.length && a.every((pane, i) => pane === b[i]);
}

export function layoutsEqual(a: OverviewLayoutBlock[], b: OverviewLayoutBlock[]): boolean {
  return (
    a.length === b.length &&
    a.every((block, i) => {
      const other = b[i];
      return (
        block.id === other.id &&
        block.width === other.width &&
        !block.hidden === !other.hidden &&
        panesEqual(block.panes, other.panes)
      );
    })
  );
}
