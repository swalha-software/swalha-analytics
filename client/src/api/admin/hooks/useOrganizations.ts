import { useQuery } from "@tanstack/react-query";
import { getUserOrganizations, USER_ORGANIZATIONS_QUERY_KEY } from "../endpoints";

export { USER_ORGANIZATIONS_QUERY_KEY } from "../endpoints";

export function useUserOrganizations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [USER_ORGANIZATIONS_QUERY_KEY],
    queryFn: getUserOrganizations,
    enabled: options?.enabled,
  });
}
