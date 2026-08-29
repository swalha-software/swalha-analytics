"use client";
import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FoldHorizontal,
  GripVertical,
  LayoutGrid,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  UnfoldHorizontal,
  X,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { ReactNode, useMemo, useState } from "react";
import { updateSiteConfig } from "../../../../api/admin/endpoints";
import { useGetSite } from "../../../../api/admin/hooks/useSites";
import { Button } from "../../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { useInView } from "../../../../hooks/useInView";
import { useStore } from "../../../../lib/store";
import { cn } from "../../../../lib/utils";
import {
  getDefaultPanes,
  isStandaloneBlock,
  layoutsEqual,
  makeBlockId,
  normalizeOverviewLayout,
  OverviewLayoutBlock,
  type OverviewBlockId,
  type OverviewPaneId,
} from "../overviewLayout";
import { OverviewTabbedCard, paneNeedsTallCard, useOverviewPaneDefs, type OverviewPaneDef } from "./overviewPanes";
import { SearchConsole } from "./sections/SearchConsole";
import { Weekdays } from "./sections/Weekdays";

const CARD_PREFIX = "card:";
const PANE_PREFIX = "pane:";
const STRIP_PREFIX = "strip:";

type ActiveDrag = { type: "card"; id: string } | { type: "pane"; id: string };

// Labels for standalone blocks and for the dropdown's category groups.
function useCategoryLabels(): Record<string, string> {
  const t = useExtracted();
  return {
    referrers: t("Referrers"),
    pages: t("Pages"),
    devices: t("Devices"),
    countries: t("Countries"),
    events: t("Events"),
    weekdays: t("Weekdays"),
    "search-console": t("Search Console"),
  };
}

const PANE_CATEGORIES: OverviewBlockId[] = ["referrers", "pages", "devices", "countries", "events"];

function LazySection({ children, height = "405px" }: { children: ReactNode; height?: string }) {
  const { ref, isInView } = useInView({ persistVisibility: true, rootMargin: "100px 0px" });
  return (
    <div ref={ref} style={{ minHeight: isInView ? undefined : height }}>
      {isInView ? children : null}
    </div>
  );
}

function BlockContent({ block }: { block: OverviewLayoutBlock }) {
  if (block.id === "weekdays") return <Weekdays />;
  if (block.id === "search-console") return <SearchConsole />;
  const panes = block.panes ?? getDefaultPanes(block.id);
  // Remount when the tab set changes so the selected tab never points at a moved-away pane.
  return <OverviewTabbedCard key={panes.join(",")} paneIds={panes} />;
}

function PaneChipLabel({ label }: { label: ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 px-2 py-0.5 text-xs text-neutral-700 dark:text-neutral-200">
      <GripVertical className="h-3 w-3 text-neutral-400" />
      {label}
    </span>
  );
}

