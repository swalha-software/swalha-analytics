// Exports every organization (members, teams) as JSON for the one-time import
// into SWALHA Auth (auth.swalha.com), which becomes the source of truth for
// organizations. Ids are preserved so the Auth → Analytics sync keys match.
//
// Each member is resolved to their Auth user id (`sub`) through the `account`
// row written by the `swalha` SSO provider. Members without one (never signed
// in since the SSO cutover) are listed in the report so they can be handled
// (pre-provisioned in Auth or re-invited there) before the import.
//
// Read-only. Usage:
//   tsc && node dist/scripts/exportOrganizationsForAuth.js --out orgs-export.json

import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../db/postgres/postgres.js";
import { account, member, organization, team, teamMember, user } from "../db/postgres/schema.js";

const SSO_PROVIDER_ID = "swalha";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

const outPath = arg("--out");
if (!outPath) {
  console.error("Usage: node dist/scripts/exportOrganizationsForAuth.js --out orgs-export.json");
  process.exit(1);
}

type ExportedMember = {
  id: string; // analytics member id (preserved)
  userId: string; // analytics user id
  sub: string | null; // Auth user id, null = not linked to SSO yet
  email: string;
  name: string;
  image: string | null;
  role: string;
  createdAt: string;
};

type ExportedTeam = {
  id: string;
  name: string;
  createdAt: string;
  members: { id: string; userId: string; sub: string | null }[];
};

type ExportedOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: string;
  members: ExportedMember[];
  teams: ExportedTeam[];
};

async function main() {
  const orgs = await db.select().from(organization).orderBy(organization.createdAt);

  const members = await db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      email: user.email,
      name: user.name,
      image: user.image,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId));

  const ssoAccounts = await db
    .select({ userId: account.userId, sub: account.accountId })
    .from(account)
    .where(eq(account.providerId, SSO_PROVIDER_ID));
  const subByUserId = new Map(ssoAccounts.map(a => [a.userId, a.sub]));

  const teams = await db.select().from(team);
  const teamMembers = await db.select().from(teamMember);

  const exported: ExportedOrganization[] = orgs.map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    createdAt: org.createdAt,
    members: members
      .filter(m => m.organizationId === org.id)
      .map(m => ({
        id: m.id,
        userId: m.userId,
        sub: subByUserId.get(m.userId) ?? null,
        email: m.email,
        name: m.name,
        image: m.image,
        role: m.role,
        createdAt: m.createdAt,
      })),
    teams: teams
      .filter(t => t.organizationId === org.id)
      .map(t => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        members: teamMembers
          .filter(tm => tm.teamId === t.id)
          .map(tm => ({ id: tm.id, userId: tm.userId, sub: subByUserId.get(tm.userId) ?? null })),
      })),
  }));

  writeFileSync(outPath!, JSON.stringify({ exportedAt: new Date().toISOString(), organizations: exported }, null, 2));

  // Report
  const allMembers = exported.flatMap(o => o.members.map(m => ({ org: o.slug, ...m })));
  const unlinked = allMembers.filter(m => !m.sub);
  const unlinkedOwners = unlinked.filter(m => m.role === "owner");
  const orgsWithoutLinkedOwner = exported.filter(o => !o.members.some(m => m.role === "owner" && m.sub));

  console.log(`Wrote ${outPath}`);
  console.log(`Organizations: ${exported.length}`);
  console.log(
    `Members:       ${allMembers.length} (${allMembers.length - unlinked.length} linked to Auth, ${unlinked.length} unlinked)`
  );
  console.log(`Teams:         ${teams.length} (${teamMembers.length} team memberships)`);

  if (unlinked.length) {
    console.log("\nUnlinked members (no SSO account — will be skipped by the import unless handled first):");
    for (const m of unlinked) console.log(`  ${m.org.padEnd(24)} ${m.role.padEnd(7)} ${m.email}`);
  }
  if (unlinkedOwners.length) console.log(`\n${unlinkedOwners.length} of the unlinked members are owners.`);
  if (orgsWithoutLinkedOwner.length) {
    console.log("\nOrganizations with NO linked owner (would be imported without an owner):");
    for (const o of orgsWithoutLinkedOwner) console.log(`  ${o.slug}`);
  }

  process.exit(0);
}

void main();
