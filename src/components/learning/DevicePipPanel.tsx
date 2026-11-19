"use client";

import type { DevicePipState } from "@/lib/hooks/useTeachingSession";
import { Button } from "@/components/ui/Button";

interface DevicePipPanelProps {
  device: DevicePipState;
  learnerName?: string;
}

/**
 * Turns on-device Pip on or off for topics that have one, and shows how fast it writes.
 * The server still runs the assessor and owns the notebook; only Pip's words are written here.
 */
export function DevicePipPanel({ device, learnerName = "Pip" }: DevicePipPanelProps) {
  const { status, lastStats } = device;
  return (
    <section className="card p-5" aria-labelledby="device-pip-title" data-testid="device-pip">
      <div className="flex items-center justify-between gap-3">
        <h2 id="device-pip-title" className="text-sm font-semibold text-charcoal">
          {learnerName} on this device
        </h2>
        {status === "ready" && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-charcoal">On</span>}
      </div>

      {status === "off" && (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Run {learnerName} in your browser with a small model that was trained to forget derivatives, so it only knows
            what you teach it. It downloads about 1.2 GB the first time.
          </p>
          <Button size="sm" className="mt-3" onClick={device.enable}>
            Run {learnerName} on this device
          </Button>
        </>
      )}

      {status === "loading" && (
        <div className="mt-3" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(device.progress * 100)} aria-label="Loading the on-device model">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(device.progress * 100)}%` }} />
          </div>
          <p className="mt-2 break-words text-xs text-muted">{device.progressText || "Starting…"}</p>
        </div>
      )}

      {status === "ready" && (
        <div className="mt-2 text-sm text-muted" aria-live="polite">
          <p>{learnerName}&apos;s replies are written on your device. The server still checks what you teach.</p>
          {lastStats ? (
            <p className="mt-2 text-charcoal/90" data-testid="device-pip-speed">
              Last reply: {lastStats.tokens} tokens in {lastStats.seconds.toFixed(1)} s ({Math.round(lastStats.tokensPerSecond)} tokens/s)
            </p>
          ) : (
            <p className="mt-2">Send a message to see how fast it is.</p>
          )}
          {device.fallbacks > 0 && (
            <p className="mt-1 text-xs">The server wrote {device.fallbacks} {device.fallbacks === 1 ? "reply" : "replies"} when the device couldn&apos;t.</p>
          )}
          <Button size="sm" variant="ghost" className="mt-2" onClick={device.disable}>
            Use the server instead
          </Button>
        </div>
      )}

      {status === "unsupported" && (
        <p className="mt-2 text-sm text-muted">This browser can&apos;t run it (it needs WebGPU). {learnerName} will keep replying from the server.</p>
      )}

      {status === "error" && (
        <div className="mt-2 text-sm text-muted">
          <p>The model couldn&apos;t load{device.error ? `: ${device.error}` : "."} {learnerName} will keep replying from the server.</p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={device.enable}>
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}
