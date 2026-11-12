"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLearnerAdapter } from "../learner";
import { getSessionStore, SessionStoreError } from "../persistence";
import { getTopic } from "../topics";
import type { ChatMessage, LearnerReply, TeachingSession, Topic } from "../types";
import { createId, nowIso } from "../utils";

export type LearnerStatus = "idle" | "thinking" | "error";

/** What failed: the learner's turn, or saving the session to the server. */
export type SessionErrorKind = "learner" | "save";

export interface TeachingSessionState {
  loading: boolean;
  notFound: boolean;
  /** Set when the session couldn't be loaded (offline, server error, logged out). */
  loadError: string | null;
  session: TeachingSession | null;
  topic: Topic | null;
  learnerStatus: LearnerStatus;
  errorKind: SessionErrorKind | null;
  errorMessage: string | null;
  /** True once the learner has signalled it has nothing further to ask. */
  learnerFinished: boolean;
  sendMessage: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  /** Saves the session as completed. Throws a SessionStoreError if the save fails. */
  endSession: () => Promise<TeachingSession | null>;
}

/** What "Try again" should redo. */
type Pending = "open" | "respond" | "saveStudent" | "saveLearner";

const SAVE_FAILED = "Your session couldn't be saved. Check your connection and try again.";

/** Store errors carry a student-safe message; anything else gets the fallback. */
const saveErrorMessage = (error: unknown) => (error instanceof SessionStoreError ? error.message : SAVE_FAILED);

function learnerMessageFrom(reply: LearnerReply): ChatMessage {
  return {
    id: createId("msg"),
    role: "learner",
    text: reply.text,
    createdAt: nowIso(),
    kind: reply.kind,
    mood: reply.mood,
    concept: reply.concept,
    misconception: reply.misconception,
  };
}

/**
 * Owns the lifecycle of one teaching session: loading it from the store,
 * requesting learner turns through the adapter, and persisting every change.
 * Messages appear immediately; if saving them fails, "Try again" re-saves
 * without asking the learner a second time.
 */
export function useTeachingSession(sessionId: string): TeachingSessionState {
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [learnerStatus, setLearnerStatus] = useState<LearnerStatus>("idle");
  const [errorKind, setErrorKind] = useState<SessionErrorKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [learnerFinished, setLearnerFinished] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  const topic = session ? (getTopic(session.topicId) ?? null) : null;

  const fail = useCallback((kind: SessionErrorKind, message: string, pending: Pending) => {
    pendingRef.current = pending;
    setErrorKind(kind);
    setErrorMessage(message);
    setLearnerStatus("error");
  }, []);

  const succeed = useCallback(() => {
    pendingRef.current = null;
    setErrorKind(null);
    setErrorMessage(null);
    setLearnerStatus("idle");
  }, []);

  /** Shows `next` right away, then saves it. Returns false (with the error shown) if the save fails. */
  const persist = useCallback(
    async (next: TeachingSession, onFailure: Pending) => {
      setSession(next);
      try {
        await getSessionStore().saveSession(next);
        return true;
      } catch (error) {
        fail("save", saveErrorMessage(error), onFailure);
        return false;
      }
    },
    [fail],
  );

  /** Asks the learner for its next turn and appends it to the session. */
  const requestLearnerTurn = useCallback(
    async (current: TeachingSession, mode: "open" | "respond") => {
      const currentTopic = getTopic(current.topicId);
      if (!currentTopic) return;
      pendingRef.current = mode;
      setLearnerStatus("thinking");
      setErrorKind(null);
      setErrorMessage(null);
      let reply: LearnerReply;
      try {
        const adapter = getLearnerAdapter();
        const context = {
          topic: currentTopic,
          messages: current.messages,
          cursor: current.learnerCursor,
          studentMessage: [...current.messages].reverse().find((m) => m.role === "student")?.text,
        };
        reply = mode === "open" ? await adapter.open(context) : await adapter.respond(context);
      } catch (error) {
        fail("learner", error instanceof Error ? error.message : "Pip could not respond. Please try again.", mode);
        return;
      }
      const next: TeachingSession = {
        ...current,
        messages: [...current.messages, learnerMessageFrom(reply)],
        learnerCursor: reply.nextCursor,
      };
      setLearnerFinished(reply.isFinal);
      if (await persist(next, "saveLearner")) succeed();
    },
    [fail, persist, succeed],
  );

  // Load the session once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let found: TeachingSession | null;
      try {
        found = await getSessionStore().getSession(sessionId);
      } catch (error) {
        if (cancelled) return;
        setLoadError(saveErrorMessage(error));
        setLoading(false);
        return;
      }
      if (cancelled) return;
      if (!found) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSession(found);
      setLoading(false);
      if (found.status === "in_progress" && found.messages.length === 0) {
        void requestLearnerTurn(found, "open");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, requestLearnerTurn]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!session || !trimmed || learnerStatus !== "idle" || session.status !== "in_progress") {
        return;
      }
      const studentMessage: ChatMessage = {
        id: createId("msg"),
        role: "student",
        text: trimmed,
        createdAt: nowIso(),
      };
      const next = { ...session, messages: [...session.messages, studentMessage] };
      // On failure the message stays on screen and "Try again" saves it, then asks Pip.
      if (!(await persist(next, "saveStudent"))) return;
      await requestLearnerTurn(next, "respond");
    },
    [session, learnerStatus, persist, requestLearnerTurn],
  );

  const retry = useCallback(async () => {
    if (!session) return;
    const pending = pendingRef.current ?? (session.messages.length === 0 ? "open" : "respond");
    if (pending === "saveStudent" || pending === "saveLearner") {
      setLearnerStatus("thinking");
      if (!(await persist(session, pending))) return;
      succeed();
      if (pending === "saveStudent") await requestLearnerTurn(session, "respond");
      return;
    }
    await requestLearnerTurn(session, pending);
  }, [session, persist, succeed, requestLearnerTurn]);

  const endSession = useCallback(async () => {
    if (!session) return null;
    const next: TeachingSession = { ...session, status: "completed", endedAt: nowIso() };
    // Save first: if it fails, the session stays open on screen too.
    await getSessionStore().saveSession(next);
    setSession(next);
    return next;
  }, [session]);

  return {
    loading,
    notFound,
    loadError,
    session,
    topic,
    learnerStatus,
    errorKind,
    errorMessage,
    learnerFinished,
    sendMessage,
    retry,
    endSession,
  };
}
