"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTeachingSession } from "@/lib/hooks/useTeachingSession";
import { PIP } from "@/lib/learner";
import { accentStyle, getSubject } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatComposer } from "@/components/ChatComposer";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { LearnerAvatar } from "@/components/LearnerAvatar";
import { TeachingTips } from "@/components/TeachingTips";
import { SessionProgress } from "@/components/SessionProgress";
import { Logo } from "@/components/Logo";
import { LoadErrorState } from "@/components/LoadErrorState";
import { ArrowRightIcon, SUBJECT_ICONS } from "@/components/illustrations/Icons";

export function TeachingWorkspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const state = useTeachingSession(sessionId);
  const { session, topic, learnerStatus, errorKind, errorMessage, learnerFinished } = state;
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCount = session?.messages.length ?? 0;

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount, learnerStatus]);

  // A completed session should be reviewed, not taught.
  useEffect(() => {
    if (session?.status === "completed") router.replace(`/reflect/${session.id}`);
  }, [session, router]);

  if (state.loading) return <WorkspaceShell><LoadingState /></WorkspaceShell>;
  if (state.loadError) return <WorkspaceShell><LoadErrorState message={state.loadError} /></WorkspaceShell>;
  if (state.notFound || !session || !topic) return <WorkspaceShell><NotFoundState /></WorkspaceShell>;

  const subject = getSubject(topic.subjectId);
  const Icon = SUBJECT_ICONS[topic.subjectId];
  const studentMessages = session.messages.filter((m) => m.role === "student").length;
  const learnerMessages = session.messages.length - studentMessages;
  const latestMood = [...session.messages].reverse().find((m) => m.role === "learner")?.mood ?? "curious";

  const endSession = async () => {
    setEnding(true);
    setEndError(null);
    try {
      const ended = await state.endSession();
      if (ended) return router.push(`/reflect/${ended.id}`);
    } catch (error) {
      setEndError(error instanceof Error ? error.message : "The session couldn't be ended. Try again.");
    }
    setEnding(false);
  };

  const sidebar = (
    <div className="flex flex-col gap-4">
      <section className="card p-5" aria-labelledby="learner-card-title">
        <div className="flex items-center gap-3">
          <LearnerAvatar mood={learnerStatus === "thinking" ? "thinking" : latestMood} size={52} />
          <div>
            <h2 id="learner-card-title" className="font-display text-xl text-charcoal">{PIP.name}</h2>
            <p className="text-sm text-muted">
              {learnerStatus === "thinking" ? "Thinking it over…" : learnerFinished ? "Ready to wrap up" : "Listening to you"}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Learning objective</p>
        <p className="mt-1 text-[15px] leading-relaxed text-charcoal/90">{topic.learningObjective}</p>
      </section>
      <TeachingTips tips={topic.teachingTips} compact />
      {state.learnerInfo?.id === "teachable" ? (
        <section className="rounded-2xl border border-dashed border-line bg-paper/60 p-4 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-charcoal/80">AI learner</p>
          <p className="mt-1">
            {PIP.name} only knows what you teach it in this session, including any mistakes. It is an AI
            and can still misunderstand you, so check what it says back.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-line bg-paper/60 p-4 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-charcoal/80">Demo mode</p>
          <p className="mt-1">
            {PIP.name} is powered by the <em>{state.learnerInfo?.displayName ?? "Scripted demo learner"}</em>. It
            follows a fixed sequence of questions and mistakes for this topic and does not interpret your exact
            wording.
          </p>
        </section>
      )}
    </div>
  );

  return (
    <WorkspaceShell>
      <div style={accentStyle(subject)} className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-ivory/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <Logo compact />
            <div className="order-last flex min-w-0 basis-full items-center gap-3 sm:order-none sm:flex-1 sm:basis-auto">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl accent-bg accent-text">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] accent-text">{subject.label}</p>
                <h1 className="truncate font-display text-lg leading-tight text-charcoal sm:text-xl">{topic.title}</h1>
              </div>
            </div>
            <SessionProgress
              startedAt={session.startedAt}
              studentMessages={studentMessages}
              learnerMessages={learnerMessages}
              className="hidden lg:flex"
            />
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="focus-ring rounded-full border border-line bg-paper px-3 py-2 text-sm font-medium text-forest lg:hidden"
                aria-expanded={sidebarOpen}
                aria-controls="workspace-sidebar"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                {sidebarOpen ? "Hide tips" : "Tips"}
              </button>
              {confirmEnd ? (
                <div className="flex items-center gap-2 animate-pop" role="group" aria-label="Confirm ending the session">
                  <Button size="sm" variant="accent" onClick={endSession} disabled={ending}>
                    {ending ? "Ending…" : "Yes, end session"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmEnd(false)} disabled={ending}>
                    Keep going
                  </Button>
                  {endError && (
                    <span role="alert" className="text-sm text-danger">
                      {endError}
                    </span>
                  )}
                </div>
              ) : (
                <Button size="sm" variant={learnerFinished ? "accent" : "outline"} onClick={() => setConfirmEnd(true)}>
                  End Session
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
          {/* Mobile sidebar */}
          <aside id="workspace-sidebar" className={cn("lg:hidden", !sidebarOpen && "hidden")} aria-label="Session details">
            {sidebar}
          </aside>

          {/* Conversation */}
          <section className="flex min-h-[60vh] flex-col" aria-label="Conversation with Pip">
            <div className="card flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" role="log" aria-live="polite" aria-relevant="additions">
                <ol className="flex flex-col gap-5">
                  {session.preExplanation && (
                    <li className="mx-auto max-w-xl rounded-2xl bg-butter/50 px-4 py-3 text-sm leading-relaxed text-charcoal/85">
                      <span className="font-semibold">Your explanation before starting: </span>
                      {session.preExplanation}
                    </li>
                  )}
                  {session.messages.map((m) => (
                    <li key={m.id}>
                      <ChatMessage message={m} learnerName={PIP.name} />
                    </li>
                  ))}
                  {learnerStatus === "thinking" && (
                    <li>
                      <ThinkingIndicator learnerName={PIP.name} />
                    </li>
                  )}
                  {learnerStatus === "error" && (
                    <li>
                      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-charcoal">
                        <span className="font-medium text-danger">
                          {errorKind === "save" ? "Not saved yet." : `${PIP.name} couldn\u2019t respond.`}
                        </span>
                        <span className="text-muted">{errorMessage}</span>
                        <Button size="sm" variant="outline" onClick={() => void state.retry()}>Try again</Button>
                      </div>
                    </li>
                  )}
                  {learnerFinished && learnerStatus === "idle" && (
                    <li className="mx-auto flex max-w-xl flex-col items-center gap-2 rounded-2xl bg-sage/60 px-5 py-4 text-center text-sm text-charcoal animate-fade-up">
                      <Badge tone="forest">Nice work</Badge>
                      <p>Pip has worked through everything on its list. You can keep explaining, or end the session and reflect.</p>
                      <Button size="sm" onClick={() => setConfirmEnd(true)}>
                        End and reflect <ArrowRightIcon className="size-4" />
                      </Button>
                    </li>
                  )}
                </ol>
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-line bg-ivory/60 p-3 sm:p-4">
                <ChatComposer
                  onSend={state.sendMessage}
                  disabled={learnerStatus !== "idle"}
                  autoFocus
                  placeholder={learnerStatus === "thinking" ? `${PIP.name} is thinking…` : undefined}
                />
              </div>
            </div>
            <SessionProgress
              startedAt={session.startedAt}
              studentMessages={studentMessages}
              learnerMessages={learnerMessages}
              className="mt-3 justify-center lg:hidden"
            />
          </section>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block" aria-label="Session details">
            <div className="sticky top-24">{sidebar}</div>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-1 flex-col bg-ivory">{children}</main>;
}

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24" role="status">
      <LearnerAvatar mood="thinking" size={72} animated />
      <p className="text-muted">Opening your session…</p>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <LearnerAvatar mood="confused" size={88} />
      <h1 className="font-display text-3xl text-forest">We couldn&rsquo;t find that session.</h1>
      <p className="text-muted">
        It may have been deleted, or it belongs to a different account. Your sessions are saved to the account
        you&rsquo;re logged in with.
      </p>
      <div className="flex gap-3">
        <Button href="/topics">Start a new session</Button>
        <Link href="/sessions" className="focus-ring inline-flex items-center rounded-full px-4 text-forest hover:underline">
          See past sessions
        </Link>
      </div>
    </div>
  );
}
