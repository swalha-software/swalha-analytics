import NodeCache from "node-cache";

// Per-user (and per-organization) resolved site access, short TTL. Lives in
// its own module so the organization sync can invalidate it without importing
// auth-utils (which imports the whole better-auth setup).
export const sitesAccessCache = new NodeCache({
  stdTTL: 15,
  checkperiod: 30,
  useClones: false, // Don't clone objects for better performance with promises
});

// Cache invalidation helper - call this when membership or site access changes
export function invalidateSitesAccessCache(userId: string) {
  sitesAccessCache.del(`${userId}:true`);
  sitesAccessCache.del(`${userId}:false`);
}
