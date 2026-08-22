import { eq, and, inArray } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/postgres/postgres.js";
import { team, teamMember, teamSiteAccess, sites } from "../../db/postgres/schema.js";
import { invalidateSitesAccessCache } from "../../lib/sitesAccessCache.js";

// Team → site grants are Analytics permissions (the team itself and its
// members are mirrored from SWALHA Auth). Replaces the team's site set.
export async function updateTeamSites(
  request: FastifyRequest<{
    Params: { organizationId: string; teamId: string };
    Body: { siteIds: number[] };
  }>,
  reply: FastifyReply
) {
  const { organizationId, teamId } = request.params;
  const siteIds = request.body?.siteIds;
  if (!Array.isArray(siteIds) || siteIds.some(id => typeof id !== "number")) {
    return reply.status(400).send({ error: "siteIds must be an array of site ids" });
  }

  try {
    const [teamRecord] = await db
      .select({ id: team.id })
      .from(team)
      .where(and(eq(team.id, teamId), eq(team.organizationId, organizationId)))
      .limit(1);
    if (!teamRecord) {
      return reply.status(404).send({ error: "Team not found" });
    }

    if (siteIds.length > 0) {
      const orgSites = await db
        .select({ siteId: sites.siteId })
        .from(sites)
        .where(and(eq(sites.organizationId, organizationId), inArray(sites.siteId, siteIds)));
      const validSiteIds = new Set(orgSites.map(s => s.siteId));
      const invalidSiteIds = siteIds.filter(id => !validSiteIds.has(id));
      if (invalidSiteIds.length > 0) {
        return reply.status(400).send({ error: `Sites not in organization: ${invalidSiteIds.join(", ")}` });
      }
    }

    await db.transaction(async tx => {
      await tx.delete(teamSiteAccess).where(eq(teamSiteAccess.teamId, teamId));
      if (siteIds.length > 0) {
        await tx.insert(teamSiteAccess).values(siteIds.map(siteId => ({ teamId, siteId })));
      }
    });

    const members = await db
      .select({ userId: teamMember.userId })
      .from(teamMember)
      .where(eq(teamMember.teamId, teamId));
    for (const m of members) invalidateSitesAccessCache(m.userId);

    return reply.status(200).send({ success: true });
  } catch (error) {
    request.log.error({ err: error }, "Error updating team sites");
    return reply.status(500).send({ error: "Failed to update team sites" });
  }
}
