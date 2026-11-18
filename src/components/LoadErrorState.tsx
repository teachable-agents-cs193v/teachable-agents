"use client";

import { LearnerAvatar } from "@/components/LearnerAvatar";
import { Button } from "@/components/ui/Button";

/** Shown when sessions couldn't be loaded from the server (offline, server error, logged out). */
export function LoadErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <LearnerAvatar mood="confused" size={88} />
      <h1 className="font-display text-3xl text-forest">We couldn&rsquo;t load your sessions.</h1>
      <p className="text-muted">{message}</p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}
