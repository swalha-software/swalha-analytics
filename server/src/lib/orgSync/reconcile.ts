// Pull reconcile against SWALHA Auth's sync API: at boot, hourly, and as the
// safety net after a webhook outage. Applies the current snapshot of every
// organization this app can see and deactivates mirrored organizations that
// are no longer in the list.

import * as cron from "node-cron";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { organization, orgSync } from "../../db/postgres/schema.js";
import { createServiceLogger } from "../logger/logger.js";
import { applyOrganizationSnapshot, deactivateOrganization } from "./apply.js";
import { orgSyncEnabled, syncGet } from "./provider.js";
import type { OrganizationSnapshot } from "./types.js";

const log = createServiceLogger("org-sync");

export type ReconcileResult = { version: number; organizations: number; applied: number; deactivated: number };

export async function reconcileOrganizations(): Promise<ReconcileResult> {
  const { version, organizations } = await syncGet<{ version: number; organizations: OrganizationSnapshot[] }>(
    "/organizations"
  );

  let applied = 0;
  for (const snapshot of organizations) {
    const r = await applyOrganizationSnapshot(snapshot, version);
    if (r.applied) applied++;
  }

  // Mirrored and still active, but Auth no longer lists it → not ours anymore.
  const seen = organizations.map(o => o.id);
  const stale = await db
    .select({ organizationId: orgSync.organizationId })
    .from(orgSync)
    .where(
      seen.length
        ? and(isNull(orgSync.deactivatedAt), notInArray(orgSync.organizationId, seen))
        : isNull(orgSync.deactivatedAt)
    );
  let deactivated = 0;
  for (const s of stale) {
    const r = await deactivateOrganization(s.organizationId, version);
    if (r.applied) deactivated++;
  }

  // Local organizations that were never mirrored (pre-cutover leftovers):
  // untouched, but worth knowing about.
  const unmirrored = await db
    .select({ id: organization.id, slug: organization.slug })
    .from(organization)
    .leftJoin(orgSync, eq(orgSync.organizationId, organization.id))
    .where(isNull(orgSync.organizationId));
  if (unmirrored.length) {
    log.warn({ organizations: unmirrored.map(o => o.slug) }, "Local organizations not mirrored from Auth");
  }

  const result = { version, organizations: organizations.length, applied, deactivated };
  log.info(result, "Reconciled organizations with Auth");
  return result;
}

let task: cron.ScheduledTask | null = null;

/** Boot reconcile (non-fatal) + hourly. Primary process only. */
export function startOrgSyncReconcile() {
  if (!orgSyncEnabled()) {
    log.info("Organization sync disabled (SWALHA_SSO_CLIENT_ID/SECRET not set)");
    return;
  }
  const run = () => reconcileOrganizations().catch(err => log.error({ err }, "Organization reconcile failed"));
  void run();
  task = cron.schedule("15 * * * *", run);
  log.info("Organization reconcile cron initialized (hourly at :15)");
}

export function stopOrgSyncReconcile() {
  task?.stop();
  task = null;
}
