import { beforeEach } from "vitest";
import { sql } from "../../../src/db/postgres/postgres.js";

// Every test starts from empty identity/organization tables (cascades cover
// member, account, team, site access, org_sync, sites…).
beforeEach(async () => {
  await sql`truncate "user", organization, apikey cascade`;
});
