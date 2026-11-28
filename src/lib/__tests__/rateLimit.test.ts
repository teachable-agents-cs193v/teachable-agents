// The Postgres-backed rate limiter (src/lib/rateLimit.ts, #58), against the throwaway Postgres.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getPool } from "@/lib/db/pool";
import { hasDb } from "@/lib/auth/__tests__/testHelpers";
import { hitRateLimit, RATE_LIMITS } from "../rateLimit";

async function newUser(): Promise<string> {
  const id = `user_${randomUUID()}`;
  await getPool().query(`insert into users (id, name, email, "emailVerified") values ($1, 'Test', $2, false)`, [
    id,
    `${id}@example.com`,
  ]);
  return id;
}

const hit = (userId: string, limits = [{ max: 3, windowSeconds: 3600 }]) =>
  hitRateLimit(userId, "session_create", getPool(), limits);

describe.skipIf(!hasDb)("hitRateLimit", () => {
  it("allows up to max requests per window, then refuses with when to retry", async () => {
    const user = await newUser();
    for (let i = 0; i < 3; i++) expect(await hit(user)).toEqual({ ok: true });
    const refused = await hit(user);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.retryAfterSeconds).toBeGreaterThan(0);
      expect(refused.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });

  it("counts each user and each action separately", async () => {
    const alice = await newUser();
    const bob = await newUser();
    for (let i = 0; i < 4; i++) await hit(alice);
    expect(await hit(bob)).toEqual({ ok: true });
    expect(await hitRateLimit(alice, "session_update", getPool(), [{ max: 3, windowSeconds: 3600 }])).toEqual({ ok: true });
  });

  it("refuses when any one of several limits is exceeded", async () => {
    const user = await newUser();
    const limits = [
      { max: 100, windowSeconds: 60 },
      { max: 2, windowSeconds: 86_400 },
    ];
    await hit(user, limits);
    await hit(user, limits);
    const refused = await hit(user, limits);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.retryAfterSeconds).toBeGreaterThan(60); // the day's window, not the minute's
  });

  it("is atomic: concurrent requests can't all slip under the limit", async () => {
    const user = await newUser();
    const results = await Promise.all(Array.from({ length: 10 }, () => hit(user)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
  });

  it("starts counting again in a new window and deletes the expired rows", async () => {
    const user = await newUser();
    for (let i = 0; i < 4; i++) await hit(user);
    // Move this user's window into the past, as if the hour had ended.
    await getPool().query("update rate_limit_counts set window_start = window_start - interval '2 hours' where user_id = $1", [user]);
    expect(await hit(user)).toEqual({ ok: true });
    const { rows } = await getPool().query("select count from rate_limit_counts where user_id = $1", [user]);
    expect(rows).toEqual([{ count: 1 }]);
  });

  it("has limits for the session routes", () => {
    expect(RATE_LIMITS.session_create.length).toBeGreaterThan(0);
    expect(RATE_LIMITS.session_update.length).toBeGreaterThan(0);
  });
});
