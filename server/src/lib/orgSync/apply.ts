// Applies organization snapshots from SWALHA Auth to the local mirror.
//
// Rules (swalha-auth docs/sync-contract.md):
// - same ids: organization.id, team.id are Auth's; members are keyed by the
//   Auth user id (`sub`) resolved to a local user through the `account` row
//   of the `swalha` SSO provider.
// - snapshots, never deltas: the member/team sets are replaced. Only mirrored
//   columns are written; product-owned data (billing columns, site access
//   grants, hasRestrictedSiteAccess) is left alone.
// - older versions are ignored (at-least-once delivery, ordered per org).
// - tombstone / access revoked: members are dropped so nobody can reach the
//   organization, but the organization, its sites and data are kept.

import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { ORG_API_KEY_CONFIG_ID } from "@rybbit/shared";
import { account, apiKey, member, organization, orgSync, team, teamMember, user } from "../../db/postgres/schema.js";
import { invalidateSitesAccessCache } from "../sitesAccessCache.js";
import { createServiceLogger } from "../logger/logger.js";
import { SSO_PROVIDER_ID } from "./provider.js";
import type { OrganizationSnapshot } from "./types.js";

const log = createServiceLogger("org-sync");

const ROLES = new Set(["owner", "admin", "member"]);
const generateId = () => randomBytes(16).toString("hex");
const now = () => new Date().toISOString();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Local user for an Auth user: by SSO link, else by email (pre-SSO account,
 * linked now), else provisioned from the snapshot data. Mirrors what the
 * first SSO sign-in would do, so sign-in later just finds the account.
 */
export async function ensureLocalUser(
  tx: Tx,
  u: { userId: string; email: string; name: string; image: string | null }
): Promise<string> {
  const [linked] = await tx
    .select({ userId: account.userId })
    .from(account)
    .where(and(eq(account.providerId, SSO_PROVIDER_ID), eq(account.accountId, u.userId)))
    .limit(1);
  if (linked) return linked.userId;

  const [byEmail] = await tx.select({ id: user.id }).from(user).where(eq(user.email, u.email)).limit(1);
  const localId = byEmail?.id ?? generateId();
  if (!byEmail) {
    await tx.insert(user).values({
      id: localId,
      name: u.name || u.email,
      email: u.email,
      emailVerified: true, // Auth verifies emails before anyone can be a member
      image: u.image,
      createdAt: now(),
      updatedAt: now(),
    });
    log.info({ userId: localId, email: u.email }, "Provisioned user from Auth organization sync");
  }
  await tx.insert(account).values({
    id: generateId(),
    accountId: u.userId,
    providerId: SSO_PROVIDER_ID,
    userId: localId,
    createdAt: now(),
    updatedAt: now(),
  });
  return localId;
}

async function currentVersion(tx: Tx, organizationId: string) {
  const [row] = await tx.select().from(orgSync).where(eq(orgSync.organizationId, organizationId)).limit(1);
  return row ?? null;
}

export type ApplyResult = { applied: boolean; reason?: "stale" };

