import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";

// Better Auth's own endpoints: /api/auth/sign-up/email, /sign-in/email, /sign-out, /get-session, ...
export const { GET, POST } = toNextJsHandler((request: Request) => getAuth().handler(request));
