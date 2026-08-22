import { authedFetch } from "../../utils";

export type UserOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: string;
  metadata: string | null;
  role: string;
};

export const USER_ORGANIZATIONS_QUERY_KEY = "userOrganizations";

export function getUserOrganizations(): Promise<UserOrganization[]> {
  return authedFetch("/user/organizations");
}
