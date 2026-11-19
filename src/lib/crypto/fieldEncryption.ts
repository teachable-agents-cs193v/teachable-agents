import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Per-user, per-field encryption for user data stored in Postgres. Server-only.
 *
 * USAGE
 *
 *   import { encryptField, decryptField } from "@/lib/crypto/fieldEncryption";
 *
 *   // On save: encrypt each sensitive value just before it goes into the query.
 *   const stored = encryptField(userId, "reflection", JSON.stringify(reflection));
 *
 *   // On read: decrypt right after the row comes back.
 *   const reflection = JSON.parse(decryptField(userId, "reflection", row.reflection));
 *
 * - Values are strings in and out. For jsonb data, JSON.stringify before encrypting and
 *   JSON.parse after decrypting; the column that holds the result must be `text`.
 * - `userId` must be the logged-in owner's ID (the same one the query filters by).
 * - `field` must be listed in ENCRYPTED_FIELDS below. Add new fields there.
 * - Both functions throw on any problem: a missing or malformed ENCRYPTION_MASTER_KEY
 *   (EncryptionKeyError), or a value that can't be decrypted (FieldDecryptionError).
 *   Never catch these and fall back to plaintext.
 *
 * HOW IT WORKS
 *
 * - One master key, ENCRYPTION_MASTER_KEY (32 random bytes, base64), read from the server
 *   environment at call time. Generate with `openssl rand -base64 32`, one per tier.
 * - HKDF-SHA256 derives a separate AES key for each (user, field) pair, so the key for
 *   (user A, reflection) can't decrypt (user B, reflection) or (user A, messages).
 * - AES-256-GCM with a fresh random 12-byte IV per call. The version, user ID and field are
 *   also bound as additional authenticated data, so a value copied into another user's row
 *   or another column fails to decrypt instead of returning data.
 * - Stored format: "v1:<iv>:<ciphertext>:<tag>", each part base64url. The version prefix
 *   leaves room for key rotation later (not implemented).
 *
 * WARNING: the user ID and field name are part of the key and the AAD. Renaming a field in
 * ENCRYPTED_FIELDS, or changing a user's ID, makes their existing values undecryptable.
 * Losing ENCRYPTION_MASTER_KEY makes everything undecryptable.
 *
 * This module never logs, and its errors never include plaintext, stored values or keys.
 */

/**
 * The fields that may be encrypted, named after their columns. This is the one place to
 * add more. Don't rename existing entries (see the warning above).
 */
export const ENCRYPTED_FIELDS = [
  // teaching_sessions (db/migrations/0002_teaching_sessions.sql)
  "messages", // the transcript
  "pre_explanation",
  "reflection",
  // teaching_sessions.learner_state, Pip's notebook (db/migrations/0004_learner_state.sql)
  "learner_state",
] as const;

export type EncryptedField = (typeof ENCRYPTED_FIELDS)[number];

/** ENCRYPTION_MASTER_KEY is missing or isn't 32 bytes of base64. */
export class EncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionKeyError";
  }
}

/** A stored value couldn't be decrypted: wrong user or field, tampered, truncated or malformed. */
export class FieldDecryptionError extends Error {
  constructor(field: string) {
    super(`Could not decrypt ${field}.`);
    this.name = "FieldDecryptionError";
  }
}

const VERSION = "v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HKDF_SALT = Buffer.from("teachable-agents/field-encryption", "utf8");
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64URL = /^[A-Za-z0-9_-]*$/;

function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY?.trim();
  if (!raw) throw new EncryptionKeyError("ENCRYPTION_MASTER_KEY is not set.");
  const key = BASE64.test(raw) ? Buffer.from(raw, "base64") : null;
  // Re-encoding catches lenient decoding; together these require exactly 32 bytes of base64.
  if (!key || key.length !== KEY_BYTES || key.toString("base64") !== raw) {
    throw new EncryptionKeyError("ENCRYPTION_MASTER_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return key;
}

function checkArgs(userId: string, field: string): asserts field is EncryptedField {
  if (typeof userId !== "string" || userId.length === 0) throw new TypeError("userId must be a non-empty string.");
  if (!(ENCRYPTED_FIELDS as readonly string[]).includes(field)) throw new TypeError(`Unknown encrypted field: ${field}`);
}

/** Unambiguous encoding of (version, user, field), used as both the HKDF info and the AAD. */
function context(userId: string, field: EncryptedField): Buffer {
  return Buffer.from(JSON.stringify([VERSION, userId, field]), "utf8");
}

function deriveKey(userId: string, field: EncryptedField): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey(), HKDF_SALT, context(userId, field), KEY_BYTES));
}

/** Encrypts `plaintext` for one user and field. Returns "v1:<iv>:<ciphertext>:<tag>". */
export function encryptField(userId: string, field: EncryptedField, plaintext: string): string {
  checkArgs(userId, field);
  if (typeof plaintext !== "string") throw new TypeError("plaintext must be a string.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(userId, field), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(context(userId, field));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(":");
}

/** Decrypts a value from encryptField for the same user and field. Throws on any failure. */
export function decryptField(userId: string, field: EncryptedField, stored: string): string {
  checkArgs(userId, field);
  const key = deriveKey(userId, field); // key errors surface as EncryptionKeyError, not as a decryption failure
  try {
    if (typeof stored !== "string") throw new Error();
    const parts = stored.split(":");
    if (parts.length !== 4 || parts[0] !== VERSION || !parts.slice(1).every((p) => BASE64URL.test(p))) throw new Error();
    const [iv, ciphertext, tag] = parts.slice(1).map((p) => Buffer.from(p, "base64url"));
    // Canonical encoding only, so no two different strings decode to the same value.
    if ([iv, ciphertext, tag].some((b, i) => b.toString("base64url") !== parts[i + 1])) throw new Error();
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(context(userId, field));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Deliberately drops the underlying error so nothing about the value leaks into logs.
    throw new FieldDecryptionError(field);
  }
}