/** Upserts one organization from a snapshot. No-op if `version` is not newer. */
export async function applyOrganizationSnapshot(snapshot: OrganizationSnapshot, version: number): Promise<ApplyResult> {
  const touchedUsers = new Set<string>();

  const result = await db.transaction(async tx => {
    const state = await currentVersion(tx, snapshot.id);
    if (state && state.version >= version) return { applied: false, reason: "stale" as const };

    // Organization row: mirrored columns only.
    const [existing] = await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, snapshot.id));
    if (existing) {
      await tx
        .update(organization)
        .set({ name: snapshot.name, slug: snapshot.slug, logo: snapshot.logo })
        .where(eq(organization.id, snapshot.id));
    } else {
      await tx.insert(organization).values({
        id: snapshot.id,
        name: snapshot.name,
        slug: snapshot.slug,
        logo: snapshot.logo,
        createdAt: snapshot.createdAt,
      });
    }

    // Members: resolve every Auth user to a local user, then diff.
    const localIdBySub = new Map<string, string>();
    for (const m of snapshot.members) {
      localIdBySub.set(m.userId, await ensureLocalUser(tx, m));
    }
    const current = await tx
      .select({ id: member.id, userId: member.userId, role: member.role })
      .from(member)
      .where(eq(member.organizationId, snapshot.id));
    const currentByUser = new Map(current.map(m => [m.userId, m]));
    const wanted = new Set<string>();

    for (const m of snapshot.members) {
      const localId = localIdBySub.get(m.userId)!;
      if (wanted.has(localId)) continue;
      wanted.add(localId);
      const role = ROLES.has(m.role) ? m.role : "member";
      const cur = currentByUser.get(localId);
      if (!cur) {
        await tx.insert(member).values({
          id: generateId(),
          organizationId: snapshot.id,
          userId: localId,
          role,
          createdAt: m.since,
        });
        touchedUsers.add(localId);
      } else if (cur.role !== role) {
        await tx.update(member).set({ role }).where(eq(member.id, cur.id));
        touchedUsers.add(localId);
      }
    }
    const gone = current.filter(m => !wanted.has(m.userId));
    if (gone.length) {
      await tx.delete(member).where(
        inArray(
          member.id,
          gone.map(m => m.id)
        )
      );
      gone.forEach(m => touchedUsers.add(m.userId));
    }

    // Teams: same ids as Auth; membership per team replaced.
    const currentTeams = await tx
      .select({ id: team.id, name: team.name })
      .from(team)
      .where(eq(team.organizationId, snapshot.id));
    const currentTeamIds = new Set(currentTeams.map(t => t.id));
    const wantedTeamIds = new Set(snapshot.teams.map(t => t.id));

    for (const t of snapshot.teams) {
      if (!currentTeamIds.has(t.id)) {
        await tx.insert(team).values({ id: t.id, name: t.name, organizationId: snapshot.id, createdAt: t.createdAt });
      } else if (currentTeams.find(c => c.id === t.id)!.name !== t.name) {
        await tx.update(team).set({ name: t.name, updatedAt: now() }).where(eq(team.id, t.id));
      }

      const wantedUsers = new Set(
        t.members.map(sub => localIdBySub.get(sub)).filter((id): id is string => !!id && wanted.has(id))
      );
      const currentTm = await tx
        .select({ id: teamMember.id, userId: teamMember.userId })
        .from(teamMember)
        .where(eq(teamMember.teamId, t.id));
      const currentTmUsers = new Set(currentTm.map(tm => tm.userId));
      for (const userId of wantedUsers) {
        if (!currentTmUsers.has(userId)) {
          await tx.insert(teamMember).values({ id: generateId(), teamId: t.id, userId, createdAt: now() });
          touchedUsers.add(userId);
        }
      }
      const goneTm = currentTm.filter(tm => !wantedUsers.has(tm.userId));
      if (goneTm.length) {
        await tx.delete(teamMember).where(
          inArray(
            teamMember.id,
            goneTm.map(tm => tm.id)
          )
        );
        goneTm.forEach(tm => touchedUsers.add(tm.userId));
      }
    }
    const goneTeams = [...currentTeamIds].filter(id => !wantedTeamIds.has(id));
    if (goneTeams.length) {
      // Cascades team_member and team_site_access.
      await tx.delete(team).where(inArray(team.id, goneTeams));
      current.forEach(m => touchedUsers.add(m.userId));
    }

    await tx
      .insert(orgSync)
      .values({ organizationId: snapshot.id, version, deactivatedAt: null, syncedAt: now() })
      .onConflictDoUpdate({
        target: orgSync.organizationId,
        set: { version, deactivatedAt: null, syncedAt: now() },
      });

    return { applied: true };
  });

  touchedUsers.forEach(invalidateSitesAccessCache);
  if (result.applied) {
    log.info(
      {
        organizationId: snapshot.id,
        slug: snapshot.slug,
        version,
        members: snapshot.members.length,
        teams: snapshot.teams.length,
      },
      "Applied organization snapshot"
    );
  }
  return result;
}

/**
 * Organization deleted in Auth or this app's access to it revoked: drop every
 * membership so it is unreachable, keep the row, sites and data. No-op if
 * `version` is not newer or the organization does not exist locally.
 */
export async function deactivateOrganization(organizationId: string, version: number): Promise<ApplyResult> {
  const touchedUsers: string[] = [];
  const result = await db.transaction(async tx => {
    const state = await currentVersion(tx, organizationId);
    if (state && state.version >= version) return { applied: false, reason: "stale" as const };
    const [exists] = await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, organizationId));
    if (!exists) return { applied: false, reason: "stale" as const };

    const members = await tx
      .select({ userId: member.userId })
      .from(member)
      .where(eq(member.organizationId, organizationId));
    touchedUsers.push(...members.map(m => m.userId));
    await tx.delete(member).where(eq(member.organizationId, organizationId));
    await tx.delete(team).where(eq(team.organizationId, organizationId));
    // apikey.referenceId has no FK; org-owned keys must not outlive access.
    await tx
      .delete(apiKey)
      .where(and(eq(apiKey.referenceId, organizationId), eq(apiKey.configId, ORG_API_KEY_CONFIG_ID)));
    await tx
      .insert(orgSync)
      .values({ organizationId, version, deactivatedAt: now(), syncedAt: now() })
      .onConflictDoUpdate({ target: orgSync.organizationId, set: { version, deactivatedAt: now(), syncedAt: now() } });
    return { applied: true };
  });
  touchedUsers.forEach(invalidateSitesAccessCache);
  if (result.applied)
    log.warn({ organizationId, version, droppedMembers: touchedUsers.length }, "Deactivated organization");
  return result;
}
