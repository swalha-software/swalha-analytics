"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";
import { DateSelector } from "@/components/DateSelector/DateSelector";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canGoBack, canGoForward, goBack, goForward, useStore } from "@/lib/store";

/** Organization title plus the same period controls the site dashboards use. */
export function OverviewHeader({ organizationName }: { organizationName: string | undefined }) {
  const t = useExtracted();
  const time = useStore(state => state.time);
  const setTime = useStore(state => state.setTime);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {organizationName ? (
          <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
            {organizationName}
          </h1>
        ) : (
          <Skeleton className="h-6 w-40" />
        )}
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t("Traffic across every site in this organization")}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <DateSelector time={time} setTime={setTime} />
        <div className="flex items-center">
          <Button
            variant="secondary"
            size="icon"
            onClick={goBack}
            disabled={!canGoBack(time)}
            aria-label={t("Previous period")}
            className="h-8 w-8 rounded-e-none"
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={goForward}
            disabled={!canGoForward(time)}
            aria-label={t("Next period")}
            className="-ms-px h-8 w-8 rounded-s-none"
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
