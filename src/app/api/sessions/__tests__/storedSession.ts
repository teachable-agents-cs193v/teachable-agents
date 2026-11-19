// Reads and writes a session's encrypted columns straight from the throwaway Postgres,
// for tests that check what is actually stored. Tests only.
import { decryptField, encryptField } from "@/lib/crypto/fieldEncryption";
import { getPool } from "@/lib/db/pool";

interface StoredRow {
  user_id: string;
  messages: string;
  learner_state: string | null;
}

/** The raw row (ciphertext as stored) for one session. */
export async function storedRow(sessionId: string): Promise<StoredRow> {
  const { rows } = await getPool().query<StoredRow>("select user_id, messages, learner_state from teaching_sessions where id = $1", [
    sessionId,
  ]);
  return rows[0];
}

/** The session's learner state, decrypted with its owner's key. Null if none is stored. */
export async function storedLearnerState(sessionId: string): Promise<Record<string, unknown> | null> {
  const row = await storedRow(sessionId);
  return row.learner_state === null ? null : JSON.parse(decryptField(row.user_id, "learner_state", row.learner_state));
}

/** Replaces the session's learner state, encrypted with its owner's key. */
export async function writeLearnerState(sessionId: string, state: object): Promise<void> {
  const { user_id } = await storedRow(sessionId);
  await getPool().query("update teaching_sessions set learner_state = $2 where id = $1", [
    sessionId,
    encryptField(user_id, "learner_state", JSON.stringify(state)),
  ]);
}
