// POST /api/sync/organizations — organization sync webhook from SWALHA Auth
// (swalha-auth docs/sync-contract.md). The route is registered with a raw
// (buffer) JSON parser so the signature can be checked over the exact bytes.
//
// Any non-2xx makes Auth retry with backoff, so: 401 for a bad signature,
// 400 for a malformed envelope, 500 when applying fails.

import { FastifyReply, FastifyRequest } from "fastify";
import { applyOrganizationSnapshot, deactivateOrganization } from "../../lib/orgSync/apply.js";
import { verifyWebhookSignature } from "../../lib/orgSync/provider.js";
import { isTombstone, type SyncEvent } from "../../lib/orgSync/types.js";
import { createServiceLogger } from "../../lib/logger/logger.js";

const log = createServiceLogger("org-sync");

export async function handleOrganizationSyncWebhook(request: FastifyRequest, reply: FastifyReply) {
  const rawBody = request.body;
  if (!Buffer.isBuffer(rawBody)) {
    return reply.status(400).send({ error: "Expected application/json body" });
  }
  const signature = request.headers["x-swalha-signature"];
  if (typeof signature !== "string") {
    return reply.status(401).send({ error: "Missing X-Swalha-Signature" });
  }

  try {
    await verifyWebhookSignature(signature, rawBody);
  } catch (err) {
    log.warn({ err, delivery: request.headers["x-swalha-delivery"] }, "Rejected organization sync webhook");
    return reply.status(401).send({ error: "Invalid signature" });
  }

  let event: SyncEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
    if (typeof event.version !== "number" || !event.organization?.id) throw new Error("bad envelope");
  } catch {
    return reply.status(400).send({ error: "Malformed event" });
  }

  try {
    const org = event.organization;
    const result =
      isTombstone(org) || event.type === "organization.access_revoked"
        ? await deactivateOrganization(org.id, event.version)
        : await applyOrganizationSnapshot(org, event.version);
    return reply.status(200).send({ ok: true, ...result });
  } catch (err) {
    log.error(
      { err, event: event.id, type: event.type, organizationId: event.organization.id },
      "Applying sync event failed"
    );
    return reply.status(500).send({ error: "Failed to apply event" });
  }
}
