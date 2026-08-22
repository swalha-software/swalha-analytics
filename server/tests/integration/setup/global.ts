import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Creates the test database if needed and applies the committed migrations.
export default async function setup() {
  const host = process.env.POSTGRES_HOST!;
  const port = Number(process.env.POSTGRES_PORT);
  const database = process.env.POSTGRES_DB!;
  const username = process.env.POSTGRES_USER!;
  const password = process.env.POSTGRES_PASSWORD!;

  const admin = postgres({ host, port, database: "postgres", username, password, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = ${database}`;
  if (exists.length === 0) await admin.unsafe(`create database "${database}"`);
  await admin.end();

  const client = postgres({ host, port, database, username, password, onnotice: () => {}, max: 1 });
  // sites.id defaults to gen_random_bytes(), which needs pgcrypto.
  await client`create extension if not exists pgcrypto`;
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
}
