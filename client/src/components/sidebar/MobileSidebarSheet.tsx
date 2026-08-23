"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu } from "lucide-react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { AppShellSidebar } from "./AppShellSidebar";

/** Hamburger + drawer; the caller supplies which sidebar slides in. */
function SidebarSheet({ children }: { children: React.ReactNode }) {
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
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** Slides the shell sidebar in on small screens. */
export function MobileSidebarTrigger() {
  return (
    <SidebarSheet>
      <AppShellSidebar className="w-full border-e-0" forceExpanded />
    </SidebarSheet>
  );
}

/** Same drawer, admin navigation. */
export function AdminMobileSidebarTrigger() {
  return (
    <SidebarSheet>
      <AdminSidebar className="w-full border-e-0" forceExpanded />
    </SidebarSheet>
  );
}
