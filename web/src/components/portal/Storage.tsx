"use client";
// «التخزين»: Google Drive (free, up to 15 GB) and «تخزين نواة» (a monthly space plan, paid in DZD).
import * as React from "react";
import { Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Confirm } from "@/components/Confirm";
import { PlanDialog } from "./PlanDialog";
import { portal, ApiError } from "@/lib/api";
import { num as numL, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { T, TS } from "@/i18n/portal";

const PHOTO = 1e6, REEL = 50e6;
const TONE: Record<string, string> = { idle: "bg-muted text-muted-foreground", ok: "bg-green-100 text-green-800", wait: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-800" };
const Pill = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[tone])}>{children}</span>;
const Warn = ({ children }: { children: React.ReactNode }) => <p className="pt-warn rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{children}</p>;

function DriveIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8.2 3h7.6l6 10.4-3.8 6.6H6l-3.8-6.6zM9.4 5l-4.9 8.4L6.8 17l4.9-8.4zm5.2 0h-2.4l6.1 10.6h2.3zM8 18h9.8l1.2-2H9.2z" /></svg>;
}

export function useMoney() {
  const { lang } = useLang();
  const num = (n: number) => numL(n, lang);
  const fmtGb = (bytes: number) => { const gb = bytes / 1e9; return `${gb < 10 ? gb.toFixed(gb < 1 ? 2 : 1) : Math.round(gb)} ${lang === "en" ? "GB" : lang === "fr" ? "Go" : "غ.ب"}`; };
  const dzd = (n: number) => `${Math.round(Number(n || 0)).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")} ${lang === "ar" ? "دج" : lang === "fr" ? "DA" : "DZD"}`;
  return { num, fmtGb, dzd };
}

