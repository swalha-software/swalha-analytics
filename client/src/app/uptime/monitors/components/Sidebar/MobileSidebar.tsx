"use client";

import { MobileSidebarTrigger } from "../../../../../components/sidebar/MobileSidebarSheet";

export function MobileSidebar() {
  return (
    <div className="md:hidden flex items-center gap-2">
      <MobileSidebarTrigger />
    </div>
  );
}
