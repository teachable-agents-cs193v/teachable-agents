import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getPool } from "../db/pool";
import { learnerIdFor, type LearnerMode } from "../aiData";
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
  messages: TeachingSession["messages"];
  learner_cursor: number;
  pre_explanation: string | null;
  reflection: TeachingSession["reflection"] | null;
}

function toSession(row: Row): TeachingSession {
  return {
    id: row.id,
    topicId: row.topic_id,
    learnerId: row.learner_id,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString(),
    messages: row.messages,
    learnerCursor: row.learner_cursor,
    preExplanation: row.pre_explanation ?? undefined,
    reflection: row.reflection ?? undefined,
  };
}

export class PostgresSessionStore implements SessionStore {
  readonly id = "postgres";

  constructor(
    private readonly userId: string,
    private readonly pool: Pool,
  ) {}

  async listSessions(): Promise<TeachingSession[]> {
    const { rows } = await this.pool.query<Row>(
      `select ${COLUMNS} from teaching_sessions where user_id = $1 order by started_at desc`,
      [this.userId],
    );
    return rows.map(toSession);
  }

  async getSession(id: string): Promise<TeachingSession | null> {
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from teaching_sessions where id = $1 and user_id = $2`, [
      id,
      this.userId,
    ]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  async findActiveSession(topicId: string): Promise<TeachingSession | null> {
    const { rows } = await this.pool.query<Row>(
      `select ${COLUMNS} from teaching_sessions
       where user_id = $1 and topic_id = $2 and status = 'in_progress'
       order by started_at desc limit 1`,
      [this.userId, topicId],
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  /**
   * Creates a session with a server-generated ID. The caller checks `topicId` is a real topic.
   * `mode` is the student's AI choice, stored once in learner_id (src/lib/aiData.ts). No update
   * below ever writes learner_id, so the browser can't change it later. Without a choice, no AI.
   */
  async createSession(topicId: string, preExplanation?: string, mode: LearnerMode = "offline"): Promise<TeachingSession> {
    const { rows } = await this.pool.query<Row>(
      `insert into teaching_sessions (id, user_id, topic_id, learner_id, pre_explanation)
       values ($1, $2, $3, $4, $5) returning ${COLUMNS}`,
      [`session_${randomUUID()}`, this.userId, topicId, learnerIdFor(mode), preExplanation?.trim() || null],
    );
    return toSession(rows[0]);
  }

  /** Updates the fields the browser may change (status, end time, reflection); null if there is no such session. */
  /**
   * Updates status, endedAt and reflection. "completed" is final: once ended, a session can't go
   * back to in_progress (its review, with the assessor's verdicts, is open by then), so that
   * update answers "ended" and changes nothing. Saving a completed session again (e.g. its
   * reflection) is fine.
   */
  async updateSession(id: string, update: SessionUpdate): Promise<TeachingSession | null | "ended"> {
    const { rows } = await this.pool.query<Row>(
      `update teaching_sessions
       set status = $3, ended_at = $4, reflection = $5, updated_at = now()
       where id = $1 and user_id = $2 and (status = 'in_progress' or $3 = 'completed')
       returning ${COLUMNS}`,
      [id, this.userId, update.status, update.endedAt ?? null, update.reflection ? JSON.stringify(update.reflection) : null],
    );
    if (rows[0]) return toSession(rows[0]);
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
    const { rows } = await this.pool.query<Row & { learner_state: unknown; version: string }>(
      `select ${COLUMNS}, learner_state, updated_at::text as version from teaching_sessions where id = $1 and user_id = $2`,
      [id, this.userId],
    );
    const row = rows[0];
    return row ? { session: toSession(row), learnerState: row.learner_state ?? null, version: row.version } : null;
  }

  /**
   * Appends messages to one of this user's sessions, optionally with Pip's new
   * cursor and learner state, but only if nothing changed it since `version`
   * (otherwise "conflict"). Null if there's no such session.
   *
   * The server is the only writer of the transcript: the browser can't PUT
   * messages. This is also the one place the transcript is read and written for
   * a turn, so encryption at rest wraps this method.
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
           learner_state = case when $7 then learner_state else $6::jsonb end,
           updated_at = now()
       where id = $1 and user_id = $2 and updated_at = $3::timestamptz
       returning ${COLUMNS}, updated_at::text as version`,
      [
        id,
        this.userId,
        change.version,
        JSON.stringify(messages),
        change.learnerCursor ?? current.session.learnerCursor,
        keepState ? null : JSON.stringify(change.learnerState),
        keepState,
      ],
    );
    // No row: another request changed the session between the read and this write.
    return rows[0] ? { session: toSession(rows[0]), version: rows[0].version } : "conflict";
  }

  /** Deletes one of this user's sessions; false if there is no such session. */
  async deleteOwnSession(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`delete from teaching_sessions where id = $1 and user_id = $2`, [id, this.userId]);
    return (rowCount ?? 0) > 0;
  }
}