function PaneChip({ paneId, label }: { paneId: string; label: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${PANE_PREFIX}${paneId}`,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab active:cursor-grabbing touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <PaneChipLabel label={label} />
    </div>
  );
}

function PaneStrip({
  block,
  paneDefs,
  mergeTarget,
}: {
  block: OverviewLayoutBlock;
  paneDefs: Record<string, OverviewPaneDef>;
  mergeTarget: boolean;
}) {
  const t = useExtracted();
  const { setNodeRef, isOver } = useDroppable({ id: `${STRIP_PREFIX}${block.id}` });
  const panes = block.panes ?? [];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-8 flex-1 flex-wrap items-center gap-1.5 rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-1",
        mergeTarget && "border-accent-500 bg-accent-500/5",
        mergeTarget && isOver && "bg-accent-500/15"
      )}
    >
      <SortableContext items={panes.map(p => `${PANE_PREFIX}${p}`)} strategy={rectSortingStrategy}>
        {panes.map(p => (
          <PaneChip key={p} paneId={p} label={paneDefs[p]?.label ?? p} />
        ))}
      </SortableContext>
      {mergeTarget && <span className="text-xs text-accent-500 px-1">{t("Drop here to merge tabs")}</span>}
      {!mergeTarget && panes.length === 0 && (
        <span className="text-xs text-neutral-400 px-1">{t("Drop tabs here")}</span>
      )}
    </div>
  );
}

function SortableBlock({
  block,
  editing,
  label,
  paneDefs,
  activeDrag,
  onToggleWidth,
  onHide,
}: {
  block: OverviewLayoutBlock;
  editing: boolean;
  label: string;
  paneDefs: Record<string, OverviewPaneDef>;
  activeDrag: ActiveDrag | null;
  onToggleWidth: () => void;
  onHide: () => void;
}) {
  const t = useExtracted();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${CARD_PREFIX}${block.id}`,
    disabled: !editing,
  });

  const isTabbed = block.panes !== undefined;
  const mergeTarget = activeDrag?.type === "card" && activeDrag.id !== block.id && isTabbed;
  const lazyHeight = block.panes?.some(paneNeedsTallCard) ? "394px" : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        block.width === "full" && "lg:col-span-2",
        isDragging && "z-10 opacity-80",
        editing && "relative rounded-lg ring-1 ring-accent-500/60 p-1.5"
      )}
    >
      {editing && (
        <div className="mb-1.5 flex items-start gap-1.5">
          {isTabbed ? (
            <PaneStrip block={block} paneDefs={paneDefs} mergeTarget={mergeTarget} />
          ) : (
            <div className="flex min-h-8 flex-1 items-center px-1 text-sm text-neutral-400">{label}</div>
          )}
          <div className="flex items-center gap-1 rounded-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 p-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleWidth}>
                  {block.width === "half" ? (
                    <UnfoldHorizontal className="h-4 w-4" />
                  ) : (
                    <FoldHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{block.width === "half" ? t("Full width") : t("Half width")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onHide}>
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("Hide {block}", { block: label })}</TooltipContent>
            </Tooltip>
            <button
              className="flex h-7 w-7 items-center justify-center cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-100"
              aria-label={t("Move {block}", { block: label })}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className={cn(editing && "pointer-events-none select-none")}>
        {editing && isTabbed && block.panes!.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-sm text-neutral-400">
            {t("Drag tabs here to fill this block")}
          </div>
        ) : editing ? (
          <BlockContent block={block} />
        ) : (
          <LazySection height={lazyHeight}>
            <BlockContent block={block} />
          </LazySection>
        )}
      </div>
    </div>
  );
}

