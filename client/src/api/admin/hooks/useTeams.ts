import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTeams,
  updateTeamSites,
  UpdateTeamInput,
  ListTeamsResponse,
} from "../endpoints/teams";

export const TEAMS_QUERY_KEY = "teams";

export function useTeams(organizationId?: string) {
  return useQuery<ListTeamsResponse>({
    queryKey: [TEAMS_QUERY_KEY, organizationId],
    queryFn: () => fetchTeams(organizationId!),
    enabled: !!organizationId,
  });
}

export function useUpdateTeamSites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      organizationId,
      teamId,
      data,
    }: {
      organizationId: string;
      teamId: string;
      data: UpdateTeamInput;
    }) => updateTeamSites(organizationId, teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEAMS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["get-sites-from-org"] });
    },
  });
}

