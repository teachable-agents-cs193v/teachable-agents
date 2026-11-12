import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";
import { authAvailable, authUnavailableResponse } from "@/lib/auth/availability";

// Better Auth's own endpoints: /api/auth/sign-up/email, /sign-in/email, /sign-out, /get-session, ...
export const { GET, POST } = toNextJsHandler(async (request: Request) =>
  authAvailable() ? getAuth().handler(request) : authUnavailableResponse(request),
);
