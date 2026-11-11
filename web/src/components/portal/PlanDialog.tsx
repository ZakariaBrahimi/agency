"use client";
// The plan window («تخزين نواة»: GB × months). The price follows the same rules as the server
// (_lib/plans.js quote) so it updates while the slider moves; the server recomputes it on send.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Spinner } from "@/components/ui/spinner";
import { CopyButton } from "@/components/CopyButton";
import { portal, ApiError } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { T, TS } from "@/i18n/portal";
import { useMoney } from "./Storage";

function priceOf(pl: any, gb: number, months: number) {
  const active = ["active", "expiring"].includes(pl.state);
  const dur = pl.options.durations.find((d: any) => d.months === months);
  const discount = dur?.discount || 0;
  const upgrade = active && gb > pl.gb ? Math.round((gb - pl.gb) * pl.unit * pl.daysLeft / 30) : 0;
  const period = months ? Math.round(gb * pl.unit * months * (1 - discount / 100)) : 0;
  return { upgrade, period, total: upgrade + period, discount };
}

// receipts are shrunk in the browser (≤ 1600 px JPEG) so they stay small
async function shrinkImage(file: File) {
  const bmp = await createImageBitmap(file);
  for (const [max, q] of [[1600, 0.8], [1200, 0.7], [900, 0.6]]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL("image/jpeg", q);
    if (url.length < 1.3e6) return url;
  }
  throw new ApiError("bad_receipt");
}

