"use client";
// «الموافقة والجدولة»: scheduling is the approval. One time for every platform or a time per platform,
// publish now where Nawa publishes directly (Facebook/Instagram through Meta, TikTok, LinkedIn), and
// per-platform status lines. The planned time leads: the time for all platforms and the platforms not
// scheduled yet follow it as it is typed; platforms scheduled at the old planned time move with it on save.
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/CopyButton";
import { Confirm } from "@/components/Confirm";
import { TikTokSettings, useTikTok } from "./TikTokSettings";
import { AUTO_PLATFORMS, captionFor, platformStatus, normAt, isAt } from "@/lib/shared";
import { useCT, todayAt, isVideo, STATUS_CLASS, type Api, type Post } from "./lib";
import type { Form } from "./Editor";
import { cn } from "@/lib/utils";

export function Schedule({ post: p, form, dirty, mode, meta, api, act, saveIfDirty }: {
  post: Post; form: Form; dirty: boolean; mode: "client" | "admin"; meta: any; api: Api;
  act: (a: string, b: any) => Promise<any>; saveIfDirty: () => Promise<boolean>;
}) {
  const { t, pf, fmtTime, errText } = useCT();
  const pfs: string[] = p.platforms || [];
  const def = p.date || `${todayAt()}T20:00`;
  const [allAt, setAllAt] = React.useState(def);
  const [rowAt, setRowAt] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState("");
  const tt = useTikTok(p, api, Boolean(meta?.tiktok?.connected && pfs.includes("tiktok")));

  // the rows start from the post (again whenever it changes)
  React.useEffect(() => {
    setAllAt(def);
    setRowAt(Object.fromEntries(pfs.map((k) => [k, p.schedule?.[k]?.at || def])));
  }, [p.updatedAt, pfs.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  // the planned time leads
  const planned = normAt(form.date);
  const moves = isAt(planned) && planned !== p.date && pfs.some((k) => p.schedule?.[k]?.status === "scheduled" && p.schedule[k].at === p.date);
  React.useEffect(() => {
    if (!isAt(planned)) return;
    setAllAt(planned);
    setRowAt((r) => Object.fromEntries(pfs.map((k) => {
      const sc = p.schedule?.[k];
      if (!sc) return [k, planned];
      if (sc.status === "scheduled" && sc.at === p.date) return [k, planned];
      return [k, r[k] ?? sc.at];
    })));
  }, [planned]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try {
      if (!(await saveIfDirty())) return;
      const d = await fn(); toast.success(ok); return d;
    } catch (e) { toast.error(errText(e)); }
    finally { setBusy(""); }
  };
  const media: any[] = p.media || [];

  function metaLine(k: string) {
    const s = p.schedule?.[k];
    const line = (text: React.ReactNode, bad = false) => <span className={cn("text-sm", bad ? "text-red-700" : "text-muted-foreground")}>{text}</span>;
    if (s?.remote?.url) return line(<>{t("m_published", s.publishedAt ? fmtTime(s.publishedAt) : "")} · <a href={s.remote.url} target="_blank" rel="noopener" className="text-indigo underline underline-offset-2">{t("m_view")}</a></>);
    if (s?.status === "publishing") return line(k === "tiktok" ? t("m_procTt") : k === "linkedin" ? t("m_procLi") : t("m_procIg"));
    const warn = k === "instagram" && !media.length ? t("m_igMedia")
      : k === "tiktok" && !tt.video ? t("m_ttVideo")
      : k === "linkedin" && media.some(isVideo) && media.length > 1 ? t("m_liMix")
      : k === "linkedin" && media.length > 20 ? t("m_li20")
      : k === "facebook" && media.length > 1 && media.some(isVideo) ? t("m_fbMix") : "";
    return (
      <>
        {warn ? line(warn, true) : null}
        {s?.error ? line(<>{s.error.message}{s.error.tries >= 3 ? t("m_stopped") : ""}</>, true) : null}
        {s && s.status === "scheduled" ? line(s.auto === false ? t("m_autoOff") : t("m_auto", pf(k))) : null}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-4" id="ceSched">
      <h3 className="font-heading text-lg font-bold">{t("sched")}</h3>
      <p className="text-sm text-muted-foreground">{mode === "client" ? t("schedLeadClient") : t("schedLead")}</p>
      {meta?.configured ? (
        <p className="rounded-lg bg-card px-3 py-2 text-sm">{meta.accounts ? t("metaOn", meta.accounts.page, meta.accounts.ig) : <><b>Meta:</b> {meta.error || t("metaErr")}</>}</p>
      ) : null}
      {moves ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" id="ceSchedNote">{t("schedMoveNote")}</p> : null}

      {pfs.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="datetime-local" dir="ltr" id="ceAllAt" aria-label={t("allAt")} value={allAt} className="h-10 w-auto"
              onChange={(e) => {
                const v = normAt(e.target.value); setAllAt(e.target.value);
                if (isAt(v)) setRowAt((r) => Object.fromEntries(pfs.map((k) => [k, p.schedule?.[k] ? r[k] : v])));
              }} />
            <Button id="ceAll" size="lg" className="bg-lime text-ink hover:bg-lime/85" disabled={!!busy}
              onClick={() => run("all", () => act("schedule", { id: p.id, platforms: p.platforms, at: allAt }), t("okAll"))}>{t("schedAll", pfs.length)}</Button>
          </div>
          <ul className="flex flex-col gap-3">
            {pfs.map((k) => {
              const s = p.schedule?.[k]; const st = platformStatus(p, k);
              const isTt = k === "tiktok" && Boolean(meta?.tiktok?.connected);
              const isLi = k === "linkedin" && Boolean(meta?.linkedin?.ready);
              const direct = isTt || isLi || (meta?.configured && AUTO_PLATFORMS.includes(k));
              const ttBlock = isTt && st !== "published" && !tt.ready; // TikTok's settings must be chosen first
              const canPublish = direct && st !== "published" && st !== "publishing" && !(k === "instagram" && !media.length);
              const differs = s && s.status === "scheduled" && normAt(rowAt[k] || "") !== s.at && !(moves && s.at === p.date);
              return (
                <li key={k} className="flex flex-col gap-3 rounded-xl border bg-card p-3" data-row={k}>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{pf(k)}</b>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs", STATUS_CLASS[st])}>{t("s_" + st)}{s?.at ? <> · <span dir="ltr">{s.at.replace("T", " ")}</span></> : null}</span>
                    <CopyButton className="ms-auto" value={captionFor({ ...p, captions: form.captions }, k)} label={t("copyPf", pf(k))} doneLabel={t("copied")}
                      onCopied={(ok) => (ok ? toast.success(t("copied")) : toast.error(t("copyFail")))} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="datetime-local" dir="ltr" data-at={k} aria-label={t("pfAt", pf(k))} value={rowAt[k] || def} className="h-9 w-auto"
                      onChange={(e) => setRowAt((r) => ({ ...r, [k]: e.target.value }))} />
                    <Button data-one={k} disabled={!!busy || ttBlock} variant={differs ? "default" : "outline"} className={cn(differs && "bg-lime text-ink hover:bg-lime/85")}
                      onClick={() => run(k, () => act("schedule", { id: p.id, platforms: [k], at: rowAt[k] || def }), t("okOne", pf(k)))}>{s ? t("updateTime") : t("schedHere")}</Button>
                    {canPublish ? (
                      <Confirm title={t("publishConfirm", pf(k))} action={t("publishNow", pf(k))} destructive={false} onConfirm={async () => {
                        const d = await run("now" + k, () => act("publish", { id: p.id, platform: k }), t("okPublished", pf(k)));
                        const r = d?.result;
                        if (r === "pending") toast(k === "tiktok" ? t("pendTt") : k === "linkedin" ? t("pendLi") : t("pendIg"));
                        else if (r === "published" && k === "tiktok") toast(t("pubTt"));
                        else if (r === "failed") toast.error(d.post?.schedule?.[k]?.error?.message || t("pubFail"));
                      }}>
                        <Button data-now={k} disabled={!!busy || ttBlock}>{busy === "now" + k ? t("publishingNow") : t("publishNow", pf(k))}</Button>
                      </Confirm>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {direct && s && st === "scheduled" ? (
                      <Button variant="link" size="sm" className="h-auto px-0" data-auto={k} disabled={!!busy}
                        onClick={() => run("auto" + k, () => act("auto", { id: p.id, platform: k, value: s.auto === false }), s.auto === false ? t("okAutoOn") : t("okAutoOff"))}>
                        {s.auto === false ? t("autoOn") : t("autoOff")}</Button>
                    ) : null}
                    {s && !(direct && (st !== "published" || s.remote)) ? (
                      <Button variant="outline" size="sm" data-pub={k} disabled={!!busy}
                        onClick={() => run("pub" + k, () => act("published", { id: p.id, platform: k, value: st !== "published" }), st !== "published" ? t("okPub") : t("okUnpub"))}>
                        {st === "published" ? t("markUnpub") : t("markPub")}</Button>
                    ) : null}
                    {s && st !== "published" ? (
                      <Button variant="link" size="sm" className="h-auto px-0 text-destructive" data-un={k} disabled={!!busy}
                        onClick={() => run("un" + k, () => act("unschedule", { id: p.id, platforms: [k] }), t("okUn"))}>{t("unsched")}</Button>
                    ) : null}
                  </div>
                  {direct ? <div className="flex flex-col gap-1">{metaLine(k)}</div> : null}
                  {isTt && st !== "published" && st !== "publishing" ? <TikTokSettings post={p} tt={tt} act={act} /> : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : <p className="text-sm text-muted-foreground">{t("pickPf")}</p>}
    </section>
  );
}
