import type { OrgRole, Permission } from "@rybbit/shared";
import { authedFetch } from "../../utils";

export type UserOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: string;
  metadata: string | null;
  role: OrgRole;
  /** What that role allows in the organization. Read through useOrgPermissions, not directly. */
  permissions: Permission[];
  /** Roles the user may give when inviting or editing members, highest first. */
  assignableRoles: OrgRole[];
};

export const USER_ORGANIZATIONS_QUERY_KEY = "userOrganizations";

export function getUserOrganizations(): Promise<UserOrganization[]> {
  return authedFetch("/user/organizations");
}
