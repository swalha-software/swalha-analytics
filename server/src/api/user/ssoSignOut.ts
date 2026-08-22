import { and, eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/postgres/postgres.js";
import { account } from "../../db/postgres/schema.js";
import { createServiceLogger } from "../../lib/logger/logger.js";
import { getDiscovery, SSO_PROVIDER_ID, syncConfig } from "../../lib/orgSync/provider.js";

const log = createServiceLogger("sso");

// Ends the user's SWALHA Auth session (RP-initiated logout) server-to-server,
// using the id_token stored at sign-in. Best effort: the local sign-out that
// follows on the client happens regardless, so a failure here only means the
// Auth session outlives this one.
export async function ssoSignOut(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.id;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const cfg = syncConfig();
  if (!cfg) return reply.status(200).send({ ended: false, reason: "sso_disabled" });

  const [link] = await db
    .select({ idToken: account.idToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, SSO_PROVIDER_ID)))
    .limit(1);
  if (!link?.idToken) return reply.status(200).send({ ended: false, reason: "no_id_token" });

  try {
    const { end_session_endpoint } = await getDiscovery();
    const url = new URL(end_session_endpoint);
    url.searchParams.set("id_token_hint", link.idToken);
    url.searchParams.set("client_id", cfg.clientId);
    const res = await fetch(url, { redirect: "manual" });
    if (!res.ok && res.status !== 302) {
      log.warn({ userId, status: res.status, body: await res.text() }, "Auth end-session refused");
      return reply.status(200).send({ ended: false, reason: "refused" });
    }
    return reply.status(200).send({ ended: true });
  } catch (err) {
    log.error({ err, userId }, "Auth end-session failed");
    return reply.status(200).send({ ended: false, reason: "error" });
  }
}
