import { createAuthClient } from "better-auth/react";

/**
 * Better Auth's browser client, for the login/signup forms and the Navbar (#13).
 * It calls /api/auth/* on the same site and holds no secrets. `useSession()` is
 * for display only; access is decided on the server (docs/AUTH.md).
 */
export const authClient = createAuthClient();
