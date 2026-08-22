import { create } from "zustand";

/**
 * True from the moment another organization is picked until the router lands on
 * a route for it. In that window the site id in the URL still belongs to the
 * organization we just left, so the site switcher must not present it.
 */
type OrgSwitchStore = {
  switching: boolean;
  setSwitching: (switching: boolean) => void;
};

export const useOrgSwitch = create<OrgSwitchStore>(set => ({
  switching: false,
  setSwitching: switching => set({ switching }),
}));
