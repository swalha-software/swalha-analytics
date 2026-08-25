"use client";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, FoldHorizontal, GripVertical, RotateCcw, SlidersHorizontal, UnfoldHorizontal, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { ReactNode, useMemo, useState } from "react";
import { updateSiteConfig } from "../../../../api/admin/endpoints";
import { useGetSite } from "../../../../api/admin/hooks/useSites";
import { Button } from "../../../../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { useInView } from "../../../../hooks/useInView";
import { useStore } from "../../../../lib/store";
import { cn } from "../../../../lib/utils";
import { layoutsEqual, normalizeOverviewLayout, OverviewLayoutBlock } from "../overviewLayout";
import { Countries } from "./sections/Countries";
import { Devices } from "./sections/Devices";
import { Events } from "./sections/Events";
import { Pages } from "./sections/Pages";
import { Referrers } from "./sections/Referrers";
import { SearchConsole } from "./sections/SearchConsole";
import { Weekdays } from "./sections/Weekdays";

const BLOCKS: Record<string, { component: () => ReactNode; lazyHeight?: string }> = {
  referrers: { component: () => <Referrers /> },
  pages: { component: () => <Pages /> },
  devices: { component: () => <Devices /> },
  countries: { component: () => <Countries /> },
  events: { component: () => <Events />, lazyHeight: "394px" },
  weekdays: { component: () => <Weekdays /> },
  "search-console": { component: () => <SearchConsole /> },
};

function useBlockLabel() {
  const t = useExtracted();
  const labels: Record<string, string> = {
    referrers: t("Referrers"),
    pages: t("Pages"),
    devices: t("Devices"),
    countries: t("Countries"),
    events: t("Events"),
    weekdays: t("Weekdays"),
    "search-console": t("Search Console"),
  };
  return (id: string) => labels[id] ?? id;
}

function LazySection({ children, height = "405px" }: { children: ReactNode; height?: string }) {
  const { ref, isInView } = useInView({ persistVisibility: true, rootMargin: "100px 0px" });
  return (
    <div ref={ref} style={{ minHeight: isInView ? undefined : height }}>
      {isInView ? children : null}
    </div>
  );
}

function SortableBlock({
  block,
  editing,
  label,
  onToggleWidth,
  onHide,
}: {
  block: OverviewLayoutBlock;
  editing: boolean;
  label: string;
  onToggleWidth: () => void;
  onHide: () => void;
}) {
  const t = useExtracted();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !editing,
  });
  const def = BLOCKS[block.id];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        block.width === "full" && "lg:col-span-2",
        isDragging && "z-10 opacity-80",
        editing && "relative rounded-lg ring-1 ring-accent-500/60"
      )}
    >
      {editing && (
        <div className="absolute top-2 end-2 z-20 flex items-center gap-1 rounded-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 p-0.5">
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
      )}
      <div className={cn(editing && "pointer-events-none select-none")}>
        {editing ? def.component() : <LazySection height={def.lazyHeight}>{def.component()}</LazySection>}
      </div>
    </div>
  );
}

export function OverviewGrid() {
  const t = useExtracted();
  const getBlockLabel = useBlockLabel();
  const { site } = useStore();
  const { data: siteMetadata } = useGetSite();
  const queryClient = useQueryClient();

  const savedLayout = useMemo(
    () => normalizeOverviewLayout(siteMetadata?.overviewLayout),
    [siteMetadata?.overviewLayout]
  );

  // null draft = view mode; a draft array = edit mode.
  const [draft, setDraft] = useState<OverviewLayoutBlock[] | null>(null);
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
  const hiddenBlocks = layout.filter(b => b.hidden);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!draft || !over || active.id === over.id) return;
    const from = draft.findIndex(b => b.id === active.id);
    const to = draft.findIndex(b => b.id === over.id);
    if (from === -1 || to === -1) return;
    setDraft(arrayMove(draft, from, to));
  };

  const updateBlock = (id: string, patch: Partial<OverviewLayoutBlock>) => {
    setDraft(current => (current ? current.map(b => (b.id === id ? { ...b, ...patch } : b)) : current));
  };

  const isDefault = layoutsEqual(layout, normalizeOverviewLayout(null));
  const isDirty = editing && !layoutsEqual(draft!, savedLayout);

  return (
    <div>
      {siteMetadata?.isOwner && (
        <div className="flex items-center justify-end gap-2 mb-2 min-h-8">
          {editing ? (
            <>
              <span className="text-sm text-neutral-400 me-auto">{t("Drag blocks to rearrange them")}</span>
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
                onClick={() => saveMutation.mutate(draft)}
              >
                {t("Save layout")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setDraft(savedLayout.map(b => ({ ...b })))}>
              <SlidersHorizontal className="h-4 w-4" />
              {t("Customize")}
            </Button>
          )}
        </div>
      )}
      {editing && hiddenBlocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-neutral-400">{t("Hidden")}:</span>
          {hiddenBlocks.map(block => (
            <Button
              key={block.id}
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => updateBlock(block.id, { hidden: false })}
            >
              <Eye className="h-3.5 w-3.5" />
              {getBlockLabel(block.id)}
            </Button>
          ))}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleBlocks.map(b => b.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleBlocks.map(block => (
              <SortableBlock
                key={block.id}
                block={block}
                editing={editing}
                label={getBlockLabel(block.id)}
                onToggleWidth={() => updateBlock(block.id, { width: block.width === "half" ? "full" : "half" })}
                onHide={() => updateBlock(block.id, { hidden: true })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