export function PlanDialog({ s, mode, onClose, onSent }: { s: any; mode: "new" | "upgrade" | "renew"; onClose: () => void; onSent: (msg: string) => void }) {
  const t = useT(T, TS);
  const { lang } = useLang();
  const { num, dzd } = useMoney();
  const pl = s.plan, O = pl.options;
  const active = ["active", "expiring"].includes(pl.state);
  const minGb = Math.max(O.min_gb, Math.ceil(s.cloud.bytes / 1e9)); // never below what is stored
  const lo = mode === "upgrade" ? Math.min(O.max_gb, pl.gb + O.step_gb) : minGb;
  const [gb, setGb] = React.useState(() => Math.max(minGb, mode === "upgrade" ? lo : (pl.gb || Math.max(minGb, 10))));
  const [months, setMonths] = React.useState(mode === "upgrade" ? 0 : 1);
  const [method, setMethod] = React.useState(pl.methods.length === 1 ? pl.methods[0] : "");
  const [receipt, setReceipt] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const durs = O.durations.filter((d: any) => d.on);
  const opts = [...(active && gb > pl.gb ? [{ months: 0, discount: 0 }] : []), ...durs];
  React.useEffect(() => { if (!opts.some((o: any) => o.months === months)) setMonths(opts[0]?.months ?? 1); }); // "upgrade only" appears/disappears
  const pr = priceOf(pl, gb, months);
  const usedGb = Math.ceil(s.cloud.bytes / 1e9 * 10) / 10;
  const hi = O.max_gb;
  const pay = s.payment || {};
  const errMsg = (e: any) => { const v = t("e_" + (e instanceof ApiError ? e.code : "error")); return typeof v === "string" && !v.startsWith("e_") ? v : t("e_error"); };
  const row = (label: string, value: string) => value ? (
    <div key={label} className="flex items-center gap-2"><span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span><b dir="ltr" className="min-w-0 flex-1 truncate">{value}</b><CopyButton value={value} label={t("copy")} doneLabel={t("copied")} /></div>
  ) : null;
  const details = method === "baridimob" ? [row("RIP", pay.baridimob_rip)]
    : method === "ccp" ? [row(t("ccpName"), pay.ccp_name), row(t("ccpAccount"), pay.ccp_account), row(t("ccpKey"), pay.ccp_key)]
    : method === "redotpay" ? [row(t("uid"), pay.redotpay_uid), row(t("email2"), pay.redotpay_email)] : [];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) return setMsg(t("e_bad_method"));
    if (!receipt) return setMsg(t("e_proof_required"));
    setBusy(true);
    try { await portal("plan-request", { gb, months, method, receipt }); onSent(t("planSent", dzd(pr.total))); }
    catch (er) { setMsg(errMsg(er)); setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent id="ptPlan" dir={lang === "ar" ? "rtl" : "ltr"} className="pt-planbox max-h-[92dvh] overflow-y-auto sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader><DialogTitle id="ptPlanTitle" className="font-heading text-xl">{t("pt_" + mode)}</DialogTitle></DialogHeader>
        <form onSubmit={send} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Label>{t("howMuch")}</Label>
            <div className="flex items-baseline gap-2"><b dir="ltr" id="ptGbVal" className="font-heading text-4xl">{gb}</b><span className="text-muted-foreground">{t("gbWord")}</span></div>
            <div className="relative" dir="ltr">
              <Slider id="ptGb" dir="ltr" min={lo} max={hi} step={O.step_gb} value={[gb]} onValueChange={(v) => setGb(v[0])} aria-label={t("howMuch")} />
              {s.cloud.bytes > 0 && mode !== "upgrade" ? (
                <i title={t("usedNow")} className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-amber-500" style={{ left: `${Math.max(0, Math.min(100, ((usedGb - lo) / ((hi - lo) || 1)) * 100))}%` }} />
              ) : null}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground" dir="ltr"><span>{lo} GB</span><span>{hi} GB</span></div>
            <p className="text-sm" id="ptFits">{t("planFits", num(Math.floor(gb * 1000 / O.photo_mb)), num(Math.floor(gb * 1000 / O.video_mb)))}</p>
            <p className="text-sm text-muted-foreground" id="ptMonth">{t("perMonthTotal", dzd(gb * pl.unit))}</p>
          </div>

          <fieldset className="flex flex-col gap-2" id="ptDurations">
            <legend className="mb-2 text-sm font-medium">{t("duration")}</legend>
            <ToggleGroup type="single" variant="outline" value={String(months)} onValueChange={(v) => v && setMonths(Number(v))} className="flex flex-wrap justify-start gap-2">
              {opts.map((o: any) => (
                <ToggleGroupItem key={o.months} value={String(o.months)} data-months={o.months} className="pt-chip h-9 rounded-lg! border px-3 data-[state=on]:border-indigo data-[state=on]:bg-indigo/10">
                  {o.months === 0 ? t("upgradeOnly") : t("mo_" + o.months)}
                  {o.discount ? <>{" "}<span dir="ltr" className="rounded bg-lime px-1 text-xs text-ink">−{o.discount}%</span></> : null}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <div id="ptTotal" className="flex flex-col gap-1 rounded-xl bg-ink p-4 text-white" aria-live="polite">
            <div className="flex items-center justify-between"><span>{t("total")}</span><b className="font-heading text-2xl text-lime">{dzd(pr.total)}</b></div>
            {pr.upgrade ? <small className="text-white/70">{t("upgradePart", gb - pl.gb, num(pl.daysLeft), dzd(pr.upgrade))}</small> : null}
            {months ? <small className="text-white/70">{t("periodPart", gb, t("mo_" + months), dzd(pr.period))}{pr.discount ? ` · ${t("saved", dzd(gb * pl.unit * months - pr.period))}` : ""}</small> : null}
          </div>

          {pl.methods.length ? (
            <>
              <fieldset className="pt-methods flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t("payWith")}</legend>
                <ToggleGroup type="single" variant="outline" value={method} onValueChange={(v) => v && setMethod(v)} className="flex flex-wrap justify-start gap-2">
                  {pl.methods.map((m: string) => <ToggleGroupItem key={m} value={m} data-m={m} className="pt-chip h-9 rounded-lg! border px-3 data-[state=on]:border-indigo data-[state=on]:bg-indigo/10">{t("m_" + m)}</ToggleGroupItem>)}
                </ToggleGroup>
              </fieldset>
              <div id="ptPayDetails">{details.filter(Boolean).length ? <div className="flex flex-col gap-2 rounded-xl border p-3">{details}</div> : null}</div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ptReceipt">{t("receipt")}</Label>
                <Input id="ptReceipt" type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0]; setReceipt("");
                  if (!f) return;
                  try { setReceipt(await shrinkImage(f)); setMsg(""); } catch { setMsg(t("e_bad_receipt")); }
                }} />
                {receipt ? <img id="ptReceiptPrev" src={receipt} alt="" className="max-h-48 self-start rounded-lg border" /> : null}
                <p className="text-xs text-muted-foreground">{t("proofNote")}</p>
              </div>
              <Button type="submit" size="lg" disabled={busy} id="ptPlanSend">{busy ? <Spinner /> : null}{t("sendForCheck")}</Button>
              {msg ? <p role="alert" className="text-sm text-destructive">{msg}</p> : null}
            </>
          ) : <p className="text-muted-foreground">{t("noMethods")}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
