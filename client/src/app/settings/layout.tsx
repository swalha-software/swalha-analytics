"use client";

import { useWindowSize } from "@uidotdev/usehooks";
import { StandardPage } from "../../components/StandardPage";
import { AppShellSidebar } from "../../components/sidebar/AppShellSidebar";
import { MobileSidebar } from "./components/MobileSidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { width } = useWindowSize();

  if (width && width < 768) {
    return (
      <StandardPage showSidebar={false}>
        <MobileSidebar />
        <div className="mt-4">{children}</div>
      </StandardPage>
    );
  }

  return (
    <div className="flex h-full">
      <AppShellSidebar />
      <StandardPage showSidebar={false}>
        <div className="flex-1 overflow-auto mt-4">{children}</div>
      </StandardPage>
    </div>
  );
}
