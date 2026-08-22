"use client";

import { StandardPage } from "@/components/StandardPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExtracted } from "next-intl";
import { notFound } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { AppShellSidebar } from "../../components/sidebar/AppShellSidebar";
import { MobileSidebarTrigger } from "../../components/sidebar/MobileSidebarSheet";
import { DEPLOYMENT, IS_CLOUD } from "../../lib/const";
import { Database } from "./components/database/Database";
import { Email } from "./components/email/Email";
import { Organizations } from "./components/organizations/Organizations";
import { AdminLayout } from "./components/shared/AdminLayout";
import { Sites } from "./components/sites/Sites";
import { Users } from "./components/users/Users";

const ADMIN_TABS = ["organizations", "sites", "users", "database", "email"] as const;

function MobileSidebar() {
  return (
    <div className="md:hidden">
      <MobileSidebarTrigger />
    </div>
  );
}

export default function AdminPage() {
  // if (!IS_CLOUD && !DEPLOYMENT) notFound();

  const [activeTab, setActiveTab] = useQueryState("tab", parseAsStringLiteral(ADMIN_TABS).withDefault("organizations"));
  const t = useExtracted();

  return (
    <div className="flex h-full">
      <AppShellSidebar className="hidden md:flex" />
      <StandardPage showSidebar={false} fullWidth>
        <AdminLayout>
          <div className="mb-4 flex items-center gap-3">
            <MobileSidebar />
            <h1 className="text-xl font-semibold tracking-tight">{t("Admin")}</h1>
          </div>
          <Tabs value={activeTab} onValueChange={value => setActiveTab(value as (typeof ADMIN_TABS)[number])}>
            <TabsList className="mb-4">
              <TabsTrigger value="organizations">{t("Organizations")}</TabsTrigger>
              <TabsTrigger value="sites">{t("Sites")}</TabsTrigger>
              <TabsTrigger value="users">{t("Users")}</TabsTrigger>
              <TabsTrigger value="database">{t("Database")}</TabsTrigger>
              <TabsTrigger value="email">{t("Email")}</TabsTrigger>
            </TabsList>

            <TabsContent value="organizations">
              <Organizations />
            </TabsContent>

            <TabsContent value="sites">
              <Sites />
            </TabsContent>

            <TabsContent value="users">
              <Users />
            </TabsContent>

            <TabsContent value="database">
              <Database />
            </TabsContent>

            <TabsContent value="email">
              <Email />
            </TabsContent>
          </Tabs>
        </AdminLayout>
      </StandardPage>
    </div>
  );
}
