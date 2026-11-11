"use client";
// «المنصات»: one platform at a time. Tiles on top, the chosen platform's steps below. Clients tick
// steps off (remembered on this device); LinkedIn/TikTok end with "tell Nawa", which sets «قيد المراجعة».
// Instagram goes through the Facebook Page, so it waits for Facebook. TikTok and LinkedIn are connected
// by the client themselves once Nawa's apps are set up.
import * as React from "react";
import { Check, ExternalLink, Maximize2, PartyPopper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Confirm } from "@/components/Confirm";
import { AiConnector } from "./AiConnector";
import { portal } from "@/lib/api";
import { pick, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PORTAL_PLATFORMS as PLATFORMS, PLATFORM_ORDER, PORTAL_STATUS as STATUS, ICONS } from "@/lib/shared";
import { T, TS, TTP, LIP } from "@/i18n/portal";

const TONE: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  wait: "bg-amber-100 text-amber-800",
  review: "bg-indigo/10 text-indigo",
  ok: "bg-green-100 text-green-800",
  bad: "bg-red-100 text-red-800",
};

export function PfIcon({ k, size = 20 }: { k: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[k] }} />;
}
function PfLogo({ k, size = 20, className }: { k: string; size?: number; className?: string }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white", className)} style={{ background: PLATFORMS[k].color }}>
      <PfIcon k={k} size={size} />
    </span>
  );
}
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const { lang } = useLang();
  const tone = STATUS[status]?.tone || "idle";
  return <span className={cn("pt-dot tone-" + tone, "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[tone])}>{label ?? pick(STATUS[status]?.label, lang)}</span>;
}

const ticksKey = (email: string) => `nawa.steps.${email || ""}`;
function useTicks(email: string) {
  const [ticks, set] = React.useState<Record<string, boolean[]>>({});
  React.useEffect(() => { try { set(JSON.parse(localStorage.getItem(ticksKey(email)) || "{}")); } catch {} }, [email]);
  const setTick = (k: string, i: number, on: boolean) => set((all) => {
    const next = { ...all, [k]: [...(all[k] || [])] }; next[k][i] = on;
    try { localStorage.setItem(ticksKey(email), JSON.stringify(next)); } catch {}
    return next;
  });
  return [ticks, setTick] as const;
}

const blockedBy = (k: string, st: any) => (k === "instagram" && st.facebook?.status !== "active" ? "facebook" : null);
const nextPlatform = (st: any) => PLATFORM_ORDER.find((k: string) => st[k]?.status !== "active" && !blockedBy(k, st)) || null;
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);

