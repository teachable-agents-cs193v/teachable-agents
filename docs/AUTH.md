# Authentication contract

*Owner: Anahi (auth). Database sections need review from Betania (DB owner).*
*Status: agreed design. Nothing here is implemented yet.*

## Summary

Students make an account with their name, email and password, then log in and log out. Every teaching page, and every API route behind it, requires a logged-in user. Each teaching session belongs to exactly one user, and nobody else can read or change it.

If you write code that touches student data:

1. In an API route, call `requireApiUser()` first.
2. Read and write data only through the user-scoped store, `getUserSessionStore(user)`. It adds the user filter to every query for you. Never take a user ID from the browser.

## Scope

- **In scope:** email and password signup, login and logout. Sessions are stored in the database, so logging out really ends them.
- **Out of scope:** OAuth/social login, 2FA, password reset, email verification.
- **Library:** [Better Auth](https://www.better-auth.com/), pinned to exactly `better-auth@1.7.14`. Better Auth handles password hashing, session tokens and cookies; we don't write our own.

## Signup and the password policy

Signup asks for **name**, **email** and **password**. The form uses the existing `Field`, `inputClasses` and `Button` from `src/components/ui/`. Before anything is created, the server checks the password:

1. **Strength:** [zxcvbn](https://github.com/dropbox/zxcvbn) must score it at least 3 out of 4. The student's name, email and site words such as "protege" and "pip" count against it.
2. **Breaches:** checked against [Pwned Passwords](https://haveibeenpwned.com/Passwords). The password never leaves our server; only the first 5 characters of its SHA-1 hash are sent. If the check can't complete, signup is refused.

These rules are enforced on the server. The form's live strength feedback is only for usability.

| Error code | HTTP | Meaning |
|---|---|---|
| `weak_password` | 422 | Strength score below 3. The response includes a `warning` and up to 4 `suggestions`. |
| `breached_password` | 422 | The password appears in a known breach. |
| `breach_check_unavailable` | 503 | The breach check couldn't complete. Nothing was created; try again later. |

A failed login always gets the same generic error, whether or not the email exists.

## How your code gets the current user

These helpers live in `src/lib/auth/server.ts`, which imports `server-only`, so the build fails if a client component imports it. `AuthUser` will be defined in `src/lib/types.ts` with the other shared types.

```ts
type AuthUser = { id: string; email: string; name: string };

getCurrentUser(): Promise<AuthUser | null>     // null when logged out
requireUser(): Promise<AuthUser>               // pages: redirects to /login?next=<path> if logged out
requireApiUser(): Promise<AuthUser | Response> // API routes: returns a 401 JSON Response if logged out
```

`getCurrentUser()` is wrapped in React `cache()`, so it looks up the session at most once per request. The other two call it. Always use these helpers rather than calling Better Auth directly.

### Example: protecting an API route

```ts
// src/app/api/sessions/[id]/route.ts
import { requireApiUser } from "@/lib/auth/server";
import { getUserSessionStore } from "@/lib/persistence/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof Response) return user; // 401, not logged in

  const { id } = await params;
  const session = await getUserSessionStore(user).getSession(id); // null if missing OR another user's
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(session);
}
```

### Example: protecting a page

Add two lines to the existing `src/app/teach/[sessionId]/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth/server";   // add

export default async function TeachPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireUser();                              // add: redirects to /login if logged out
  const { sessionId } = await params;
  return <TeachingWorkspace sessionId={sessionId} />;
}
```

The page check is a redirect for usability. **The API routes are the security boundary**, because that's where the data is. In client components, `useSession()` from the auth client is only for display, such as showing the student's name in the `Navbar`.

## What is protected

| Pages (redirect to `/login`) | API routes (respond 401) |
|---|---|
| `/learner/[topicId]` (Start Teaching creates a session) | `/api/sessions` and everything under it |
| `/teach/[sessionId]` | `/api/learner` and everything under it |
| `/reflect/[sessionId]` | any new route that reads or writes student data |
| `/sessions`, `/sessions/[sessionId]` | |

These stay public: `/`, `/topics`, `/login`, `/signup`, and Better Auth's own `/api/auth/*` endpoints.

Any early redirect in `proxy.ts` (Next 16's new name for `middleware.ts`) is a convenience only. It checks for the cookie, not the database, so pages and routes must still call the helpers.

## Ownership rules

These are enforced inside the user-scoped store, so routes get them for free. They're listed here so the store's implementation and tests can be checked against them.

1. **The server decides who owns data.** The owner is the `user` passed to `getUserSessionStore(user)`. Any user ID the browser sends is ignored.
2. **Every query is filtered by `user_id`**: reads, lists, updates and deletes. Messages and reflections are reached through their teaching session, so they're scoped the same way.
3. **Another user's record looks like a missing one.** The store returns `null`, and routes respond **404**, not 403, so IDs can't be probed.
4. **The server generates IDs** for new records. Saving updates only rows the user already owns; the store never trusts an ID the browser made up.

### Proposed: a user-scoped session store

*Proposed; Betania owns the final design.* Today `getSessionStore()` in `src/lib/persistence/` returns a browser-side localStorage store. The proposal:

- **Server:** `getUserSessionStore(user: AuthUser)` in `src/lib/persistence/server.ts` (server-only) implements the existing `SessionStore` interface against Postgres, with the rules above built in. It needs one new method that generates the ID, such as `createSession(topicId, preExplanation?)`.
- **Browser:** `getSessionStore()` keeps the same `SessionStore` interface but becomes an HTTP client for `/api/sessions`. Components don't change.

## Database

**Access.** Queries go through one shared `pg` Pool (module-level, cached on `globalThis` in development), which Better Auth also uses. It reads `DATABASE_URL`, which is server-only. On Vercel, use Neon's **pooled** connection string and a small pool (`max` of about 3) so serverless instances don't run out of connections. The pool connects lazily, so `next build` and CI never need a database.

**Auth tables.** These are Better Auth's built-in models, renamed in config so they don't collide with teaching sessions or the reserved word `user`. App code may read `users.id`, `users.name` and `users.email`, and nothing else; never select `auth_account.password`.

| Table | Better Auth model | Key columns |
|---|---|---|
| `users` | `user` | `id text pk`, `name text not null`, `email text unique not null` (stored lowercase), `emailVerified bool`, `image text`, `createdAt`, `updatedAt` |
| `auth_session` | `session` | `id`, `token unique`, `userId → users.id on delete cascade`, `expiresAt`, `ipAddress`, `userAgent`, timestamps |
| `auth_account` | `account` | `id`, `accountId`, `providerId` (always `credential`), `userId → users.id`, `password` (the hash), timestamps, plus unused OAuth columns |
| `auth_verification` | `verification` | `id`, `identifier`, `value`, `expiresAt`, timestamps. Unused for now, but Better Auth expects it. |

Better Auth's default column names are camelCase, as above. They can be mapped to snake_case in config if Betania prefers (see the open questions).

**Migrations.** Schema changes are checked-in `.sql` files generated by the Better Auth CLI, pinned to `npx auth@1.7.14 generate`. (The old `@better-auth/cli` package stopped at 1.4.x; don't use it.)

- The generator connects to the database in `DATABASE_URL` and writes only the difference. **Generate and test migrations only against an empty throwaway local Postgres, never Neon.**
- **Neon is changed only by hand**, as a manual step that Anahi and Betania both approve. CI and coding agents never apply migrations to Neon. The deployed app needs these tables before signup can work there.

**Teaching data (proposed; Betania owns the final schema).**

```sql
-- teaching_sessions
user_id text not null references users(id) on delete cascade
-- plus an index on (user_id, started_at desc)
```

Messages and reflections either live in that row or reference it by foreign key, so they inherit its owner.

## Environment variables

All are server-only; none may start with `NEXT_PUBLIC_`. Real values go in `.env.local` (gitignored) or Vercel's settings; `.env.example` gets placeholders only.

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Signs session cookies. At least 32 random characters, different per environment. |
| `BETTER_AUTH_URL` | The app's base URL (e.g. `http://localhost:3000`), used for origin checks on auth endpoints. |
| `DATABASE_URL` | Postgres connection string. On Vercel, Neon's pooled string. |
| `PWNED_PASSWORDS_API_URL` | Optional. Tests point it at a local mock; leave it unset everywhere else. |

## Known limitations / possible later work

- **Signup reveals registered emails.** Without email verification, signing up with an existing email says so. Accepted while verification is out of scope.
- **Rate limiting is per server instance.** Better Auth's default in-memory rate limiting is on in production, but counts aren't shared across Vercel instances. Database-backed storage is possible later work.
- **Non-auth API routes have no origin check yet.** Better Auth checks the origin on its own endpoints. Our own POST/PUT/DELETE routes rely on the `SameSite=Lax` session cookie for now. A shared same-origin check is possible later work.
- **Vercel preview URLs** may need adding to Better Auth's `trustedOrigins` before login works on previews.

## Open questions for Betania

1. Are the auth table names (`users`, `auth_session`, `auth_account`, `auth_verification`) OK? Should their columns be mapped to snake_case to match `teaching_sessions`?
2. Do you agree with the user-scoped store above (`getUserSessionStore(user)` plus a `createSession` method), or would you rather scope data another way?
3. Will you use plain `pg` for teaching data too, or an ORM/query builder? Better Auth has Drizzle and Prisma adapters, so this doc can change to match.
4. Should messages and reflections be JSON in `teaching_sessions` or separate tables?
5. Where should migration files live (e.g. `db/migrations/`), and who applies them to Neon, and when? The generated migration should also index `auth_session.userId` and `auth_account.userId`; we'll check it does.
6. Do you want separate Neon branches (dev / preview / production), each with its own `DATABASE_URL`?
