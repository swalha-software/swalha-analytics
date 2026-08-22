// Remembers the site each organization was last viewed on, so "/" can send the
// user straight back to it instead of a site list.
const STORAGE_KEY = "swalha.lastSiteId";

type LastSiteMap = Record<string, number>;

function readMap(): LastSiteMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as LastSiteMap) : {};
  } catch {
    return {};
  }
}

export function getLastSiteId(organizationId: string | undefined): number | null {
  if (!organizationId) return null;
  const siteId = readMap()[organizationId];
  return typeof siteId === "number" ? siteId : null;
}

export function rememberLastSiteId(organizationId: string | undefined, siteId: number): void {
  if (typeof window === "undefined" || !organizationId) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readMap(), [organizationId]: siteId }));
  } catch {
    // Blocked storage (private mode, quota): remembering is a convenience.
  }
}