export function Platforms({ me, setMe, flash, goContent }: { me: any; setMe: (m: any) => void; flash: any; goContent: () => void }) {
  const t = useT(T, TS);
  const ttp = useT(TTP);
  const lip = useT(LIP);
  const { lang } = useLang();
  const st = me.status;
  const [pf, setPf] = React.useState<string | null>(() => (PLATFORM_ORDER.includes(flash.pf) ? flash.pf : nextPlatform(st)));
  const [ttMsg, setTtMsg] = React.useState<string>(flash.tt || "");
  const [liMsg, setLiMsg] = React.useState<string>(flash.li || "");
  const [liPick, setLiPick] = React.useState(false);
  const [shot, setShot] = React.useState<{ src: string; alt: string } | null>(null);
  const [ticks, setTick] = useTicks(me.user?.email);
  const [checking, setChecking] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const active = PLATFORM_ORDER.filter((k: string) => st[k]?.status === "active").length;
  const allActive = active === PLATFORM_ORDER.length;
  const k = pf, p = k ? PLATFORMS[k] : null, s = k ? st[k] || { status: "not_started" } : null;

  const nawaPerson = () => {
    const n = me.nawa || {};
    if (!n.linkedin_name) return `<b>${esc(t("nawaPersonFallback"))}</b>`;
    return `<b>${esc(n.linkedin_name)}</b>${n.linkedin_url ? ` (<a href="${esc(n.linkedin_url)}" target="_blank" rel="noopener">${esc(t("profileLink"))} ↗</a>)` : ""}`;
  };
  const setStatus = (status: any) => setMe({ ...me, status });
  const run = async (fn: () => Promise<any>) => { setBusy(true); try { await fn(); } catch {} setBusy(false); };

  function steps(interactive: boolean) {
    const list: string[] = pick(p.steps, lang);
    const mine = ticks[k!] || [];
    return (
      <>
        <ol className="flex flex-col gap-3">
          {list.map((x, i) => {
            const on = Boolean(mine[i]);
            const sh = p.shots?.[i];
            const alt = `${pick(p.name, lang)} · ${i + 1}`;
            return (
              <li key={i} className={cn("flex gap-3 rounded-xl border bg-card p-3", on && interactive && "border-green-200 bg-green-50/60")}>
                {interactive ? (
                  <button type="button" data-tick={i} onClick={() => setTick(k!, i, !on)} aria-pressed={on} aria-label={t(on ? "unmark" : "mark", i + 1)} title={t(on ? "unmark" : "mark", i + 1)}
                    className={cn("pt-num grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-colors", on && "on", on ? "border-green-600 bg-green-600 text-white" : "border-border hover:border-indigo")}>
                    {on ? <Check className="size-4" /> : i + 1}
                  </button>
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold">{i + 1}</span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
                  <div className="rich leading-relaxed" dangerouslySetInnerHTML={{ __html: x.replaceAll("{person}", nawaPerson()) }} />
                  {sh ? (
                    <button type="button" className="group relative w-full max-w-md overflow-hidden rounded-lg border" onClick={() => setShot({ src: `/assets/guides/${sh}.webp`, alt })} aria-label={`${t("shotOpen")}: ${alt}`}>
                      <img src={`/assets/guides/${sh}.webp`} alt={alt} width={720} height={450} loading="lazy" decoding="async" className="block w-full" />
                      <span className="absolute end-2 top-2 grid size-8 place-items-center rounded-lg bg-black/60 text-white opacity-80 group-hover:opacity-100"><Maximize2 className="size-4" /></span>
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        {p.shots?.some(Boolean) ? <p className="text-xs text-muted-foreground">{t("shotNote")}</p> : null}
      </>
    );
  }

  function panelHead() {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <PfLogo k={k!} />
          <div className="flex min-w-0 flex-1 flex-col">
            <b className="text-lg">{pick(p.name, lang)}</b>
            {s.name && s.status !== "active" ? <a className="truncate text-sm text-muted-foreground" href={s.url} target="_blank" rel="noopener" dir="ltr">{s.name} ↗</a> : null}
          </div>
          <StatusPill status={s.status} />
        </div>
        {s.note ? <Alert><AlertDescription><b>{t("nawaNote")}:</b> {s.note}</AlertDescription></Alert> : null}
      </div>
    );
  }

  const Msg = ({ text, good }: { text: string; good: boolean }) => (
    <p role="status" className={cn("pt-ttmsg rounded-lg px-3 py-2 text-sm", !good && "bad", good ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{text}</p>
  );
  const ConnectSteps = ({ steps }: { steps: string[] }) => (
    <>
      <b>{t("stepsTitle")}</b>
      <ol className="flex flex-col gap-2">{steps.map((x, i) => (
        <li key={i} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold">{i + 1}</span><span className="pt-0.5">{x}</span></li>
      ))}</ol>
    </>
  );

  let panel: React.ReactNode;
  if (!k) {
    panel = (
      <div className="flex flex-col items-start gap-3">
        <PartyPopper className="size-8 text-indigo" />
        <b className="text-lg">{t("allSetTitle")}</b>
        <p className="text-muted-foreground">{t("allActive")}</p>
        <Button className="bg-lime text-ink hover:bg-lime/85" size="lg" onClick={goContent}>{t("goContent")}</Button>
      </div>
    );
  } else if (k === "tiktok" && s.connect) {
    panel = s.status === "active" ? (
      <div className="flex flex-col gap-4">
        {panelHead()}
        {ttMsg ? <Msg text={ttp(ttMsg)} good={/connected|off/.test(ttMsg)} /> : null}
        <div className="pt-ttacct flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          {s.avatar ? <img src={s.avatar} alt="" width={44} height={44} className="rounded-full" /> : null}
          <div className="flex flex-col"><small className="text-muted-foreground">{ttp("as")}</small>
            <b>{s.url ? <a href={s.url} target="_blank" rel="noopener" className="hover:underline">{s.name} ↗</a> : s.name}</b></div>
        </div>
        <p className="text-muted-foreground">{ttp("how")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" className="bg-lime text-ink hover:bg-lime/85" onClick={goContent}>{t("goContent")}</Button>
          <Confirm title={ttp("confirm")} action={ttp("disconnect")} onConfirm={() => run(async () => { setStatus((await portal("tiktok-disconnect", {})).status); setTtMsg("off"); })}>
            <Button variant="ghost" className="text-destructive" disabled={busy} id="ptTtOff">{ttp("disconnect")}</Button>
          </Confirm>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        {panelHead()}
        {ttMsg ? <Msg text={ttp(ttMsg)} good={/connected|off/.test(ttMsg)} /> : null}
        {s.status === "issue" ? <Msg text={ttp("issue")} good={false} /> : null}
        <ConnectSteps steps={ttp("steps")} />
        <Button asChild size="lg" className="pt-ttbtn self-start"><a className="pt-ttbtn" href="/api/portal?action=tiktok-connect"><PfIcon k="tiktok" size={18} />{ttp(s.status === "issue" ? "reconnect" : "connect")}</a></Button>
        <p className="text-sm text-muted-foreground">{ttp("scopes")}</p>
      </div>
    );
  } else if (k === "linkedin" && s.connect) {
    const pages = s.pages || [];
    const picker = pages.length && (s.status === "waiting_client" || liPick) ? (
      <div className="pt-lipick flex flex-col gap-2">
        <b>{lip("pick")}</b>
        {pages.map((pg: any) => (
          <button key={pg.id} type="button" data-lipage={pg.id} disabled={busy}
            onClick={() => run(async () => { setStatus((await portal("linkedin-page", { id: pg.id })).status); setLiPick(false); setLiMsg("picked"); })}
            className={cn("flex items-center gap-3 rounded-xl border bg-card p-3 text-start transition-colors hover:border-indigo", s.name === pg.name && s.status === "active" && "border-indigo bg-indigo/5")}>
            <PfLogo k="linkedin" size={16} className="size-9" />
            <span className="flex min-w-0 flex-1 flex-col"><b>{pg.name}</b>{pg.vanity ? <small dir="ltr" className="truncate text-muted-foreground">linkedin.com/company/{pg.vanity}</small> : null}</span>
            <span className="text-sm font-medium text-indigo">{lip("choose")}</span>
          </button>
        ))}
      </div>
    ) : null;
    panel = s.status === "active" || (s.status === "waiting_client" && pages.length) ? (
      <div className="flex flex-col gap-4">
        {panelHead()}
        {liMsg ? <Msg text={lip(liMsg)} good={/connected|off|picked/.test(liMsg)} /> : null}
        {s.status === "active" ? (
          <div className="pt-ttacct flex items-center gap-3 rounded-xl bg-muted/60 p-3"><PfLogo k="linkedin" />
            <div className="flex flex-col"><small className="text-muted-foreground">{lip("page")}</small>
              <b>{s.url ? <a href={s.url} target="_blank" rel="noopener" className="hover:underline">{s.name} ↗</a> : s.name}</b></div>
          </div>
        ) : null}
        {picker}
        {s.status === "active" ? <p className="text-muted-foreground">{lip("how")}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {s.status === "active" ? <Button size="lg" className="bg-lime text-ink hover:bg-lime/85" onClick={goContent}>{t("goContent")}</Button> : null}
          {s.status === "active" && pages.length > 1 && !liPick ? <Button variant="outline" id="ptLiChange" onClick={() => setLiPick(true)}>{lip("change")}</Button> : null}
          <Confirm title={lip("confirm")} action={lip("disconnect")} onConfirm={() => run(async () => { setStatus((await portal("linkedin-disconnect", {})).status); setLiMsg("off"); setLiPick(false); })}>
            <Button variant="ghost" className="text-destructive" disabled={busy} id="ptLiOff">{lip("disconnect")}</Button>
          </Confirm>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        {panelHead()}
        {liMsg ? <Msg text={lip(liMsg)} good={/connected|off|picked/.test(liMsg)} /> : null}
        {s.status === "issue" ? <Msg text={lip("issue")} good={false} /> : null}
        <ConnectSteps steps={lip("steps")} />
        <Button asChild size="lg" className="self-start bg-[#0A66C2] hover:bg-[#0A66C2]/90"><a className="pt-ttbtn" href="/api/portal?action=linkedin-connect"><PfIcon k="linkedin" size={18} />{lip(s.status === "issue" ? "reconnect" : "connect")}</a></Button>
        <p className="text-sm text-muted-foreground">{lip("scopes")}</p>
      </div>
    );
  } else if (s.status === "active") {
    panel = (
      <div className="flex flex-col gap-4">
        {panelHead()}
        <p className="flex items-center gap-2 font-medium text-green-700"><Check className="size-5" />{t("activeLine", pick(p.name, lang))}
          {s.name ? <a href={s.url} target="_blank" rel="noopener" dir="ltr" className="text-foreground hover:underline">· {s.name} ↗</a> : null}</p>
        <Collapsible className="pt-steps-again">
          <CollapsibleTrigger asChild><Button variant="outline">{t("stepsAgain")}</Button></CollapsibleTrigger>
          <CollapsibleContent className="pt-3">{steps(false)}</CollapsibleContent>
        </Collapsible>
      </div>
    );
  } else {
    const blocker = blockedBy(k, st);
    const n = pick(p.steps, lang).length, ticked = (ticks[k] || []).filter(Boolean).length;
    const manualDone = !p.auto && s.status === "in_review";
    panel = (
      <div className="flex flex-col gap-4">
        {panelHead()}
        {blocker ? (
          <div className="pt-wait flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <span>{t("afterFb")}</span>
            <Button variant="outline" data-pf={blocker} onClick={() => setPf(blocker)}>{t("goFb")}</Button>
          </div>
        ) : null}
        <div className={cn("flex flex-col gap-3", blocker && "pt-faded pointer-events-none opacity-50")}>
          <div className="pt-stepcount flex items-center justify-between gap-2"><b>{t("stepsTitle")}</b><span className="muted text-sm text-muted-foreground">{t("stepsCount", ticked, n)}</span></div>
          {steps(!blocker)}
        </div>
        {p.auto ? <p className="text-sm text-muted-foreground">{t("autoNote")}</p>
          : manualDone ? <p className="pt-reviewing rounded-lg bg-indigo/10 px-3 py-2 text-indigo">{t("reviewing")}</p>
          : (
            <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3", ticked >= n && "border-lime bg-lime/15")}>
              <p className="text-muted-foreground">{t("tellLead")}</p>
              <Button size="lg" id="ptTell" disabled={busy} className={ticked >= n ? "bg-lime text-ink hover:bg-lime/85" : ""} variant={ticked >= n ? "default" : "outline"}
                onClick={() => run(async () => setStatus((await portal("platform-done", { platform: k })).status))}>{t("tellNawa")}</Button>
            </div>
          )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="pt-progress-top flex items-center justify-between gap-2">
            <b>{t("progress", active, PLATFORM_ORDER.length)}</b>
            <Button variant="ghost" size="sm" disabled={checking} onClick={async () => { setChecking(true); try { setMe(await portal("me&fresh=1")); } catch {} setChecking(false); }}>
              <RefreshCw className={cn(checking && "animate-spin")} data-icon="inline-start" />{t("checkNow")}
            </Button>
          </div>
          <Progress value={(active / PLATFORM_ORDER.length) * 100} aria-label={t("progress", active, PLATFORM_ORDER.length)} className="h-2 [&>*]:bg-indigo" />
          <p className="text-sm text-muted-foreground">{allActive ? t("allActive") : t("platformsLead")}</p>
        </CardContent>
      </Card>

      <div role="tablist" aria-label={t("tabPlatforms")} className="pt-tiles grid grid-cols-2 gap-3 md:grid-cols-4">
        {PLATFORM_ORDER.map((x: string) => {
          const xs = st[x] || { status: "not_started" };
          const waiting = blockedBy(x, st) && xs.status !== "active";
          return (
            <button key={x} type="button" role="tab" data-pf={x} aria-selected={x === k} onClick={() => setPf(x)}
              className={cn("pt-tile flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-start transition-all hover:border-indigo/50 hover:shadow-sm",
                x === k && "on border-indigo ring-2 ring-indigo/20", waiting && "waiting opacity-70")}>
              <PfLogo k={x} />
              <b>{pick(PLATFORMS[x].name, lang)}</b>
              <StatusPill status={xs.status} label={waiting ? t("afterFbShort") : undefined} />
            </button>
          );
        })}
      </div>

      <Card className="pt-panel"><CardContent>{panel}</CardContent></Card>

      <AiConnector />

      <Dialog open={!!shot} onOpenChange={(o) => !o && setShot(null)}>
        <DialogContent className="max-w-4xl p-2 sm:max-w-4xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{shot?.alt}</DialogTitle>
          {shot ? <img src={shot.src} alt={shot.alt} className="w-full rounded-lg" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
