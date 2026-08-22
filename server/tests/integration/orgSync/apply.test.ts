import { ORG_API_KEY_CONFIG_ID } from "@rybbit/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../../src/db/postgres/postgres.js";
import {
  account,
  apiKey,
  member,
  memberSiteAccess,
  organization,
  orgSync,
  sites,
  team,
  teamMember,
  user,
} from "../../../src/db/postgres/schema.js";
import { applyOrganizationSnapshot, deactivateOrganization } from "../../../src/lib/orgSync/apply.js";
import type { OrganizationSnapshot } from "../../../src/lib/orgSync/types.js";

const T = "2026-08-01T10:00:00.000Z";
const ts = () => new Date().toISOString();

const owner = { userId: "sub_owner", email: "owner@test.local", name: "Owner", image: null, role: "owner", since: T };
const dev = { userId: "sub_dev", email: "dev@test.local", name: "Dev", image: null, role: "member", since: T };

function snapshot(over: Partial<OrganizationSnapshot> = {}): OrganizationSnapshot {
  return {
    id: "org_acme",
    slug: "acme",
    name: "Acme",
    logo: null,
    createdAt: T,
    members: [owner, dev],
    teams: [{ id: "team_design", name: "Design", createdAt: T, members: ["sub_dev"] }],
    ...over,
  };
}

const localUserBySub = async (sub: string) =>
  (await db.select({ userId: account.userId }).from(account).where(eq(account.accountId, sub)))[0]?.userId;
const membersOf = (orgId: string) => db.select().from(member).where(eq(member.organizationId, orgId));

describe("applyOrganizationSnapshot", () => {
  it("creates the organization, provisions unknown users with SSO links, members and teams", async () => {
    expect(await applyOrganizationSnapshot(snapshot(), 5)).toEqual({ applied: true });

    const [org] = await db.select().from(organization).where(eq(organization.id, "org_acme"));
    expect(org).toMatchObject({ slug: "acme", name: "Acme" });

    const ownerId = await localUserBySub("sub_owner");
    const devId = await localUserBySub("sub_dev");
    expect(ownerId).toBeTruthy();
    const [ownerUser] = await db.select().from(user).where(eq(user.id, ownerId!));
    expect(ownerUser).toMatchObject({ email: "owner@test.local", name: "Owner", emailVerified: true });

    const members = await membersOf("org_acme");
    expect(members.map(m => [m.userId, m.role]).sort()).toEqual(
      [
        [ownerId, "owner"],
        [devId, "member"],
      ].sort()
    );
    expect(await db.select().from(team).where(eq(team.organizationId, "org_acme"))).toMatchObject([
      { id: "team_design", name: "Design" },
    ]);
    expect(await db.select().from(teamMember).where(eq(teamMember.teamId, "team_design"))).toMatchObject([
      { userId: devId },
    ]);
    expect(await db.select().from(orgSync)).toMatchObject([
      { organizationId: "org_acme", version: 5, deactivatedAt: null },
    ]);
  });

  it("ignores versions that are not newer", async () => {
    await applyOrganizationSnapshot(snapshot(), 5);
    expect(await applyOrganizationSnapshot(snapshot({ name: "Older" }), 5)).toEqual({
      applied: false,
      reason: "stale",
    });
    expect(await applyOrganizationSnapshot(snapshot({ name: "Older" }), 4)).toEqual({
      applied: false,
      reason: "stale",
    });
    const [org] = await db.select().from(organization);
    expect(org.name).toBe("Acme");
  });

  it("links a pre-SSO local user by email instead of creating a duplicate", async () => {
    await db.insert(user).values({
      id: "local_dev",
      name: "Old Dev",
      email: "dev@test.local",
      emailVerified: false,
      createdAt: ts(),
      updatedAt: ts(),
    });
    await applyOrganizationSnapshot(snapshot(), 1);
    expect(await localUserBySub("sub_dev")).toBe("local_dev");
    expect((await db.select().from(user).where(eq(user.email, "dev@test.local"))).length).toBe(1);
  });

  it("replaces member/team sets on a newer snapshot and keeps product-owned data", async () => {
    await applyOrganizationSnapshot(snapshot(), 1);
    const devId = (await localUserBySub("sub_dev"))!;
    const ownerId = (await localUserBySub("sub_owner"))!;

    // Product-owned state: billing on the org, restricted site access on a member.
    await db.update(organization).set({ stripeCustomerId: "cus_123" }).where(eq(organization.id, "org_acme"));
    const [site] = await db
      .insert(sites)
      .values({ name: "Site", domain: "acme.test", organizationId: "org_acme", createdBy: ownerId })
      .returning();
    const [devMember] = await db.select().from(member).where(eq(member.userId, devId));
    await db.update(member).set({ hasRestrictedSiteAccess: true }).where(eq(member.id, devMember.id));
    await db.insert(memberSiteAccess).values({ memberId: devMember.id, siteId: site.siteId });

    const newcomer = { userId: "sub_new", email: "new@test.local", name: "New", image: null, role: "admin", since: T };
    const r = await applyOrganizationSnapshot(
      snapshot({
        name: "Acme Inc",
        members: [owner, { ...dev, role: "admin" }, newcomer],
        teams: [{ id: "team_design", name: "Product Design", createdAt: T, members: ["sub_dev", "sub_new"] }],
      }),
      2
    );
    expect(r).toEqual({ applied: true });

    const [org] = await db.select().from(organization);
    expect(org).toMatchObject({ name: "Acme Inc", stripeCustomerId: "cus_123" });
    const [devAfter] = await db.select().from(member).where(eq(member.id, devMember.id));
    expect(devAfter).toMatchObject({ role: "admin", hasRestrictedSiteAccess: true }); // same row, role updated
    expect((await db.select().from(memberSiteAccess)).length).toBe(1);
    expect((await membersOf("org_acme")).length).toBe(3);
    expect((await db.select().from(team))[0].name).toBe("Product Design");
    expect((await db.select().from(teamMember)).length).toBe(2);

    // Drop dev and the team entirely.
    await applyOrganizationSnapshot(snapshot({ members: [owner, newcomer], teams: [] }), 3);
    expect((await membersOf("org_acme")).map(m => m.userId).sort()).toEqual(
      [ownerId, await localUserBySub("sub_new")].sort()
    );
    expect(await db.select().from(memberSiteAccess)).toEqual([]); // cascaded with the member
    expect(await db.select().from(team)).toEqual([]);
    expect(await db.select().from(teamMember)).toEqual([]);
    // Users themselves are never deleted.
    expect((await db.select().from(user)).length).toBe(3);
  });
});

