// Keeps db/migrations/0001_auth.sql in step with the Better Auth config. Runs
// against a fresh database inside the throwaway Postgres from
// test/postgres.globalSetup.ts; never against Neon.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authSchemaOptions } from "@/lib/auth/options";
import { hasDb } from "@/lib/auth/__tests__/testHelpers";

const MIGRATION_SQL = readFileSync(new URL("../../../../db/migrations/0001_auth.sql", import.meta.url), "utf8");
const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe.skipIf(!hasDb)("db/migrations/0001_auth.sql", () => {
  const dbName = `drift_${randomUUID().replace(/-/g, "")}`;
  let admin: Pool;
  let pool: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${dbName}`;
    pool = new Pool({ connectionString: url.toString() });
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.end();
  });

  it("matches what the current config generates for an empty database (run npm run db:generate if not)", async () => {
    const { compileMigrations } = await getMigrations(authSchemaOptions(pool));
    expect(normalize(MIGRATION_SQL)).toBe(normalize(await compileMigrations()));
  });

  it("applies cleanly and leaves nothing for Better Auth to add", async () => {
    await pool.query(MIGRATION_SQL);
    const { toBeCreated, toBeAdded, toBeAddedIndexes } = await getMigrations(authSchemaOptions(pool));
    expect({ toBeCreated, toBeAdded, toBeAddedIndexes }).toEqual({ toBeCreated: [], toBeAdded: [], toBeAddedIndexes: [] });
  });

  it("indexes the userId foreign keys and cascades deletes from users", async () => {
    const sql = normalize(MIGRATION_SQL);
    expect(sql).toContain(`create index "auth_session_userId_idx" on "auth_session" ("userId")`);
    expect(sql).toContain(`create index "auth_account_userId_idx" on "auth_account" ("userId")`);
    expect(sql.match(/references "users" \("id"\) on delete cascade/g)).toHaveLength(2);
  });
});
