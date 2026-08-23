"use client";

import { useExtracted } from "next-intl";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/sidebar/AdminSidebar";
import { AdminMobileSidebarTrigger } from "@/components/sidebar/MobileSidebarSheet";
import { StandardPage } from "@/components/StandardPage";
import { AdminLayout } from "./components/shared/AdminLayout";

/** Literal keys only: the message extractor cannot follow a computed argument. */
function useSectionTitle() {
  const t = useExtracted();
  const pathname = usePathname();

  if (pathname.startsWith("/admin/sites")) return t("Sites");
  if (pathname.startsWith("/admin/users")) return t("Users");
  if (pathname.startsWith("/admin/database")) return t("Database");
  if (pathname.startsWith("/admin/email")) return t("Email");
  if (pathname.startsWith("/admin/organizations")) return t("Organizations");
  return t("Admin");
}

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  const title = useSectionTitle();

  return (
    <div className="flex h-full">
      <AdminSidebar className="hidden md:flex" />
      <StandardPage showSidebar={false} fullWidth>
        <AdminLayout>
          <div className="mb-4 flex items-center gap-3">
            <div className="md:hidden">
              <AdminMobileSidebarTrigger />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          {children}
        </AdminLayout>
      </StandardPage>
    </div>
  );
}