export function OverviewGrid() {
  const t = useExtracted();
  const categoryLabels = useCategoryLabels();
  const paneDefs = useOverviewPaneDefs();

  const paneLabel = (pane: string): string => {
    const label = paneDefs[pane as OverviewPaneId]?.label;
    return typeof label === "string" ? label : pane;
  };

  const getBlockLabel = (block: OverviewLayoutBlock): string => {
    if (isStandaloneBlock(block.id)) return categoryLabels[block.id] ?? block.id;
    return categoryLabels[block.id] ?? paneLabel(block.panes?.[0] ?? block.id);
  };
  const { site } = useStore();
  const { data: siteMetadata } = useGetSite();
  const queryClient = useQueryClient();

  const savedLayout = useMemo(
    () => normalizeOverviewLayout(siteMetadata?.overviewLayout),
    [siteMetadata?.overviewLayout]
  );

  // null draft = view mode; a draft array = edit mode.
  const [draft, setDraft] = useState<OverviewLayoutBlock[] | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const editing = draft !== null;
  const layout = draft ?? savedLayout;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveMutation = useMutation({
    mutationFn: (nextLayout: OverviewLayoutBlock[] | null) =>
      updateSiteConfig(Number(site), { overviewLayout: nextLayout }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get-site"] });
      setDraft(null);
    },
  });

  const visibleBlocks = layout.filter(b => !b.hidden);

  const collisionDetection: CollisionDetection = args => {
    const activeId = String(args.active.id);

    if (activeId.startsWith(PANE_PREFIX)) {
      const containers = args.droppableContainers.filter(c => {
        const id = String(c.id);
        return id.startsWith(PANE_PREFIX) || id.startsWith(STRIP_PREFIX);
      });
      const within = pointerWithin({ ...args, droppableContainers: containers });
      return within.length ? within : closestCenter({ ...args, droppableContainers: containers });
    }

    // Card drag: hitting another card's tab strip means "merge"; anywhere else reorders.
    const cardId = activeId.startsWith(CARD_PREFIX) ? activeId.slice(CARD_PREFIX.length) : null;
    const activeBlock = cardId ? draft?.find(b => b.id === cardId) : undefined;
    if (activeBlock?.panes?.length) {
      const strips = args.droppableContainers.filter(c => {
        const id = String(c.id);
        return id.startsWith(STRIP_PREFIX) && id !== `${STRIP_PREFIX}${cardId}`;
      });
      const stripHit = pointerWithin({ ...args, droppableContainers: strips });
      if (stripHit.length) return stripHit;
    }
    const cards = args.droppableContainers.filter(c => String(c.id).startsWith(CARD_PREFIX));
    return closestCenter({ ...args, droppableContainers: cards });
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    if (id.startsWith(PANE_PREFIX)) setActiveDrag({ type: "pane", id: id.slice(PANE_PREFIX.length) });
    else if (id.startsWith(CARD_PREFIX)) setActiveDrag({ type: "card", id: id.slice(CARD_PREFIX.length) });
  };

  // Live-move a dragged tab between cards while hovering.
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!draft || !over) return;
    const activeId = String(active.id);
    if (!activeId.startsWith(PANE_PREFIX)) return;
    const paneId = activeId.slice(PANE_PREFIX.length);
    const overId = String(over.id);

    const targetBlockId = overId.startsWith(PANE_PREFIX)
      ? draft.find(b => b.panes?.includes(overId.slice(PANE_PREFIX.length)))?.id
      : overId.startsWith(STRIP_PREFIX)
        ? overId.slice(STRIP_PREFIX.length)
        : undefined;
    if (!targetBlockId) return;

    const sourceBlock = draft.find(b => b.panes?.includes(paneId));
    const targetBlock = draft.find(b => b.id === targetBlockId);
    if (!sourceBlock || !targetBlock?.panes || sourceBlock.id === targetBlockId) return;

    setDraft(current => {
      if (!current) return current;
      return current.map(b => {
        if (b.id === sourceBlock.id) return { ...b, panes: b.panes!.filter(p => p !== paneId) };
        if (b.id === targetBlockId) {
          const panes = [...b.panes!];
          const overPaneIndex = overId.startsWith(PANE_PREFIX)
            ? panes.indexOf(overId.slice(PANE_PREFIX.length))
            : -1;
          panes.splice(overPaneIndex < 0 ? panes.length : overPaneIndex, 0, paneId);
          return { ...b, panes };
        }
        return b;
      });
    });
  };

  const mergeBlocks = (sourceId: string, targetId: string) => {
    setDraft(current => {
      if (!current) return current;
      const source = current.find(b => b.id === sourceId);
      const target = current.find(b => b.id === targetId);
      if (!source?.panes?.length || !target?.panes) return current;
      return current
        .filter(b => b.id !== sourceId)
        .map(b => (b.id === targetId ? { ...b, panes: [...b.panes!, ...source.panes!] } : b));
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDrag(null);
    if (!draft) return;
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;

    if (activeId.startsWith(PANE_PREFIX)) {
      const paneId = activeId.slice(PANE_PREFIX.length);
      if (overId?.startsWith(PANE_PREFIX) && overId !== activeId) {
        const overPane = overId.slice(PANE_PREFIX.length);
        setDraft(current => {
          if (!current) return current;
          return current.map(b => {
            if (!b.panes?.includes(paneId) || !b.panes.includes(overPane)) return b;
            return { ...b, panes: arrayMove(b.panes, b.panes.indexOf(paneId), b.panes.indexOf(overPane)) };
          });
        });
      }
      return;
    }

    if (!activeId.startsWith(CARD_PREFIX) || !overId) return;
    const cardId = activeId.slice(CARD_PREFIX.length);

    if (overId.startsWith(STRIP_PREFIX)) {
      const targetId = overId.slice(STRIP_PREFIX.length);
      if (targetId !== cardId) mergeBlocks(cardId, targetId);
      return;
    }

    if (overId.startsWith(CARD_PREFIX) && overId !== activeId) {
      const from = draft.findIndex(b => b.id === cardId);
      const to = draft.findIndex(b => b.id === overId.slice(CARD_PREFIX.length));
      if (from !== -1 && to !== -1) setDraft(arrayMove(draft, from, to));
    }
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  const updateBlock = (id: string, patch: Partial<OverviewLayoutBlock>) => {
    setDraft(current => (current ? current.map(b => (b.id === id ? { ...b, ...patch } : b)) : current));
  };

  const paneVisible = (pane: string) => layout.some(b => !b.hidden && b.panes?.includes(pane));

  const addEmptyBlock = () => {
    setDraft(current => {
      if (!current) return current;
      const taken = new Set(current.map(b => b.id));
      return [...current, { id: makeBlockId("custom", taken), width: "half" as const, panes: [] }];
    });
  };

  // Remove a tab from the dashboard. It keeps living in a hidden block so the
  // choice survives saves and it can be re-added later.
  const removePane = (pane: string) => {
    setDraft(current => {
      if (!current) return current;
      const block = current.find(b => !b.hidden && b.panes?.includes(pane));
      if (!block) return current;
      if (block.panes!.length === 1) {
        return current.map(b => (b.id === block.id ? { ...b, hidden: true } : b));
      }
      const taken = new Set(current.map(b => b.id));
      return [
        ...current.map(b => (b.id === block.id ? { ...b, panes: b.panes!.filter(p => p !== pane) } : b)),
        { id: makeBlockId(pane, taken), width: "half" as const, hidden: true, panes: [pane] },
      ];
    });
  };

  // Put a removed tab back on the dashboard as its own block.
  const addPane = (pane: string) => {
    setDraft(current => {
      if (!current) return current;
      const block = current.find(b => b.panes?.includes(pane));
      if (block && !block.hidden) return current;
      if (block && block.panes!.length === 1) {
        return current.map(b => (b.id === block.id ? { ...b, hidden: false } : b));
      }
      const taken = new Set(current.map(b => b.id));
      const rest = block
        ? current.map(b => (b.id === block.id ? { ...b, panes: b.panes!.filter(p => p !== pane) } : b))
        : current;
      return [...rest, { id: makeBlockId(pane, taken), width: "half" as const, panes: [pane] }];
    });
  };

  const isDefault = layoutsEqual(layout, normalizeOverviewLayout(null));
  const isDirty = editing && !layoutsEqual(draft!, savedLayout);

  return (
    <div>
      {siteMetadata?.isOwner && (
        <div className="flex items-center justify-end gap-2 mb-2 min-h-8">
          {editing ? (
            <>
              <span className="text-sm text-neutral-400 me-auto">
                {t("Drag blocks to rearrange them, drag tabs between blocks, or drop a block onto another's tab row to merge them")}
              </span>
              <Button variant="ghost" size="sm" onClick={addEmptyBlock}>
                <Plus className="h-4 w-4" />
                {t("New block")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <LayoutGrid className="h-4 w-4" />
                    {t("Blocks")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
                  {PANE_CATEGORIES.map(category => (
                    <div key={category}>
                      <DropdownMenuLabel className="text-xs text-neutral-400">
                        {categoryLabels[category]}
                      </DropdownMenuLabel>
                      {getDefaultPanes(category).map(pane => (
                        <DropdownMenuCheckboxItem
                          key={pane}
                          checked={paneVisible(pane)}
                          onSelect={e => e.preventDefault()}
                          onCheckedChange={checked => (checked ? addPane(pane) : removePane(pane))}
                        >
                          {paneLabel(pane)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  ))}
                  <DropdownMenuSeparator />
                  {layout
                    .filter(block => isStandaloneBlock(block.id))
                    .map(block => (
                      <DropdownMenuCheckboxItem
                        key={block.id}
                        checked={!block.hidden}
                        onSelect={e => e.preventDefault()}
                        onCheckedChange={checked => updateBlock(block.id, { hidden: !checked })}
                      >
                        {getBlockLabel(block)}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                disabled={(isDefault && !siteMetadata?.overviewLayout) || saveMutation.isPending}
                onClick={() => saveMutation.mutate(null)}
              >
                <RotateCcw className="h-4 w-4" />
                {t("Reset to default")}
              </Button>
              <Button variant="ghost" size="sm" disabled={saveMutation.isPending} onClick={() => setDraft(null)}>
                {t("Cancel")}
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={!isDirty || saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate(draft!.filter(b => isStandaloneBlock(b.id) || (b.panes?.length ?? 0) > 0))
                }
              >
                {t("Save layout")}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(savedLayout.map(b => ({ ...b, panes: b.panes ? [...b.panes] : undefined })))}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("Customize")}
            </Button>
          )}
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={visibleBlocks.map(b => `${CARD_PREFIX}${b.id}`)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleBlocks.map(block => (
              <SortableBlock
                key={block.id}
                block={block}
                editing={editing}
                label={getBlockLabel(block)}
                paneDefs={paneDefs}
                activeDrag={activeDrag}
                onToggleWidth={() => updateBlock(block.id, { width: block.width === "half" ? "full" : "half" })}
                onHide={() => updateBlock(block.id, { hidden: true })}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeDrag?.type === "pane" ? (
            <PaneChipLabel label={paneDefs[activeDrag.id as keyof typeof paneDefs]?.label ?? activeDrag.id} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
