# Authentication contract

*Owner: Anahi (auth). Database sections need review from Betania (DB owner).*
*Status: agreed design. Nothing here is implemented yet.*

## Summary

Students make an account with their name, email and password, then log in and log out. Every teaching page and every API route behind it requires a logged-in user. Each teaching session belongs to exactly one user, and nobody else can read or change it.

If you write a page or API route that touches student data, you only need two things from this doc:

1. Call `requireUser()` (pages) or `requireApiUser()` (API routes) first.
2. Use the returned `user.id` to filter every database query. Never take a user ID from the browser.

## Scope

- **In scope:** email and password signup, login and logout. Sessions stored in the database, so logging out really ends them.
- **Out of scope:** OAuth/social login, 2FA, password reset, email verification.
- **Library:** [Better Auth](https://www.better-auth.com/), pinned to exactly `better-auth@1.7.14`, with its CLI pinned to `auth@1.7.14`. We pin a release at least two weeks old and update deliberately. The CLI used to be published as `@better-auth/cli`, which stopped at 1.4.x, so don't install that package.
- **We do not write our own** password hashing, session tokens or cookie signing. Better Auth handles them (scrypt hashing, a random session token, a signed httpOnly cookie).

## Signup and the password policy

Signup asks for **name**, **email** and **password**. The server checks the password before creating anything, in this order:

1. **Strength:** [zxcvbn](https://github.com/dropbox/zxcvbn) must score it at least 3 out of 4. The student's name, email and site words such as "protege" and "pip" count against it.
2. **Breaches:** we check it against [Pwned Passwords](https://haveibeenpwned.com/Passwords) using a k-anonymity range query. Only the first 5 hex characters of the password's SHA-1 hash leave our server. If the check can't complete, signup is refused. This is called failing closed.

The rules are ported from Anahi's A10 project and enforced on the server. The signup form shows the same strength feedback while the student types, but that's only for usability.

| Error code | HTTP | Meaning |
|---|---|---|
| `weak_password` | 422 | zxcvbn score below 3. The response includes a `warning` and up to 4 `suggestions`. |
| `breached_password` | 422 | The password appears in a known breach. |
| `breach_check_unavailable` | 503 | The breach API timed out, errored or sent a malformed response. Nothing was created; try again later. |

A failed login always gets the same generic error, whether or not the email exists.

## How your code gets the current user

All of these live in `src/lib/auth/server.ts`, which imports `server-only`. The build fails if a client component imports it.

```ts
type AuthUser = { id: string; email: string; name: string };

getCurrentUser(): Promise<AuthUser | null>     // null when logged out; cached per request
requireUser(): Promise<AuthUser>               // pages: redirects to /login?next=<path> if logged out
requireApiUser(): Promise<AuthUser | Response> // API routes: returns a 401 JSON Response if logged out
```

### Example: protecting an API route

```ts
// src/app/api/sessions/[id]/route.ts
import { requireApiUser } from "@/lib/auth/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof Response) return user; // 401, not logged in

  const { id } = await params;
  const session = await getTeachingSession({ id, userId: user.id }); // WHERE id = $1 AND user_id = $2
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(session);
}
```

### Example: protecting a page

```tsx
// src/app/teach/[sessionId]/page.tsx
import { requireUser } from "@/lib/auth/server";

export default async function TeachPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireUser(); // redirects to /login if logged out
  const { sessionId } = await params;
  return <TeachingWorkspace sessionId={sessionId} />;
}
```

In client components, `useSession()` from the auth client is only for display, such as showing the student's name in the `Navbar`. Never use it to decide what data a user may see.

## What is protected

| Pages (redirect to `/login`) | API routes (respond 401) |
|---|---|
| `/learner/[topicId]` (Start Teaching creates a session) | `/api/sessions` and everything under it |
| `/teach/[sessionId]` | `/api/learner` and everything under it |
| `/reflect/[sessionId]` | any new route that reads or writes student data |
| `/sessions`, `/sessions/[sessionId]` | |

These stay public: `/`, `/topics`, `/login`, `/signup`, and Better Auth's own `/api/auth/*` endpoints.

A `proxy.ts` file (Next 16's new name for `middleware.ts`) may redirect logged-out visitors early, based only on whether the session cookie is present. That's a convenience, not security: it doesn't check the database, so every page and route must still call the helpers above.

## Ownership rules

1. **The server decides who owns data.** `user_id` comes from `requireApiUser()`. Ignore any `userId` the browser sends, in the body, the query string or the URL.
2. **Filter every query by `user_id`**, including reads, updates and deletes, not just lists.
3. **Another user's record looks the same as a missing one:** respond **404**, not 403, so IDs can't be probed.
4. **The server generates IDs** for new records. Don't trust an ID the browser makes up, such as the current `createId()` output.

## Database

**Access.** Queries go through a plain `pg` Pool, which Better Auth also uses. It reads `DATABASE_URL`, which is server-only and never `NEXT_PUBLIC_`. The pool connects lazily, so `next build` and CI never need a database.

**Auth tables.** These are Better Auth's built-in models, renamed in config so they don't collide with teaching sessions or the reserved word `user`:

| Table | Better Auth model | Key columns |
|---|---|---|
| `users` | `user` | `id text pk`, `name text not null`, `email text unique not null` (stored lowercase), `emailVerified bool`, `image text`, `createdAt`, `updatedAt` |
| `auth_session` | `session` | `id`, `token unique`, `userId → users.id on delete cascade`, `expiresAt`, `ipAddress`, `userAgent`, timestamps |
| `auth_account` | `account` | `id`, `accountId`, `providerId` (always `credential`), `userId → users.id`, `password` (the hash; never selected outside Better Auth), timestamps, plus unused OAuth columns |
| `auth_verification` | `verification` | `id`, `identifier`, `value`, `expiresAt`, timestamps. Unused for now, but Better Auth expects it. |

**Migrations.** Schema changes are checked-in `.sql` files generated by the Better Auth CLI (`npx auth@1.7.14 generate`).

- The generator **connects to the database** in `DATABASE_URL` and writes only the difference. Always run it with `DATABASE_URL` pointing at an **empty throwaway local Postgres**, never at Neon.
- Tests apply migrations only to a throwaway local Postgres.
- **Neon is changed only by hand**, as a manual step that Anahi and Betania both approve. CI and coding agents never apply migrations to Neon. The deployed app needs these tables before signup can work there.

**Teaching data (proposed; Betania owns the final schema).**

```sql
-- teaching_sessions
user_id text not null references users(id) on delete cascade
-- plus an index on (user_id, started_at desc)
```

Messages and reflections either live in that row or reference it by foreign key, so they inherit its owner.

## Environment variables

All are server-only. Real values go in `.env.local` (gitignored) or Vercel's settings; `.env.example` gets placeholders only.

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Signs session cookies. At least 32 random characters; different per environment. |
| `BETTER_AUTH_URL` | The app's base URL (e.g. `http://localhost:3000`); used for origin checks on auth endpoints. |
| `DATABASE_URL` | Postgres connection string. |
| `PWNED_PASSWORDS_API_URL` | Optional. Tests point this at a local mock; leave it unset everywhere else. |

## Known limitations / possible later work

- **Signup reveals registered emails.** Without email verification, signing up with an existing email says so. Accepted while verification is out of scope.
- **Rate limiting is per server instance.** Better Auth's default in-memory rate limiting is on in production, but counts aren't shared across Vercel instances. Durable (database-backed) storage is possible later work.
- **Non-auth API routes have no origin check yet.** Better Auth checks the origin on its own endpoints. Our own POST/PUT/DELETE routes rely on the `SameSite=Lax` session cookie for now. A shared same-origin check is possible later work.
- **Vercel preview URLs** may need adding to Better Auth's `trustedOrigins` before login works on previews.

## Open questions for Betania

1. Are the four auth table names (`users`, `auth_session`, `auth_account`, `auth_verification`) OK, or do you have a naming convention to follow?
2. Will you use plain `pg` for teaching data too, or an ORM/query builder? Better Auth has Drizzle and Prisma adapters, so this doc can change to match.
3. Should messages and reflections be JSON in `teaching_sessions` or separate tables? Either way they need a path back to `user_id`.
4. Where should migration files live (e.g. `db/migrations/`), and who runs them against Neon, and when?
5. Do you want separate Neon branches (dev / preview / production), each with its own `DATABASE_URL`?
