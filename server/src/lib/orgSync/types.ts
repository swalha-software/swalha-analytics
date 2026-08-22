// Wire types of the SWALHA Auth organization sync (docs/sync-contract.md in
// the swalha-auth repo). Auth is the source of truth; these are mirrored.

export type SnapshotMember = {
  /** Auth user id (= OIDC `sub`) */
  userId: string;
  email: string;
  name: string;
  image: string | null;
  role: string; // owner | admin | member
  since: string;
};

export type SnapshotTeam = {
  id: string;
  name: string;
  createdAt: string;
  /** Auth user ids, all present in `members` */
  members: string[];
};

export type OrganizationSnapshot = {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  createdAt: string;
  members: SnapshotMember[];
  teams: SnapshotTeam[];
};

export type OrganizationTombstone = {
  id: string;
  slug: string | null;
  name: string | null;
  deleted: true;
};

export type SyncEventType =
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "organization.members_changed"
  | "organization.teams_changed"
  | "organization.access_granted"
  | "organization.access_revoked"
  | "organization.snapshot";

export type SyncEvent = {
  id: string;
  version: number;
  type: SyncEventType;
  created_at: string;
  organization: OrganizationSnapshot | OrganizationTombstone;
};

/** `organizations` claim on /oauth2/userinfo (scope `organizations`). */
export type UserinfoOrganization = {
  id: string;
  slug: string;
  name: string;
  role: string;
  teams: { id: string; name: string }[];
};

export function isTombstone(o: OrganizationSnapshot | OrganizationTombstone): o is OrganizationTombstone {
  return (o as OrganizationTombstone).deleted === true;
}
