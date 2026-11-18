import type { SessionStore } from "./adapter";
import { HttpSessionStore } from "./httpStore";

export type { SessionStore } from "./adapter";
export { HttpSessionStore, SessionStoreError } from "./httpStore";
export { LocalStorageSessionStore, STORAGE_KEY } from "./localStorageStore";

let instance: SessionStore | null = null;

/**
 * Single place to swap persistence.
 *
 * The browser talks to /api/sessions, which stores sessions in Postgres scoped to
 * the logged-in user (server side: `getUserSessionStore()` in ./server.ts).
 * `LocalStorageSessionStore` remains as the reference implementation.
 */
export function getSessionStore(): SessionStore {
  if (!instance) instance = new HttpSessionStore();
  return instance;
}
