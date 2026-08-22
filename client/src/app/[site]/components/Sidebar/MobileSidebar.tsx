"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useGetSite } from "../../../../api/admin/hooks/useSites";
import { Favicon } from "../../../../components/Favicon";
import { MobileSidebarTrigger } from "../../../../components/sidebar/MobileSidebarSheet";
import { getCurrentSiteId } from "../../../../lib/siteRoute";
import { useEmbedablePage } from "../../utils";

function MobileSidebarContent() {
  const pathname = usePathname();
  const { data: site } = useGetSite(getCurrentSiteId(pathname) ?? undefined);

  const embed = useEmbedablePage();
  if (embed) return null;

  return (
    <div className="md:hidden flex items-center gap-2">
      <MobileSidebarTrigger />
      {site && <Favicon domain={site.domain} className="w-6 h-6" />}
    </div>
  );
}

export function MobileSidebar() {
  return (
    <Suspense fallback={null}>
      <MobileSidebarContent />
    </Suspense>
  );
}
