import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptField,
  ENCRYPTED_FIELDS,
  type EncryptedField,
  EncryptionKeyError,
  encryptField,
  FieldDecryptionError,
} from "../fieldEncryption";

// ENCRYPTION_MASTER_KEY comes from the test-only value in vitest.config.mts.
const ALICE = "user_alice";
const BOB = "user_bob";

/** Re-encodes one part of a stored value after changing its bytes. */
function withPart(stored: string, index: 1 | 2 | 3, change: (bytes: Buffer) => Buffer): string {
  const parts = stored.split(":");
  parts[index] = change(Buffer.from(parts[index], "base64url")).toString("base64url");
  return parts.join(":");
}

function flipFirstByte(bytes: Buffer): Buffer {
  const copy = Buffer.from(bytes);
  copy[0] ^= 0x01;
  return copy;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryptField / decryptField", () => {
  it("round-trips every field", () => {
    for (const field of ENCRYPTED_FIELDS) {
      const text = JSON.stringify({ field, note: "Mitochondria make ATP ⚡ — étude" });
      expect(decryptField(ALICE, field, encryptField(ALICE, field, text))).toBe(text);
    }
  });

  it("round-trips an empty string", () => {
    expect(decryptField(ALICE, "pre_explanation", encryptField(ALICE, "pre_explanation", ""))).toBe("");
  });

  it("gives different output each time for the same input", () => {
    const a = encryptField(ALICE, "reflection", "same text");
    const b = encryptField(ALICE, "reflection", "same text");
    expect(a).not.toBe(b);
    expect(a.split(":")[1]).not.toBe(b.split(":")[1]); // fresh IV
  });

  it("stores a versioned string without the plaintext in it", () => {
    const stored = encryptField(ALICE, "messages", "secret transcript");
    expect(stored).toMatch(/^v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]{22}$/);
    expect(stored).not.toContain("secret");
  });

  it("fails when decrypting as a different user", () => {
    const stored = encryptField(ALICE, "reflection", "Alice's reflection");
    expect(() => decryptField(BOB, "reflection", stored)).toThrow(FieldDecryptionError);
  });

  it("fails when decrypting as a different field", () => {
    const stored = encryptField(ALICE, "reflection", "Alice's reflection");
    expect(() => decryptField(ALICE, "messages", stored)).toThrow(FieldDecryptionError);
  });

  it("doesn't confuse user IDs and fields that contain separators", () => {
    const stored = encryptField("a:b", "messages", "x");
    expect(() => decryptField("a", "messages", stored)).toThrow(FieldDecryptionError);
  });

  it.each([1, 2, 3] as const)("fails when part %i is tampered with", (index) => {
    const stored = encryptField(ALICE, "messages", "transcript");
    expect(() => decryptField(ALICE, "messages", withPart(stored, index, flipFirstByte))).toThrow(FieldDecryptionError);
  });

  it("fails on truncated values", () => {
    const stored = encryptField(ALICE, "messages", "a transcript long enough to truncate");
    const truncated = [
      stored.slice(0, -1),
      stored.slice(0, stored.lastIndexOf(":")),
      withPart(stored, 2, (b) => b.subarray(0, b.length - 1)),
      withPart(stored, 3, (b) => b.subarray(0, 12)),
      "",
    ];
    for (const value of truncated) {
      expect(() => decryptField(ALICE, "messages", value)).toThrow(FieldDecryptionError);
    }
  });

  it("fails on an unknown version, extra parts, non-canonical encoding or plaintext", () => {
    const stored = encryptField(ALICE, "messages", "transcript");
    const bad = [stored.replace(/^v1:/, "v2:"), `${stored}:extra`, `${stored}=`, "just some plaintext"];
    for (const value of bad) {
      expect(() => decryptField(ALICE, "messages", value)).toThrow(FieldDecryptionError);
    }
  });

  it("doesn't put the stored value or plaintext in the error", () => {
    const stored = encryptField(ALICE, "reflection", "private words");
    try {
      decryptField(BOB, "reflection", stored);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toBe("Could not decrypt reflection.");
    }
  });

  it("rejects fields that aren't in ENCRYPTED_FIELDS and empty user IDs", () => {
    expect(() => encryptField(ALICE, "email" as EncryptedField, "x")).toThrow(TypeError);
    expect(() => encryptField("", "messages", "x")).toThrow(TypeError);
  });
});

describe("ENCRYPTION_MASTER_KEY", () => {
  it("throws when the key is missing", () => {
    vi.stubEnv("ENCRYPTION_MASTER_KEY", undefined);
    expect(() => encryptField(ALICE, "messages", "x")).toThrow(EncryptionKeyError);
    vi.stubEnv("ENCRYPTION_MASTER_KEY", "");
    expect(() => encryptField(ALICE, "messages", "x")).toThrow(EncryptionKeyError);
  });

  it("throws when the key is shorter or longer than 32 bytes", () => {
    vi.stubEnv("ENCRYPTION_MASTER_KEY", Buffer.alloc(16, 1).toString("base64"));
    expect(() => encryptField(ALICE, "messages", "x")).toThrow(EncryptionKeyError);
    vi.stubEnv("ENCRYPTION_MASTER_KEY", Buffer.alloc(33, 1).toString("base64"));
    expect(() => encryptField(ALICE, "messages", "x")).toThrow(EncryptionKeyError);
  });

  it("throws when the key isn't base64, such as the .env.example placeholder", () => {
    vi.stubEnv("ENCRYPTION_MASTER_KEY", "replace-with-output-of-openssl-rand-base64-32");
    expect(() => encryptField(ALICE, "messages", "x")).toThrow(EncryptionKeyError);
  });

  it("throws a key error, not a decryption error, when decrypting without a key", () => {
    const stored = encryptField(ALICE, "messages", "x");
    vi.stubEnv("ENCRYPTION_MASTER_KEY", undefined);
    expect(() => decryptField(ALICE, "messages", stored)).toThrow(EncryptionKeyError);
  });

  it("can't decrypt values made with a different master key", () => {
    const stored = encryptField(ALICE, "messages", "x");
    vi.stubEnv("ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 2).toString("base64"));
    expect(() => decryptField(ALICE, "messages", stored)).toThrow(FieldDecryptionError);
  });

  it("doesn't put the key in the error message", () => {
    const short = Buffer.alloc(16, 1).toString("base64");
    vi.stubEnv("ENCRYPTION_MASTER_KEY", short);
    expect(() => encryptField(ALICE, "messages", "x")).toThrow(expect.not.objectContaining({ message: expect.stringContaining(short) }));
  });
});
