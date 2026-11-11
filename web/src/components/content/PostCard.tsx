"use client";
import { Play } from "lucide-react";
import { PLATFORMS, platformStatus } from "@/lib/shared";
import { useCT, stOf, isVideo, STATUS_CLASS, type Api, type Post } from "./lib";
import { cn } from "@/lib/utils";

/** Small IG/FB/TT/IN badges coloured by each platform's status on the post. */
export function PfBadges({ p, small }: { p: Post; small?: boolean }) {
  const { t, pf } = useCT();
  return (
    <>
      {(p.platforms || []).map((k: string) => {
        const s = platformStatus(p, k);
        return <span key={k} title={`${pf(k)} · ${t("s_" + s)}`} className={cn("rounded border font-mono font-semibold", small ? "px-1 text-[0.6rem]" : "px-1.5 text-[0.65rem]", STATUS_CLASS[s])}>{PLATFORMS[k].short}</span>;
      })}
    </>
  );
}

/** A post's first picture (or the video's cover / an early frame). */
export function Thumb({ m, cover, api, size = 300, className }: { m: any; cover?: any; api: Api; size?: number; className?: string }) {
  if (isVideo(m)) {
    return (
      <span className={cn("relative block size-full", className)}>
        {cover ? <img src={api.media(cover.id, size)} alt="" loading="lazy" className="size-full object-cover" />
          : <video src={api.media(m.id) + "#t=0.5"} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} className="size-full object-cover" />}
        <span className="ct-play absolute inset-0 grid place-items-center"><span className="grid size-9 place-items-center rounded-full bg-black/55 text-white"><Play className="size-4 fill-current" /></span></span>
      </span>
    );
  }
  return <img src={api.media(m.id, size)} alt={m.name || ""} loading="lazy" className={cn("size-full object-cover", className)} />;
}

export function PostCard({ p, api, onOpen }: { p: Post; api: Api; onOpen: (id: string) => void }) {
  const { t, fmtAt } = useCT();
  const first = (p.media || [])[0];
  const st = stOf(p);
  return (
    <button type="button" data-open={p.id} onClick={() => onOpen(p.id)}
      className={cn("ct-post flex overflow-hidden rounded-2xl border bg-card text-start transition-shadow hover:shadow-md", p.proposal && "proposal border-[#D97757]/50")}>
      <span className="ct-cover relative aspect-[4/5] w-28 shrink-0 bg-muted">
        {first ? <Thumb m={first} cover={p.cover} api={api} /> : (
          <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground"><b className="text-foreground">{t("k_" + p.kind)}</b>{t("noFiles")}</span>
        )}
        {(p.media || []).length > 1 ? <i dir="ltr" className="absolute end-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white not-italic">1/{p.media.length}</i> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <span className={cn("self-start rounded-full border px-2 py-0.5 text-xs", STATUS_CLASS[st])}>{t("s_" + st)}</span>
        <b className="line-clamp-2">{p.title}</b>
        <span className="text-sm text-muted-foreground">{fmtAt(p.date)} · {t("k_" + p.kind)}</span>
        <span className="flex flex-wrap gap-1"><PfBadges p={p} /></span>
      </span>
    </button>
  );
}
