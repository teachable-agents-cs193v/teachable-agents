// Shared by playwright.auth.config.ts and the auth specs. Test-only values; none
// of these passwords is anyone's real password.
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export const APP_PORT = 3211;
export const MOCK_PORT = 3212;
export const APP_URL = `http://localhost:${APP_PORT}`;
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;
/** Where e2e-auth/webServer.ts sends the auth suite's next dev output. */
export const SERVER_LOG = path.join(os.tmpdir(), `teachable-e2e-server-${APP_PORT}.log`);

export const sha1 = (s: string) => crypto.createHash("sha1").update(s, "utf8").digest("hex").toUpperCase();

/** All strong enough for zxcvbn, so the mock breach API decides their fate by hash prefix. */
export const PASSWORDS = {
  strong: "lantern-quokka-marigold-zephyr",
  breached: "test-only-breached-sundial-otter",
  breachCheckDown: "test-only-unreachable-kelp-falcon",
  weak: "Password1",
};
