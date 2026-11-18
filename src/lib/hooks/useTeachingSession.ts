"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLearningProgress, getPipBeliefs, postDeviceReply, postTurn, TurnError, type TurnBody, type TurnResponse } from "../learner";
import { DEVICE_EXPERIMENT, deviceSupported, loadDevicePip, writeOnDevice, type DeviceStats } from "../learner/device/onDevicePip";
import { getSessionStore, SessionStoreError } from "../persistence";
import { getTopic } from "../topics";
import type { ChatMessage, LearningProgress, StudentBelief, TeachingSession, Topic } from "../types";
import { createId, nowIso } from "../utils";

export type LearnerStatus = "idle" | "thinking" | "error";

/** Whether Pip's replies are written on this device (topics with `onDevice`). */
export interface DevicePipState {
  /** off: replies come from the server. unsupported: no WebGPU in this browser. */
  status: "off" | "loading" | "ready" | "unsupported" | "error";
  /** Load progress, 0 to 1, and WebLLM's description of it. */
  progress: number;
  progressText: string;
  /** How fast the last reply was written on the device. */
  lastStats: DeviceStats | null;
  /** Replies the server wrote because the device couldn't, this session. */
  fallbacks: number;
  error: string | null;
  enable: () => void;
  disable: () => void;
}

const DEVICE_PREF = "pip-on-device";
const readPref = () => {
  try {
    return window.localStorage.getItem(DEVICE_PREF) === "1";
  } catch {
    return false;
  }
};
const writePref = (on: boolean) => {
  try {
    if (on) window.localStorage.setItem(DEVICE_PREF, "1");
    else window.localStorage.removeItem(DEVICE_PREF);
  } catch {
    // Browser storage is only a convenience; the toggle still works for this page.
  }
};

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
  /** Which learner answered last ("teachable" or "scripted-demo"), once known. */
  learnerInfo: { id: string; displayName: string } | null;
  /**
   * What Pip believes right now, for the beliefs panel. Null for the scripted
   * learner or until known. Items with `changedThisTurn` changed because of the
   * student's latest message.
   */
  pipBeliefs: StudentBelief[] | null;
  /** Learning metrics and timeline, updated with every turn. Null for the scripted learner or until known. */
  progress: LearningProgress | null;
  /** On-device Pip (an experiment, off unless NEXT_PUBLIC_DEVICE_PIP_EXPERIMENT=1): null when off or unsupported. */
  device: DevicePipState | null;
  sendMessage: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  /** Saves the session as completed. Throws a SessionStoreError if the save fails. */
  endSession: () => Promise<TeachingSession | null>;
}

const SAVE_FAILED = "Your session couldn't be saved. Check your connection and try again.";
const TURN_FAILED = "Pip could not respond. Please try again.";

/** Store errors carry a student-safe message; anything else gets the fallback. */
const saveErrorMessage = (error: unknown) => (error instanceof SessionStoreError ? error.message : SAVE_FAILED);

/** Pip still has to speak: its opening, or a reply to a saved student message. */
const awaitingPip = (s: TeachingSession) => s.status === "in_progress" && (s.messages.length === 0 || s.messages.at(-1)?.role === "student");

