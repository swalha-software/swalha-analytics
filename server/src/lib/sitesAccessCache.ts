import NodeCache from "node-cache";

// Per-user (and per-organization) resolved site access, short TTL. Lives in
// its own module so the organization sync can invalidate it without importing
// auth-utils (which imports the whole better-auth setup).
export const sitesAccessCache = new NodeCache({
  stdTTL: 15,
  checkperiod: 30,
  useClones: false, // Don't clone objects for better performance with promises
});

// Cache keys for one user's site list. A browser session may carry
// system-admin authority; a bearer credential for the same user never does,
// so the two are cached apart.
export const sessionSitesKey = (userId: string) => `${userId}:session`;
export const bearerSitesKey = (userId: string) => `${userId}:bearer`;

// Cache invalidation helper - call this when membership or site access changes
export function invalidateSitesAccessCache(userId: string) {
  sitesAccessCache.del(sessionSitesKey(userId));
  sitesAccessCache.del(bearerSitesKey(userId));
}
