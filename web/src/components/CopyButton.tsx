"use client";
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies a value; the icon turns into a tick for a moment. */
export function CopyButton({ value, label, doneLabel, onCopied, className }: { value: string; label: string; doneLabel?: string; onCopied?: (ok: boolean) => void; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button type="button" variant="outline" size="icon-sm" className={className} aria-label={done ? doneLabel || label : label} title={done ? doneLabel || label : label}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); onCopied?.(true); setTimeout(() => setDone(false), 1600); }
        catch { onCopied?.(false); }
      }}>
      {done ? <Check className="text-ok" /> : <Copy />}
    </Button>
  );
}

/** Copy buttons inside HTML from the shared schemas (<button data-clip="…">): one handler for the page. */
export function useClipboardDelegation(copy: string, copied: string) {
  React.useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-clip]").forEach((b) => { b.setAttribute("aria-label", copy); b.title = copy; });
    const on = async (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-clip]"); if (!b) return;
      try {
        await navigator.clipboard.writeText(b.dataset.clip || "");
        b.classList.add("done"); b.title = copied; b.setAttribute("aria-label", copied);
        setTimeout(() => { b.classList.remove("done"); b.title = copy; b.setAttribute("aria-label", copy); }, 1600);
      } catch {}
    };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
  });
}