/**
 * Owns the lifecycle of one teaching session: loading it, and asking the server
 * for each turn. The server saves the transcript (the student's message, then
 * Pip's reply), so the browser only shows what the server sends back.
 * A student's message appears immediately; if the turn fails, it stays on
 * screen and "Try again" re-sends it, which never saves or answers it twice.
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
  const [learnerInfo, setLearnerInfo] = useState<{ id: string; displayName: string } | null>(null);
  const [pipBeliefs, setPipBeliefs] = useState<StudentBelief[] | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  /** The turn request "Try again" re-sends. Re-sending is always safe: the server never saves or answers it twice. */
  const pendingRef = useRef<TurnBody | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DevicePipState["status"]>("off");
  const [deviceProgress, setDeviceProgress] = useState({ fraction: 0, text: "" });
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [deviceFallbacks, setDeviceFallbacks] = useState(0);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  /** Read inside runTurn without re-creating it. */
  const deviceReady = useRef(false);

  const topic = session ? (getTopic(session.topicId) ?? null) : null;

  /**
   * Asks the server for Pip's turn. The server saves the student's message and
   * Pip's reply; the browser just shows the session it gets back.
   */
  const runTurn = useCallback(async (base: TeachingSession, body: TurnBody) => {
    pendingRef.current = body;
    setLearnerStatus("thinking");
    setErrorKind(null);
    setErrorMessage(null);
    try {
      let result: TurnResponse = await postTurn(base.id, deviceReady.current ? { ...body, replyOn: "device" } : body);
      // The beliefs as of the assessment, which mark what this message changed.
      const assessed = { pip: result.pip, progress: result.progress };
      if (result.device) {
        setSession(result.session);
        const prompt = result.device;
        let text = "";
        try {
          const written = await writeOnDevice(prompt.messages);
          text = written.text;
          setDeviceStats(written.stats);
        } catch (cause) {
          console.error("[on-device Pip]", cause);
        }
        if (text) {
          result = await postDeviceReply(base.id, { forMessageId: prompt.forMessageId, text });
        } else {
          // The device couldn't write it: the server replies instead, without assessing again.
          setDeviceFallbacks((n) => n + 1);
          result = await postTurn(base.id, {});
        }
      }
      pendingRef.current = null;
      setSession(result.session);
      if (result.reply) setLearnerFinished(result.reply.isFinal);
      if (result.learner) setLearnerInfo(result.learner);
      else if (result.pip) setLearnerInfo((known) => known ?? { id: "teachable", displayName: "AI learner" });
      const pip = assessed.pip ?? result.pip;
      const latestProgress = result.progress ?? assessed.progress;
      if (pip) setPipBeliefs(pip);
      if (latestProgress) setProgress(latestProgress);
      setLearnerStatus("idle");
    } catch (error) {
      // Asked Pip to answer what was waiting, but it already had (e.g. in another tab): nothing went wrong.
      if (error instanceof TurnError && error.status === 409 && error.session && !("clientMessageId" in body) && !awaitingPip(error.session)) {
        pendingRef.current = null;
        setSession(error.session);
        setLearnerStatus("idle");
        return;
      }
      if (error instanceof TurnError && error.session) {
        // Show the server's copy, keeping the student's unsent message on screen so "Try again" can send it.
        const unsent = "clientMessageId" in body && !error.session.messages.some((m) => m.id === body.clientMessageId)
          ? base.messages.filter((m) => m.id === body.clientMessageId)
          : [];
        setSession({ ...error.session, messages: [...error.session.messages, ...unsent] });
      }
      setErrorKind("learner");
      setErrorMessage(error instanceof Error ? error.message : TURN_FAILED);
      setLearnerStatus("error");
    }
  }, []);

  const enableDevice = useCallback(() => {
    if (!deviceSupported()) {
      setDeviceStatus("unsupported");
      return;
    }
    writePref(true);
    setDeviceStatus("loading");
    setDeviceError(null);
    loadDevicePip((text, fraction) => setDeviceProgress({ text, fraction }))
      .then(() => {
        deviceReady.current = true;
        setDeviceStatus("ready");
      })
      .catch((cause: unknown) => {
        console.error("[on-device Pip] load failed", cause);
        deviceReady.current = false;
        setDeviceError(cause instanceof Error ? cause.message : "The model couldn't load.");
        setDeviceStatus("error");
      });
  }, []);

  const disableDevice = useCallback(() => {
    writePref(false);
    deviceReady.current = false;
    setDeviceStatus("off");
  }, []);

  // Load the session once on mount; if Pip still owes a message, ask for it.
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
      // Turn on-device Pip back on if this browser had it on before.
      if (DEVICE_EXPERIMENT && getTopic(found.topicId)?.onDevice && readPref()) enableDevice();
      if (awaitingPip(found)) void runTurn(found, {});
      else if (found.messages.length > 0) {
        const [beliefs, loadedProgress] = await Promise.all([getPipBeliefs(found.id), getLearningProgress(found.id)]);
        if (cancelled) return;
        if (beliefs) setPipBeliefs(beliefs);
        if (loadedProgress) setProgress(loadedProgress);
        // Only the AI learner has beliefs, so the sidebar shouldn't say "demo mode" after a reload.
        if (beliefs) setLearnerInfo((known) => known ?? { id: "teachable", displayName: "AI learner" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, runTurn, enableDevice]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!session || !trimmed || learnerStatus !== "idle" || session.status !== "in_progress") {
        return;
      }
      const studentMessage: ChatMessage = { id: createId("msg"), role: "student", text: trimmed, createdAt: nowIso() };
      // Shown right away; it stays on screen if the turn fails, and "Try again" sends it again.
      const next = { ...session, messages: [...session.messages, studentMessage] };
      setSession(next);
      await runTurn(next, { clientMessageId: studentMessage.id, text: trimmed });
    },
    [session, learnerStatus, runTurn],
  );

  const retry = useCallback(async () => {
    if (!session) return;
    await runTurn(session, pendingRef.current ?? {});
  }, [session, runTurn]);

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
    learnerInfo,
    pipBeliefs,
    progress,
    device: DEVICE_EXPERIMENT && topic?.onDevice
      ? {
          status: deviceStatus,
          progress: deviceProgress.fraction,
          progressText: deviceProgress.text,
          lastStats: deviceStats,
          fallbacks: deviceFallbacks,
          error: deviceError,
          enable: enableDevice,
          disable: disableDevice,
        }
      : null,
    sendMessage,
    retry,
    endSession,
  };
}
