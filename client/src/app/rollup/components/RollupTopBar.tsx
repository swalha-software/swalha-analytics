"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateSelector } from "@/components/DateSelector/DateSelector";
import { Button } from "@/components/ui/button";
import { canGoBack, canGoForward, goBack, goForward, useStore } from "@/lib/store";

export function RollupTopBar() {
  const { time, setTime } = useStore();

  return (
    <div className="flex flex-wrap gap-2 justify-end items-center">
      <div className="flex items-center gap-2">
        <DateSelector time={time} setTime={setTime} />
        <div className="flex items-center">
          <Button
            variant="secondary"
            size="icon"
            onClick={goBack}
            disabled={!canGoBack(time)}
            className="rounded-r-none h-8 w-8"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={goForward}
            disabled={!canGoForward(time)}
            className="rounded-l-none -ml-px h-8 w-8"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
