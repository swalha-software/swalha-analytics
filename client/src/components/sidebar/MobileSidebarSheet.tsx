"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu } from "lucide-react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppShellSidebar } from "./AppShellSidebar";

/** Hamburger that slides the shell sidebar in on small screens. */
export function MobileSidebarTrigger() {
  const t = useExtracted();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline">
          <Menu />
        </Button>
      </SheetTrigger>
      <VisuallyHidden>
        <SheetHeader>
          <SheetTitle>{t("Swalha Analytics Sidebar")}</SheetTitle>
        </SheetHeader>
      </VisuallyHidden>
      <SheetContent side="left" className="flex w-[260px] gap-0 p-0" showClose={false}>
        <AppShellSidebar className="w-full border-e-0" />
      </SheetContent>
    </Sheet>
  );
}
