import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RybbitApiClient } from "../apiClient.js";
import { memberRoleInput, organizationIdInput } from "../inputs.js";
import {
  idempotentWrite,
  looseRows,
  ok,
  readOnly,
  writeTool,
  type ScopeCheck, type ToolGuard,
} from "./shared.js";

const membersOutput = z.object({ success: z.boolean(), data: looseRows.optional() }).partial().passthrough();

const addMemberOutput = z.object({ message: z.string() }).partial().passthrough();

const memberSiteAccessOutput = z
  .object({ memberId: z.string(), hasRestrictedSiteAccess: z.boolean(), siteAccess: looseRows.optional() })
  .partial()
  .passthrough();

export function registerOrganizationTools(server: McpServer, api: RybbitApiClient, guard: ToolGuard, allowed: ScopeCheck): void {
  if (allowed("org", "read"))
  server.registerTool(
    "list_members",
    {
      title: "List organization members",
      description:
        "Members of an organization with their role and restricted-site access. member_id (the membership record) is what update_member_site_access takes.",
      inputSchema: { organization_id: organizationIdInput },
      outputSchema: membersOutput,
      annotations: readOnly,
    },
    guard(async ({ organization_id }) =>
      ok(await api.call("GET", `/organizations/${encodeURIComponent(organization_id)}/members`))
    )
  );

  if (allowed("org", "write"))
  server.registerTool(
    "add_member",
    {
      title: "Add organization member",
      description:
        "Add an existing Rybbit user to the organization by email. The user must already have a Rybbit account. Requires an org admin/owner key; only an owner key can grant the owner role.",
      inputSchema: {
        organization_id: organizationIdInput,
        email: z.string().email().describe("Email of an existing Rybbit user"),
        role: memberRoleInput,
      },
      outputSchema: addMemberOutput,
      annotations: writeTool,
    },
    guard(async ({ organization_id, email, role }) =>
      ok(await api.call("POST", `/organizations/${encodeURIComponent(organization_id)}/members`, { body: { email, role } }))
    )
  );

  if (allowed("org", "write"))
  server.registerTool(
    "update_member_site_access",
    {
      title: "Update member site access",
      description:
        "Restrict a member to specific sites, or lift the restriction. Applies to member-role users only (admins/owners always see all sites). Requires an org admin/owner key.",
      inputSchema: {
        organization_id: organizationIdInput,
        member_id: z.string().min(1).describe("Membership record id from list_members (not the user id)"),
        has_restricted_site_access: z.boolean().describe("true = member sees only site_ids; false = member sees all org sites"),
        site_ids: z.array(z.number().int().positive()).describe("Sites the member may access when restricted"),
      },
      outputSchema: memberSiteAccessOutput,
      annotations: idempotentWrite,
    },
    guard(async ({ organization_id, member_id, has_restricted_site_access, site_ids }) =>
      ok(
        await api.call(
          "PUT",
          `/organizations/${encodeURIComponent(organization_id)}/members/${encodeURIComponent(member_id)}/sites`,
          { body: { hasRestrictedSiteAccess: has_restricted_site_access, siteIds: site_ids } }
        )
      )
    )
  );
}
