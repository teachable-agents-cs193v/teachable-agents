import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { decryptField, encryptField, FieldDecryptionError } from "../crypto/fieldEncryption";
import { getPool } from "../db/pool";
import { AI_LEARNER_ID } from "../aiData";
import type { AuthUser, ChatMessage, TeachingSession } from "../types";
import type { SessionStore } from "./adapter";
import type { SessionUpdate } from "./validate";

/**
 * Teaching sessions in Postgres, scoped to one user (docs/AUTH.md, "Ownership rules"):
 *
 * 1. The owner is the `user` passed in; any user ID from the browser is ignored.
 * 2. Every query filters by `user_id`.
 * 3. Another user's session looks exactly like a missing one (`null` / `false`).
 * 4. The server generates IDs; updates only touch rows this user already owns.
 *
 * The transcript, pre-explanation, reflection and learner state are encrypted per user and
 * field (src/lib/crypto/fieldEncryption.ts, db/migrations/0003_encrypt_teaching_sessions.sql,
 * db/migrations/0004_learner_state.sql):
 * encrypted on every write, decrypted on every read, always with this store's user ID.
 *
 * Server-only. API routes get one with `getUserSessionStore(await requireApiUser())`.
 */
export function getUserSessionStore(user: AuthUser, pool: Pool = getPool()): PostgresSessionStore {
  return new PostgresSessionStore(user.id, pool);
}

const COLUMNS = `id, topic_id, learner_id, status, started_at, ended_at, messages, learner_cursor, pre_explanation, reflection`;

interface Row {
  id: string;
  topic_id: string;
  learner_id: string;
  status: TeachingSession["status"];
  started_at: Date;
  ended_at: Date | null;
  /** Encrypted JSON array. */
  messages: string;
  learner_cursor: number;
  /** Encrypted text. */
  pre_explanation: string | null;
  /** Encrypted JSON object. */
  reflection: string | null;
}

/** Decrypts a row for its owner. Throws FieldDecryptionError if any value can't be decrypted. */
function toSession(userId: string, row: Row): TeachingSession {
  return {
    id: row.id,
    topicId: row.topic_id,
    learnerId: row.learner_id,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString(),
    messages: JSON.parse(decryptField(userId, "messages", row.messages)),
    learnerCursor: row.learner_cursor,
    preExplanation: row.pre_explanation === null ? undefined : decryptField(userId, "pre_explanation", row.pre_explanation),
    reflection: row.reflection === null ? undefined : JSON.parse(decryptField(userId, "reflection", row.reflection)),
  };
}

export class PostgresSessionStore implements SessionStore {
  readonly id = "postgres";

  constructor(
    private readonly userId: string,
    private readonly pool: Pool,
  ) {}

  private toSession = (row: Row): TeachingSession => toSession(this.userId, row);

  /**
   * All of this user's sessions, newest first. A session that can't be decrypted is
   * left out and its ID logged (never its contents), so one bad row doesn't hide the
   * rest (#52). A missing or malformed key still throws: that affects every row.
   */
  async listSessions(): Promise<TeachingSession[]> {
    const { rows } = await this.pool.query<Row>(
      `select ${COLUMNS} from teaching_sessions where user_id = $1 order by started_at desc`,
      [this.userId],
    );
    return rows.flatMap((row) => {
      try {
        return [this.toSession(row)];
      } catch (error) {
        if (!(error instanceof FieldDecryptionError)) throw error;
        console.error(`[sessions] skipped session ${row.id}: ${error.message}`);
        return [];
      }
    });
  }

