import { authedFetch } from "../../utils";

export type TeamMember = {
  userId: string;
  userName: string | null;
  userEmail: string;
};

export type TeamSite = {
  siteId: number;
  domain: string;
  name: string;
};

export type Team = {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string | null;
  members: TeamMember[];
  sites: TeamSite[];
};

export type ListTeamsResponse = {
  teams: Team[];
};

// Team name and membership are owned by SWALHA Auth; Analytics only assigns sites.
export type UpdateTeamInput = {
  siteIds: number[];
};

export function fetchTeams(organizationId: string) {
  return authedFetch<ListTeamsResponse>(
    `/organizations/${organizationId}/teams`
  );
}

// Mirrors the member site-access route: only site assignment is Analytics-owned.
export function updateTeamSites(
  organizationId: string,
  teamId: string,
  data: UpdateTeamInput
) {
  return authedFetch<{ success: boolean }>(
    `/organizations/${organizationId}/teams/${teamId}/sites`,
    undefined,
    {
      method: "PUT",
      data,
      headers: { "Content-Type": "application/json" },
    }
  );
}
