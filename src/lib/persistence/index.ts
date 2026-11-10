import type { SessionStore } from "./adapter";
import { LocalStorageSessionStore } from "./localStorageStore";

export type { SessionStore } from "./adapter";
export { LocalStorageSessionStore, STORAGE_KEY } from "./localStorageStore";

let instance: SessionStore | null = null;

/**
 * Single place to swap persistence.
 *
 * Betania: return a database-backed `SessionStore` here. Anahi: once auth
 * exists, the store can scope sessions to the signed-in user internally.
 */
export function getSessionStore(): SessionStore {
  if (!instance) instance = new LocalStorageSessionStore();
  return instance;
}
