import { AppShellSidebar } from "./sidebar/AppShellSidebar";
import { cn } from "../lib/utils";

export function StandardPage({
  children,
  showSidebar = true,
  fullWidth = false,
}: {
  children: React.ReactNode;
  showSidebar?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div className="h-full flex w-full">
      {showSidebar && <AppShellSidebar className="hidden md:flex" />}
      <main className="flex flex-col items-center p-4 w-full h-dvh overflow-y-auto">
        <div className={cn("w-full", fullWidth ? "max-w-full" : "max-w-6xl")}>{children}</div>
      </main>
    </div>
  );
}