  async getSession(id: string): Promise<TeachingSession | null> {
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from teaching_sessions where id = $1 and user_id = $2`, [
      id,
      this.userId,
    ]);
    return rows[0] ? this.toSession(rows[0]) : null;
  }

  async findActiveSession(topicId: string): Promise<TeachingSession | null> {
    const { rows } = await this.pool.query<Row>(
      `select ${COLUMNS} from teaching_sessions
       where user_id = $1 and topic_id = $2 and status = 'in_progress'
       order by started_at desc limit 1`,
      [this.userId, topicId],
    );
    return rows[0] ? this.toSession(rows[0]) : null;
  }

  /**
   * Creates a session with a server-generated ID. The caller checks `topicId` is a real topic.
   * learner_id is always AI_LEARNER_ID (src/lib/aiData.ts), and no update below ever writes it,
   * so the browser can't change it later.
   */
  async createSession(topicId: string, preExplanation?: string): Promise<TeachingSession> {
    const explanation = preExplanation?.trim();
    const { rows } = await this.pool.query<Row>(
      `insert into teaching_sessions (id, user_id, topic_id, learner_id, messages, pre_explanation)
       values ($1, $2, $3, $4, $5, $6) returning ${COLUMNS}`,
      [
        `session_${randomUUID()}`,
        this.userId,
        topicId,
        AI_LEARNER_ID,
        // The column has no default: even the empty transcript is stored encrypted.
        encryptField(this.userId, "messages", "[]"),
        explanation ? encryptField(this.userId, "pre_explanation", explanation) : null,
      ],
    );
    return this.toSession(rows[0]);
  }

  /**
   * Updates the fields the browser may change: status, endedAt and reflection (null if there is
   * no such session). "completed" is final: once ended, a session can't go back to in_progress
   * (its review, with the assessor's verdicts, is open by then), so that update answers "ended"
   * and changes nothing. Saving a completed session again (e.g. its
   * reflection) is fine.
   */
  async updateSession(id: string, update: SessionUpdate): Promise<TeachingSession | null | "ended"> {
    const { rows } = await this.pool.query<Row>(
      `update teaching_sessions
       set status = $3, ended_at = $4, reflection = $5, updated_at = now()
       where id = $1 and user_id = $2 and (status = 'in_progress' or $3 = 'completed')
       returning ${COLUMNS}`,
      [
        id,
        this.userId,
        update.status,
        update.endedAt ?? null,
        update.reflection ? encryptField(this.userId, "reflection", JSON.stringify(update.reflection)) : null,
      ],
    );
    if (rows[0]) return this.toSession(rows[0]);
    return (await this.getSession(id)) ? "ended" : null;
  }

  /** SessionStore's save: an update only. It never creates a row from a browser-made ID. */
  async saveSession(session: TeachingSession): Promise<void> {
    const updated = await this.updateSession(session.id, session);
    if (!updated) throw new Error("Session not found.");
    if (updated === "ended") throw new Error("This session has ended and can't be reopened.");
  }

  async deleteSession(id: string): Promise<void> {
    await this.deleteOwnSession(id);
  }

  /**
   * One of this user's sessions with what a learner turn needs: the server-only
   * learner state and a version for `appendToSession`. Null if there's no such session.
   * The version is `updated_at` as text, which keeps Postgres's microseconds (a JS
   * Date would round them off and never match again).
   * Never returned by GET /api/sessions/[id]: the learner state holds the assessor's hidden verdicts.
   */
  async getTurnContext(id: string): Promise<{ session: TeachingSession; learnerState: unknown; version: string } | null> {
    const { rows } = await this.pool.query<Row & { learner_state: string | null; version: string }>(
      `select ${COLUMNS}, learner_state, updated_at::text as version from teaching_sessions where id = $1 and user_id = $2`,
      [id, this.userId],
    );
    const row = rows[0];
    if (!row) return null;
    const learnerState = row.learner_state === null ? null : JSON.parse(decryptField(this.userId, "learner_state", row.learner_state));
    return { session: this.toSession(row), learnerState, version: row.version };
  }

  /**
   * Appends messages to one of this user's sessions, optionally with Pip's new
   * cursor and learner state, but only if nothing changed it since `version`
   * (otherwise "conflict"). Null if there's no such session.
   *
   * The server is the only writer of the transcript: the browser can't PUT
   * messages. The transcript and learner state are decrypted on the read and
   * re-encrypted on the write, like every other encrypted field.
   */
  async appendToSession(
    id: string,
    change: { version: string; append: ChatMessage[]; learnerCursor?: number; learnerState?: object | null },
  ): Promise<{ session: TeachingSession; version: string } | "conflict" | null> {
    const current = await this.getTurnContext(id);
    if (!current) return null;
    if (current.version !== change.version) return "conflict";
    const messages = [...current.session.messages, ...change.append];
    const keepState = change.learnerState === undefined;
    const { rows } = await this.pool.query<Row & { version: string }>(
      `update teaching_sessions
       set messages = $4, learner_cursor = $5,
           learner_state = case when $7 then learner_state else $6::text end,
           updated_at = now()
       where id = $1 and user_id = $2 and updated_at = $3::timestamptz
       returning ${COLUMNS}, updated_at::text as version`,
      [
        id,
        this.userId,
        change.version,
        encryptField(this.userId, "messages", JSON.stringify(messages)),
        change.learnerCursor ?? current.session.learnerCursor,
        keepState || change.learnerState === null
          ? null
          : encryptField(this.userId, "learner_state", JSON.stringify(change.learnerState)),
        keepState,
      ],
    );
    // No row: another request changed the session between the read and this write.
    return rows[0] ? { session: this.toSession(rows[0]), version: rows[0].version } : "conflict";
  }

  /** Deletes one of this user's sessions; false if there is no such session. */
  async deleteOwnSession(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`delete from teaching_sessions where id = $1 and user_id = $2`, [id, this.userId]);
    return (rowCount ?? 0) > 0;
  }
}
