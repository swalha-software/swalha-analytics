import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../../src/db/postgres/postgres.js";
import { account, member, organization, orgSync, teamMember, user } from "../../../src/db/postgres/schema.js";
import { applyOrganizationSnapshot, deactivateOrganization } from "../../../src/lib/orgSync/apply.js";
import { applyLoginOrganizations } from "../../../src/lib/orgSync/loginClaim.js";
import type { OrganizationSnapshot } from "../../../src/lib/orgSync/types.js";

const T = "2026-08-01T10:00:00.000Z";
const owner = { userId: "sub_owner", email: "owner@test.local", name: "Owner", image: null, role: "owner", since: T };
const dev = { userId: "sub_dev", email: "dev@test.local", name: "Dev", image: null, role: "member", since: T };

const org = (id: string, members = [owner], teams: OrganizationSnapshot["teams"] = []): OrganizationSnapshot => ({
  id,
  slug: id,
  name: id,
  logo: null,
  createdAt: T,
  members,
  teams,
});

const localUserBySub = async (sub: string) =>
  (await db.select({ userId: account.userId }).from(account).where(eq(account.accountId, sub)))[0]?.userId;
const membershipsOf = (userId: string) => db.select().from(member).where(eq(member.userId, userId));

describe("applyLoginOrganizations", () => {
  it("adds, updates and removes the user's memberships in mirrored organizations only", async () => {
    await applyOrganizationSnapshot(
      org("org_a", [owner, dev], [{ id: "team_a", name: "A", createdAt: T, members: [] }]),
      1
    );
    await applyOrganizationSnapshot(org("org_b"), 2);
    const devId = (await localUserBySub("sub_dev"))!;

    await applyLoginOrganizations({
      sub: "sub_dev",
      email: "dev@test.local",
      organizations: [
        { id: "org_b", slug: "org_b", name: "org_b", role: "admin", teams: [] }, // new membership
        { id: "org_a", slug: "org_a", name: "org_a", role: "admin", teams: [{ id: "team_a", name: "A" }] }, // role + team
        { id: "org_unknown", slug: "x", name: "x", role: "owner", teams: [] }, // not mirrored → ignored
      ],
    });

    const ms = await membershipsOf(devId);
    expect(ms.map(m => [m.organizationId, m.role]).sort()).toEqual([
      ["org_a", "admin"],
      ["org_b", "admin"],
    ]);
    expect(await db.select().from(teamMember).where(eq(teamMember.userId, devId))).toMatchObject([
      { teamId: "team_a" },
    ]);
    expect(await db.select().from(organization).where(eq(organization.id, "org_unknown"))).toEqual([]);

    // Claim no longer lists org_a: membership (and team) dropped.
    await applyLoginOrganizations({
      sub: "sub_dev",
      organizations: [{ id: "org_b", slug: "org_b", name: "org_b", role: "member", teams: [] }],
    });
    expect((await membershipsOf(devId)).map(m => [m.organizationId, m.role])).toEqual([["org_b", "member"]]);
    expect(await db.select().from(teamMember).where(eq(teamMember.userId, devId))).toEqual([]);
  });

  it("never re-adds members to a deactivated organization", async () => {
    await applyOrganizationSnapshot(org("org_a", [owner, dev]), 1);
    await deactivateOrganization("org_a", 2);
    const devId = (await localUserBySub("sub_dev"))!;

    await applyLoginOrganizations({
      sub: "sub_dev",
      organizations: [{ id: "org_a", slug: "org_a", name: "org_a", role: "owner", teams: [] }],
    });
    expect(await membershipsOf(devId)).toEqual([]);
  });

  it("resolves a pre-SSO user by email and is a no-op for unknown users or a missing claim", async () => {
    await applyOrganizationSnapshot(org("org_a"), 1);
    await db.insert(user).values({
      id: "local_dev",
      name: "Dev",
      email: "dev@test.local",
      emailVerified: false,
      createdAt: T,
      updatedAt: T,
    });

    await applyLoginOrganizations({
      sub: "sub_dev",
      email: "dev@test.local",
      organizations: [{ id: "org_a", slug: "org_a", name: "org_a", role: "member", teams: [] }],
    });
    expect((await membershipsOf("local_dev")).length).toBe(1);

    await applyLoginOrganizations({ sub: "sub_ghost", email: "ghost@test.local", organizations: [] });
    await applyLoginOrganizations({ sub: "sub_dev", email: "dev@test.local" }); // scope not granted → untouched
    expect((await membershipsOf("local_dev")).length).toBe(1);
    expect((await db.select().from(orgSync)).length).toBe(1);
  });
});