export function Storage({ flashKey }: { flashKey?: string }) {
  const t = useT(T, TS);
  const { num, fmtGb, dzd } = useMoney();
  const [s, setS] = React.useState<any>(null);
  const [err, setErr] = React.useState("");
  const [msg, setMsg] = React.useState(flashKey ? "" : "");
  const [plan, setPlan] = React.useState<null | "new" | "upgrade" | "renew">(null);
  const [moving, setMoving] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const errMsg = (e: any) => { const v = t("e_" + (e instanceof ApiError ? e.code : "error")); return typeof v === "string" && !v.startsWith("e_") ? v : t("e_error"); };

  const load = React.useCallback(async (m?: string) => {
    try { setS(await portal("storage")); setErr(""); if (m !== undefined) setMsg(m); } catch (e) { setErr(errMsg(e)); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { load(flashKey ? t(flashKey) : undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <p className="py-10 text-center text-muted-foreground">{err}</p>;
  if (!s) return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>;

  const d = s.drive, c = s.cloud, e = s.estimate, q = d.quota, pl = s.plan;
  const accountRoom = q?.limit ? Math.max(0, Math.min(d.cap, q.limit) - q.usage) : null;
  const room = Math.max(0, Math.min(d.cap - d.bytes, accountRoom ?? Infinity));
  const full = d.connected && room < PHOTO;
  const usable = Math.min(d.cap, q?.limit || d.cap), almost = d.connected && usable > 0 && (usable - room) / usable >= 0.9;
  const act = async (fn: () => Promise<any>, after?: string) => {
    setBusy(true);
    try { await fn(); await load(after ?? ""); } catch (er: any) { setMsg(er?.code === "cloud_not_empty" ? t("cloudNotEmpty") : errMsg(er)); }
    setBusy(false);
  };
  const why = (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/60 p-3 text-sm">
      <b>{t("whyTitle")}</b>
      <ul className="flex list-disc flex-col gap-1 ps-5 text-muted-foreground">{(t("why") as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
  const move = async () => {
    setBusy(true); let moved = 0, failed = 0;
    try {
      for (;;) {
        const r = await portal("move-to-cloud", {});
        moved += r.moved; failed = r.failed;
        setMoving(t("moving", num(moved), num(r.remaining)));
        if (!r.remaining || !r.moved) break;
      }
      setMoving(""); await load(failed ? t("moveSome", num(moved), num(failed)) : t("moveDone", num(moved)));
    } catch (er) { setMoving(""); setMsg(errMsg(er)); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-5" id="ptStorage">
      {msg ? <Alert className="pt-msg"><AlertDescription>{msg}</AlertDescription></Alert> : null}
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl font-bold">{t("stTitle")}</h2>
        <p className="text-muted-foreground">{t("stLead")}</p>
      </div>
      <div className="pt-st-grid grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#1A73E8] text-white"><DriveIcon /></span>
              <div className="flex min-w-0 flex-1 flex-col"><b>{t("driveTitle")}</b><span className="truncate text-sm text-muted-foreground">{d.connected ? t("connectedAs", d.email) : t("notConnected")}</span></div>
              <Pill tone="ok">{t("free")}</Pill>
            </div>
            {d.connected ? (
              <>
                <div className="flex flex-col gap-1.5"><span className="text-sm">{t("driveUse", fmtGb(d.bytes), fmtGb(d.cap))}</span>
                  <Progress value={Math.min(100, (d.bytes / d.cap) * 100)} className="h-2" /></div>
                {accountRoom !== null ? <p className="text-sm text-muted-foreground">{t("accountLeft", fmtGb(accountRoom))}</p> : null}
                {full ? <Warn>{t("driveFull")}</Warn> : <p className="text-sm">{t("fits", num(room / PHOTO), num(room / REEL))}</p>}
                {!full && almost ? <Warn>{["active", "expiring", "grace"].includes(pl.state) ? t("driveAlmostCloud", num(e.price_dzd)) : t("driveAlmostOff")}</Warn> : null}
              </>
            ) : (
              <>
                <ol className="flex list-decimal flex-col gap-1.5 ps-5">{(t("stepsDrive") as string[]).map((x, i) => <li key={i}>{x}</li>)}</ol>
                <p className="text-sm">{t("fits", num(d.cap / PHOTO), num(d.cap / REEL))}</p>
              </>
            )}
            <p className="text-sm text-muted-foreground">{t("driveCapNote")}</p>
            <Alert><AlertDescription>{t("driveCatch")}</AlertDescription></Alert>
            <div>
              {d.connected ? (
                <Confirm title={t("confirmDisconnect")} action={t("disconnect")} onConfirm={() => act(() => portal("drive-disconnect", {}))}>
                  <Button variant="outline" disabled={busy}>{t("disconnect")}</Button>
                </Confirm>
              ) : <Button asChild size="lg"><a href="/api/portal?action=drive-connect">{t("connectDrive")}</a></Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-indigo text-white"><Cloud className="size-5" /></span>
              <div className="flex flex-1 flex-col"><b className="flex flex-wrap items-center gap-2">{t("cloudTitle")} <Badge variant="secondary" className="bg-lime text-ink">{t("recommended")}</Badge></b>
                <span className="text-sm text-muted-foreground">{t("planSub")}</span></div>
              <Pill tone={({ none: "idle", active: "ok", expiring: "wait", grace: "wait", paused: "bad" } as any)[pl.state]}>{t("ps_" + pl.state)}</Pill>
            </div>
            <p className="font-bold">{t("perGb", num(pl.unit))}</p>
            {pl.state === "none" ? (
              <><p className="text-sm text-muted-foreground">{t("planExplain")}</p>{why}</>
            ) : (
              <>
                <div className="pt-plan flex flex-col gap-1.5 rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2"><b>{t("planLine", pl.gb)}</b><span className="text-sm text-muted-foreground">{t("until", pl.until)}</span></div>
                  <Progress value={Math.min(100, (pl.usedGb / pl.gb) * 100)} className={cn("h-2", pl.almost && "[&>*]:bg-amber-500")} />
                  <small className="text-muted-foreground">{t("usedOf", fmtGb(c.bytes), pl.gb)}{["active", "expiring"].includes(pl.state) ? " · " + t("daysLeft", num(pl.daysLeft)) : ""}</small>
                  {pl.next ? <small className="text-muted-foreground">{t("nextSize", pl.next.gb, pl.next.from)}</small> : null}
                </div>
                {pl.state !== "active" ? <Warn>{t("pw_" + pl.state, num(pl.daysLeft), num(pl.graceLeft || 0))}</Warn> : pl.full ? <Warn>{t("pw_full")}</Warn> : pl.almost ? <Warn>{t("pw_almost")}</Warn> : null}
              </>
            )}
            {pl.pending ? <Alert><AlertDescription>{t("planPending")}</AlertDescription></Alert> : null}
            <div className="flex flex-wrap gap-2">
              {!c.available && pl.state === "none" ? <p className="text-sm text-muted-foreground">{t("cloudSoon")}</p>
                : pl.state === "none" ? <Button size="lg" className="bg-lime text-ink hover:bg-lime/85" data-plan="new" onClick={() => setPlan("new")}>{t("choosePlan")}</Button>
                : (
                  <>
                    {["active", "expiring"].includes(pl.state) && pl.gb < pl.options.max_gb ? <Button size="lg" className="bg-lime text-ink hover:bg-lime/85" data-plan="upgrade" onClick={() => setPlan("upgrade")}>{t("upgrade")}</Button> : null}
                    <Button size="lg" variant={pl.state === "active" ? "outline" : "default"} className={pl.state === "active" ? "" : "bg-lime text-ink hover:bg-lime/85"} data-plan="renew" onClick={() => setPlan("renew")}>{t("renew")}</Button>
                  </>
                )}
            </div>
            {pl.state !== "none" ? (
              <fieldset className="pt-pref flex flex-col gap-2">
                <legend className="mb-2 font-bold">{t("prefTitle")}</legend>
                <RadioGroup value={c.pref} disabled={busy}
                  onValueChange={(v) => act(async () => { await portal("storage-pref", { pref: v }); }, t(v === "cloud" ? "prefSavedCloud" : "prefSavedAuto"))}>
                  {["cloud", "auto"].map((v) => (
                    <label key={v} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", c.pref === v && "border-indigo bg-indigo/5")}>
                      <RadioGroupItem value={v} data-pref={v} className="mt-1" />
                      <span className="flex flex-col gap-1">
                        <b className="flex items-center gap-2">{t(v === "auto" ? "prefAuto" : "prefCloud")}{v === "cloud" ? <Badge className="bg-lime text-ink">{t("recommended")}</Badge> : null}</b>
                        <small className="text-muted-foreground">{t(v === "auto" ? "prefAutoNote" : "prefCloudNote")}</small>
                        {v === "cloud" ? why : null}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
            ) : null}
            {pl.state !== "none" && d.connected && s.driveFiles ? (
              <div className="flex flex-col gap-2 rounded-xl border p-3">
                <b>{t("moveTitle")}</b>
                <p className="text-sm text-muted-foreground">{t("moveLead", num(s.driveFiles))}</p>
                <Confirm title={t("moveConfirm")} body={t("moveLead", num(s.driveFiles))} action={t("moveBtn")} destructive={false} onConfirm={move}>
                  <Button variant="outline" className="self-start" disabled={busy} id="ptMove">{t("moveBtn")}</Button>
                </Confirm>
                {moving ? <p className="text-sm" aria-live="polite">{moving}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {pl.payments.length ? (
        <Card><CardContent className="flex flex-col gap-3">
          <h3 className="font-heading text-lg font-bold">{t("planPayments")}</h3>
          <ul className="flex flex-col divide-y">{pl.payments.map((p: any, i: number) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <b>{dzd(p.amount_dzd)}</b>
              <span className="text-sm text-muted-foreground">{p.gb ? `${t("planShort", p.gb, p.months)} · ` : ""}{t("m_" + p.method)} · <span dir="ltr">{String(p.created_at).slice(0, 10)}</span></span>
              <span className="ms-auto"><Pill tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "wait"}>{t("p_" + p.status)}</Pill></span>
              {p.status === "rejected" && p.reason ? <small className="w-full text-red-700">{t("reasonLabel")}: {p.reason}</small> : null}
            </li>
          ))}</ul>
        </CardContent></Card>
      ) : null}

      {s.invoices.length ? (
        <Card><CardContent className="flex flex-col gap-3">
          <h3 className="font-heading text-lg font-bold">{t("pastInvoices")}</h3>
          <div className="pt-table overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead className="text-start">{t("invMonth")}</TableHead><TableHead className="text-start">{t("invGb")}</TableHead><TableHead className="text-start">{t("invAmount")}</TableHead><TableHead className="text-start">{t("invStatus")}</TableHead></TableRow></TableHeader>
            <TableBody>{s.invoices.map((i: any) => (
              <TableRow key={i.month}><TableCell dir="ltr" className="text-start">{i.month}</TableCell><TableCell>{fmtGb(Number(i.avg_gb) * 1e9)}</TableCell><TableCell><b>{dzd(i.amount_dzd)}</b></TableCell>
                <TableCell><Pill tone={i.status === "paid" ? "ok" : i.status === "void" ? "idle" : "wait"}>{t(i.status)}</Pill></TableCell></TableRow>
            ))}</TableBody>
          </Table></div>
        </CardContent></Card>
      ) : null}

      {plan ? <PlanDialog s={s} mode={plan} onClose={() => setPlan(null)} onSent={(m) => { setPlan(null); load(m); }} /> : null}
    </div>
  );
}
