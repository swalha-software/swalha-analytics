// Login-time sync: the `organizations` userinfo claim lists every organization
// the signing-in user belongs to in Auth. Make their memberships in the
// organizations we already mirror correct right now, without waiting for a
// webhook. Which organizations we mirror at all is decided by push/pull —
// this never creates organizations (restricted app: the claim is not
// filtered by our access).

import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { account, member, orgSync, team, teamMember, user } from "../../db/postgres/schema.js";
import { invalidateSitesAccessCache } from "../sitesAccessCache.js";
import { createServiceLogger } from "../logger/logger.js";
import { SSO_PROVIDER_ID } from "./provider.js";
import type { UserinfoOrganization } from "./types.js";

const log = createServiceLogger("org-sync");
const ROLES = new Set(["owner", "admin", "member"]);
const generateId = () => randomBytes(16).toString("hex");

/**
 * Called from the SSO profile mapping, i.e. before better-auth signs the user
 * in. Only acts on a user that already exists locally (SSO link or email);
 * a brand-new user with no mirrored memberships has nothing to apply.
 */
export async function applyLoginOrganizations(profile: {
  sub: string;
  email?: string;
  organizations?: UserinfoOrganization[];
}): Promise<void> {
  if (!Array.isArray(profile.organizations)) return;

  const [linked] = await db
    .select({ userId: account.userId })
    .from(account)
    .where(and(eq(account.providerId, SSO_PROVIDER_ID), eq(account.accountId, profile.sub)))
    .limit(1);
  let localId = linked?.userId;
  if (!localId && profile.email) {
    const [byEmail] = await db.select({ id: user.id }).from(user).where(eq(user.email, profile.email)).limit(1);
    localId = byEmail?.id;
  }
  if (!localId) return;

  // Active mirrors only — deactivated organizations stay unreachable.
  const mirrored = await db
    .select({ organizationId: orgSync.organizationId })
    .from(orgSync)
    .where(isNull(orgSync.deactivatedAt));
  const mirroredIds = new Set(mirrored.map(m => m.organizationId));
  if (mirroredIds.size === 0) return;

  const claimed = new Map(profile.organizations.filter(o => mirroredIds.has(o.id)).map(o => [o.id, o]));
  const current = await db
    .select({ id: member.id, organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(and(eq(member.userId, localId), inArray(member.organizationId, [...mirroredIds])));
  const currentByOrg = new Map(current.map(m => [m.organizationId, m]));

  let changed = false;
  await db.transaction(async tx => {
    for (const [orgId, o] of claimed) {
      const role = ROLES.has(o.role) ? o.role : "member";
      const cur = currentByOrg.get(orgId);
      if (!cur) {
        await tx.insert(member).values({
          id: generateId(),
          organizationId: orgId,
          userId: localId!,
          role,
          createdAt: new Date().toISOString(),
        });
        changed = true;
      } else if (cur.role !== role) {
        await tx.update(member).set({ role }).where(eq(member.id, cur.id));
        changed = true;
      }

      // Teams: only ones we already mirror for this organization.
      const localTeams = await tx.select({ id: team.id }).from(team).where(eq(team.organizationId, orgId));
      const localTeamIds = new Set(localTeams.map(t => t.id));
      const wantedTeams = new Set(o.teams.map(t => t.id).filter(id => localTeamIds.has(id)));
      const currentTm = localTeamIds.size
        ? await tx
            .select({ id: teamMember.id, teamId: teamMember.teamId })
            .from(teamMember)
            .where(and(eq(teamMember.userId, localId!), inArray(teamMember.teamId, [...localTeamIds])))
        : [];
      for (const teamId of wantedTeams) {
        if (!currentTm.some(tm => tm.teamId === teamId)) {
          await tx
            .insert(teamMember)
            .values({ id: generateId(), teamId, userId: localId!, createdAt: new Date().toISOString() });
          changed = true;
        }
      }
      const goneTm = currentTm.filter(tm => !wantedTeams.has(tm.teamId)).map(tm => tm.id);
      if (goneTm.length) {
        await tx.delete(teamMember).where(inArray(teamMember.id, goneTm));
        changed = true;
      }
    }

    // Memberships (and team memberships) in mirrored organizations the claim no longer lists.
    const gone = current.filter(m => !claimed.has(m.organizationId));
    if (gone.length) {
      const goneOrgIds = gone.map(m => m.organizationId);
      const goneTeams = await tx.select({ id: team.id }).from(team).where(inArray(team.organizationId, goneOrgIds));
      if (goneTeams.length) {
        const goneTeamIds = goneTeams.map(t => t.id);
        await tx
          .delete(teamMember)
          .where(and(eq(teamMember.userId, localId!), inArray(teamMember.teamId, goneTeamIds)));
      }
      await tx.delete(member).where(
        inArray(
          member.id,
          gone.map(m => m.id)
        )
      );
      changed = true;
    }
  });

  if (changed) {
    invalidateSitesAccessCache(localId);
    log.info({ userId: localId, organizations: claimed.size }, "Applied login-time organization claim");
  }
}
