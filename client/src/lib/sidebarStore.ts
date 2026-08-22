import { create } from "zustand";

// The collapsed preference is shared by every sidebar mount (each page renders
// its own <AppShellSidebar />) so they all agree, and remembered per browser.
const STORAGE_KEY = "swalha.sidebarCollapsed";

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Blocked storage (private mode, quota): remembering is a convenience.
  }
}

type SidebarStore = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  /** Pulls the stored preference in; called once from the first mount. */
  hydrateCollapsed: () => void;
};

export const useSidebarStore = create<SidebarStore>(set => ({
  // Starts expanded so the server and the browser's first render agree;
  // hydrateCollapsed() applies the stored preference right after mount.
  collapsed: false,
  setCollapsed: collapsed => {
    writeStoredCollapsed(collapsed);
    set({ collapsed });
  },
  toggleCollapsed: () =>
    set(state => {
      writeStoredCollapsed(!state.collapsed);
      return { collapsed: !state.collapsed };
    }),
  hydrateCollapsed: () => set({ collapsed: readStoredCollapsed() }),
}));
