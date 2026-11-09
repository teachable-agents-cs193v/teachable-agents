"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLearnerAdapter } from "../learner";
import { getSessionStore } from "../persistence";
import { getTopic } from "../topics";
import type { ChatMessage, LearnerReply, TeachingSession, Topic } from "../types";
import { createId, nowIso } from "../utils";

export type LearnerStatus = "idle" | "thinking" | "error";

export interface TeachingSessionState {
  loading: boolean;
  notFound: boolean;
  session: TeachingSession | null;
  topic: Topic | null;
  learnerStatus: LearnerStatus;
  errorMessage: string | null;
  /** True once the learner has signalled it has nothing further to ask. */
  learnerFinished: boolean;
  sendMessage: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  endSession: () => Promise<TeachingSession | null>;
}

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
 */
export function useTeachingSession(sessionId: string): TeachingSessionState {
  const [session, setSession] = useState<TeachingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [learnerStatus, setLearnerStatus] = useState<LearnerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [learnerFinished, setLearnerFinished] = useState(false);
  const pendingRef = useRef<"open" | "respond" | null>(null);

  const topic = session ? (getTopic(session.topicId) ?? null) : null;

  const persist = useCallback(async (next: TeachingSession) => {
    setSession(next);
    await getSessionStore().saveSession(next);
  }, []);

  /** Asks the learner for its next turn and appends it to the session. */
  const requestLearnerTurn = useCallback(
    async (current: TeachingSession, mode: "open" | "respond") => {
      const currentTopic = getTopic(current.topicId);
      if (!currentTopic) return;
      pendingRef.current = mode;
      setLearnerStatus("thinking");
      setErrorMessage(null);
      try {
        const adapter = getLearnerAdapter();
        const context = {
          topic: currentTopic,
          messages: current.messages,
          cursor: current.learnerCursor,
          studentMessage: [...current.messages].reverse().find((m) => m.role === "student")?.text,
        };
        const reply = mode === "open" ? await adapter.open(context) : await adapter.respond(context);
        const next: TeachingSession = {
          ...current,
          messages: [...current.messages, learnerMessageFrom(reply)],
          learnerCursor: reply.nextCursor,
        };
        setLearnerFinished(reply.isFinal);
        await persist(next);
        setLearnerStatus("idle");
        pendingRef.current = null;
      } catch (error) {
        setLearnerStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Pip could not respond. Please try again.",
        );
      }
    },
    [persist],
  );

  // Load the session once on mount (client only, because storage is browser-side).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await getSessionStore().getSession(sessionId);
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
      if (!session || !trimmed || learnerStatus === "thinking" || session.status !== "in_progress") {
        return;
      }
      const studentMessage: ChatMessage = {
        id: createId("msg"),
        role: "student",
        text: trimmed,
        createdAt: nowIso(),
      };
      const next = { ...session, messages: [...session.messages, studentMessage] };
      await persist(next);
      await requestLearnerTurn(next, "respond");
    },
    [session, learnerStatus, persist, requestLearnerTurn],
  );

  const retry = useCallback(async () => {
    if (!session) return;
    const mode = pendingRef.current ?? (session.messages.length === 0 ? "open" : "respond");
    await requestLearnerTurn(session, mode);
  }, [session, requestLearnerTurn]);

  const endSession = useCallback(async () => {
    if (!session) return null;
    const next: TeachingSession = { ...session, status: "completed", endedAt: nowIso() };
    await persist(next);
    return next;
  }, [session, persist]);

  return {
    loading,
    notFound,
    session,
    topic,
    learnerStatus,
    errorMessage,
    learnerFinished,
    sendMessage,
    retry,
    endSession,
  };
}
