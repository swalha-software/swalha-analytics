import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  apply: vi.fn(),
  deactivate: vi.fn(),
}));

vi.mock("../../lib/orgSync/provider.js", () => ({ verifyWebhookSignature: mocks.verify }));
vi.mock("../../lib/orgSync/apply.js", () => ({
  applyOrganizationSnapshot: mocks.apply,
  deactivateOrganization: mocks.deactivate,
}));
vi.mock("../../lib/logger/logger.js", () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { handleOrganizationSyncWebhook } from "./webhook.js";

async function call(body: unknown, headers: Record<string, string> = { "x-swalha-signature": "sig" }) {
  const reply: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  const request: any = { body: typeof body === "string" ? Buffer.from(body) : body, headers };
  await handleOrganizationSyncWebhook(request, reply);
  return { status: reply.status.mock.calls[0]?.[0], body: reply.send.mock.calls[0]?.[0] };
}

const snapshot = { id: "org_1", slug: "one", name: "One", logo: null, createdAt: "x", members: [], teams: [] };
const envelope = (type: string, organization: unknown = snapshot, version = 7) =>
  JSON.stringify({ id: "evt", version, type, created_at: "x", organization });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ jti: "d", event: "evt", sha256: "h" });
  mocks.apply.mockResolvedValue({ applied: true });
  mocks.deactivate.mockResolvedValue({ applied: true });
});

describe("organization sync webhook", () => {
  it("requires a raw JSON body and a signature header", async () => {
    expect((await call({ parsed: true })).status).toBe(400);
    expect((await call(envelope("organization.updated"), {})).status).toBe(401);
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature with 401 before parsing", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("bad"));
    expect((await call("not json")).status).toBe(401);
  });

  it("rejects a malformed envelope with 400", async () => {
    expect((await call("not json")).status).toBe(400);
    expect((await call(JSON.stringify({ id: "evt", type: "organization.updated" }))).status).toBe(400);
  });

  it("applies snapshots with the event version", async () => {
    const r = await call(envelope("organization.members_changed"));
    expect(r.status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith(snapshot, 7);
    expect(mocks.deactivate).not.toHaveBeenCalled();
  });

  it("deactivates on tombstones and access revocation", async () => {
    await call(envelope("organization.deleted", { id: "org_1", slug: "one", name: "One", deleted: true }));
    await call(envelope("organization.access_revoked", snapshot, 8));
    expect(mocks.deactivate).toHaveBeenNthCalledWith(1, "org_1", 7);
    expect(mocks.deactivate).toHaveBeenNthCalledWith(2, "org_1", 8);
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("answers 500 when applying fails so Auth retries", async () => {
    mocks.apply.mockRejectedValueOnce(new Error("db down"));
    expect((await call(envelope("organization.updated"))).status).toBe(500);
  });
});