describe("deactivateOrganization", () => {
  it("drops members, teams and org API keys but keeps the organization and its sites", async () => {
    await applyOrganizationSnapshot(snapshot(), 1);
    const ownerId = (await localUserBySub("sub_owner"))!;
    await db
      .insert(sites)
      .values({ name: "Site", domain: "acme.test", organizationId: "org_acme", createdBy: ownerId });
    await db.insert(apiKey).values([
      {
        id: "k_org",
        name: "org key",
        key: "k1",
        referenceId: "org_acme",
        configId: ORG_API_KEY_CONFIG_ID,
        createdAt: ts(),
        updatedAt: ts(),
      },
      { id: "k_user", name: "user key", key: "k2", referenceId: ownerId, createdAt: ts(), updatedAt: ts() },
    ]);

    expect(await deactivateOrganization("org_acme", 2)).toEqual({ applied: true });
    expect(await membersOf("org_acme")).toEqual([]);
    expect(await db.select().from(team)).toEqual([]);
    expect((await db.select().from(apiKey)).map(k => k.id)).toEqual(["k_user"]);
    expect((await db.select().from(organization)).length).toBe(1);
    expect((await db.select().from(sites)).length).toBe(1);
    const [state] = await db.select().from(orgSync);
    expect(state.version).toBe(2);
    expect(state.deactivatedAt).not.toBeNull();

    // Stale and unknown organizations are no-ops.
    expect(await deactivateOrganization("org_acme", 2)).toEqual({ applied: false, reason: "stale" });
    expect(await deactivateOrganization("org_nope", 9)).toEqual({ applied: false, reason: "stale" });

    // Access granted again: a newer snapshot reactivates.
    expect(await applyOrganizationSnapshot(snapshot(), 3)).toEqual({ applied: true });
    expect((await membersOf("org_acme")).length).toBe(2);
    expect((await db.select().from(orgSync))[0].deactivatedAt).toBeNull();
  });
});
