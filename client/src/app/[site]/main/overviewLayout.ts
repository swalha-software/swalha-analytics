import { IS_CLOUD } from "../../../lib/const";

export type OverviewBlockWidth = "half" | "full";

export interface OverviewLayoutBlock {
  id: string;
  width: OverviewBlockWidth;
  hidden?: boolean;
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

// Search Console is cloud-only; every other block is always available.
export function getAvailableBlockIds(): OverviewBlockId[] {
  return OVERVIEW_BLOCK_IDS.filter(id => id !== "search-console" || IS_CLOUD);
}

export const DEFAULT_OVERVIEW_LAYOUT: OverviewLayoutBlock[] = OVERVIEW_BLOCK_IDS.map(id => ({
  id,
  width: "half",
}));

/**
 * Turn a saved layout into a renderable one: drop blocks that no longer exist
 * (or aren't available in this deployment), and append any block the save
 * predates so new sections still show up for old layouts.
 */
export function normalizeOverviewLayout(saved: OverviewLayoutBlock[] | null | undefined): OverviewLayoutBlock[] {
  const available = getAvailableBlockIds();
  if (!saved?.length) {
    return DEFAULT_OVERVIEW_LAYOUT.filter(b => available.includes(b.id as OverviewBlockId));
  }

  const known = saved.filter(b => available.includes(b.id as OverviewBlockId));
  const seen = new Set(known.map(b => b.id));
  const missing = available.filter(id => !seen.has(id)).map(id => ({ id, width: "half" as const }));
  return [...known, ...missing];
}

export function layoutsEqual(a: OverviewLayoutBlock[], b: OverviewLayoutBlock[]): boolean {
  return (
    a.length === b.length &&
    a.every((block, i) => {
      const other = b[i];
      return block.id === other.id && block.width === other.width && !block.hidden === !other.hidden;
    })
  );
}
