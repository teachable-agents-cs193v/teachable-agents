import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { decryptField, encryptField } from "../crypto/fieldEncryption";
import { getPool } from "../db/pool";
import { PIP } from "../learner";
import type { AuthUser, TeachingSession } from "../types";
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
 * The transcript, pre-explanation and reflection are encrypted per user and field
 * (src/lib/crypto/fieldEncryption.ts, db/migrations/0003_encrypt_teaching_sessions.sql):
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

  async listSessions(): Promise<TeachingSession[]> {
    const { rows } = await this.pool.query<Row>(
      `select ${COLUMNS} from teaching_sessions where user_id = $1 order by started_at desc`,
      [this.userId],
    );
    return rows.map(this.toSession);
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

  /** Creates a session with a server-generated ID. The caller checks `topicId` is a real topic. */
  async createSession(topicId: string, preExplanation?: string): Promise<TeachingSession> {
    const explanation = preExplanation?.trim();
    const { rows } = await this.pool.query<Row>(
      `insert into teaching_sessions (id, user_id, topic_id, learner_id, messages, pre_explanation)
       values ($1, $2, $3, $4, $5, $6) returning ${COLUMNS}`,
      [
        `session_${randomUUID()}`,
        this.userId,
        topicId,
        PIP.id,
        // The column has no default: even the empty transcript is stored encrypted.
        encryptField(this.userId, "messages", "[]"),
        explanation ? encryptField(this.userId, "pre_explanation", explanation) : null,
      ],
    );
    return this.toSession(rows[0]);
  }

  /** Updates the changeable fields of one of this user's sessions; null if there is no such session. */
  async updateSession(id: string, update: SessionUpdate): Promise<TeachingSession | null> {
    const { rows } = await this.pool.query<Row>(
      `update teaching_sessions
       set status = $3, ended_at = $4, messages = $5, learner_cursor = $6, reflection = $7, updated_at = now()
       where id = $1 and user_id = $2
       returning ${COLUMNS}`,
      [
        id,
        this.userId,
        update.status,
        update.endedAt ?? null,
        encryptField(this.userId, "messages", JSON.stringify(update.messages)),
        update.learnerCursor,
        update.reflection ? encryptField(this.userId, "reflection", JSON.stringify(update.reflection)) : null,
      ],
    );
    return rows[0] ? this.toSession(rows[0]) : null;
  }

  /** SessionStore's save: an update only. It never creates a row from a browser-made ID. */
  async saveSession(session: TeachingSession): Promise<void> {
    const updated = await this.updateSession(session.id, session);
    if (!updated) throw new Error("Session not found.");
  }

  async deleteSession(id: string): Promise<void> {
    await this.deleteOwnSession(id);
  }

  /** Deletes one of this user's sessions; false if there is no such session. */
  async deleteOwnSession(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`delete from teaching_sessions where id = $1 and user_id = $2`, [id, this.userId]);
    return (rowCount ?? 0) > 0;
  }
}
