"use client";
// «المدفوعات»: «تخزين نواة» plans. Requests waiting to be checked (receipt; approve, or reject with a
// reason), every client's plan (with «منح خطة» for cash deals), the month's payments with a filter and
// CSV export, and the month's figures.
import * as React from "react";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { admin, dzd, day, METHODS, Pill, SectionHead, Stat } from "./lib";

const API = "/api/admin/content";
const STATE: Record<string, [string, string]> = { none: ["idle", "بلا خطة"], active: ["ok", "نشطة"], expiring: ["wait", "تنتهي قريبًا"], grace: ["wait", "مهلة"], paused: ["bad", "متوقفة"] };
const KIND: Record<string, string> = { new: "جديدة", renew: "تجديد", upgrade: "ترقية", topup: "شحن" };
const MONTHS: Record<number, string> = { 0: "ترقية فقط", 1: "شهر", 3: "3 أشهر", 6: "6 أشهر", 12: "سنة" };
const planText = (p: any) => (p.gb ? `${p.gb} غ.ب${p.months ? ` × ${MONTHS[p.months]}` : " · ترقية"}${Number(p.discount_pct) ? ` (⁦−${Number(p.discount_pct)}%⁩)` : ""}` : "—");
const receipt = (id: string) => `${API}?action=payment-receipt&id=${encodeURIComponent(id)}`;
const thisMonth = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 7);

export function Payments({ active }: { active: boolean }) {
  const [month, setMonth] = React.useState(thisMonth);
  const [d, setD] = React.useState<any>(null);
  const [err, setErr] = React.useState(false);
  const [method, setMethod] = React.useState("");
  const [reject, setReject] = React.useState<Record<string, string | undefined>>({});
  const [manual, setManual] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState("");
  const load = React.useCallback(async () => {
    try { setD(await admin("payments", undefined, `&month=${encodeURIComponent(month)}`)); setErr(false); } catch (e: any) { if (e.code !== "signed_out") setErr(true); }
  }, [month]);
  React.useEffect(() => { if (active) load(); }, [active, load]);

  const head = (
    <SectionHead title="المدفوعات" lead="خطط «تخزين نواة»: الطلبات التي تنتظر التحقق، وخطط العملاء، وسجل الدفعات.">
      <Input type="month" id="payMonth" aria-label="الشهر" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
      <Button variant="outline" id="payRefresh" onClick={load}><RefreshCw data-icon="inline-start" />تحديث</Button>
    </SectionHead>
  );
  if (err) return <>{head}<p className="py-10 text-center text-muted-foreground">تعذّر التحميل.</p></>;
  if (!d) return <>{head}<div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div></>;

  const t = d.totals;
  const list = d.payments.filter((p: any) => !method || p.method === method);
  const review = async (id: string, approve: boolean, reason?: string) => {
    setBusy(id);
    try { await admin("payment-review", { id, approve, reason }); toast.success(approve ? "فُعّلت الخطة، ووصلت رسالة للعميل." : "رُفضت الدفعة، ووصل السبب للعميل."); await load(); }
    catch (e: any) { toast.error(e.code === "already_reviewed" ? "رُوجعت هذه الدفعة من قبل." : approve ? "تعذّر القبول." : "تعذّر الرفض."); }
    setBusy("");
  };
  const csv = () => {
    const rows = [["date", "client", "gb", "months", "discount_pct", "kind", "amount_dzd", "method", "status", "source", "note", "reason"],
      ...list.map((p: any) => [day(p.reviewed_at || p.created_at), p.client, p.gb ?? "", p.months ?? "", p.discount_pct ?? 0, p.kind, p.amount_dzd, METHODS[p.method] || p.method, p.status, p.source, p.reference, p.reason])];
    const text = "﻿" + rows.map((r) => r.map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); a.download = `nawa-payments-${d.month}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  return (
    <div className="flex flex-col gap-5" id="payBody">
      {head}
      <div className="pay-stats grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat n={dzd(t.received)} label={`استُلم هذا الشهر · ${t.count} دفعة`} /><Stat n={t.active} label="خطط نشطة" />
        <Stat n={dzd(t.mrr)} label="الدخل الشهري المتكرر" hl /><Stat n={`${t.usedGb} / ${t.soldGb}`} label="غ.ب مستخدمة / مباعة" />
        <Stat n={dzd(t.cost)} label="تكلفة التخزين شهريًا (تقديرية)" /><Stat n={dzd(t.margin)} label="هامشك الشهري" />
      </div>

      <Card><CardContent className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">للتحقق {d.pending.length ? <Pill tone="wait">{d.pending.length}</Pill> : null}</h2>
        {d.pending.length ? (
          <ul className="pay-pending flex flex-col gap-3">
            {d.pending.map((p: any) => (
              <li key={p.id} data-id={p.id} className="flex flex-wrap items-start gap-3 rounded-xl border p-3">
                {p.has_receipt ? <a href={receipt(p.id)} target="_blank" rel="noopener" title="افتح الوصل" className="shrink-0"><img src={receipt(p.id)} alt={`وصل ${p.client}`} loading="lazy" className="size-24 rounded-lg border object-cover" /></a>
                  : <span className="grid size-24 shrink-0 place-items-center rounded-lg border bg-muted text-xs text-muted-foreground">بلا صورة</span>}
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <b className="text-base">{p.client} · {dzd(p.amount_dzd)}</b>
                  <span>{planText(p)} <Pill>{KIND[p.kind] || ""}</Pill></span>
                  <span className="text-muted-foreground">{METHODS[p.method] || p.method} · <span dir="ltr">{day(p.created_at)}</span>{p.upgrade_dzd ? ` · منها ${dzd(p.upgrade_dzd)} للأيام المتبقية` : ""}</span>
                  {p.reference ? <span>المرجع: <code dir="ltr">{p.reference}</code></span> : null}
                </div>
                <div className="flex gap-2">
                  <Button data-approve={p.id} disabled={busy === p.id} onClick={() => review(p.id, true)}>قبول</Button>
                  <Button variant="outline" data-reject={p.id} onClick={() => setReject({ ...reject, [p.id]: reject[p.id] === undefined ? "" : undefined })}>رفض</Button>
                </div>
                {reject[p.id] !== undefined ? (
                  <form data-reason={p.id} className="flex w-full flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); review(p.id, false, reject[p.id]); }}>
                    <Input name="reason" autoFocus maxLength={200} value={reject[p.id]} onChange={(e) => setReject({ ...reject, [p.id]: e.target.value })} placeholder="سبب الرفض (يصل للعميل)، مثل: المبلغ لم يصل بعد" className="min-w-60 flex-1" />
                    <Button type="submit" disabled={busy === p.id}>تأكيد الرفض</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">لا وصولات تنتظر التحقق.</p>}
      </CardContent></Card>

      <Card><CardContent className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">الخطط</h2>
        {d.plans.length ? (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>{["العميل", "الخطة", "المستخدم", "حتى", "الحالة", ""].map((h, i) => <TableHead key={i} className="text-start">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {d.plans.map((b: any) => (
                <React.Fragment key={b.id}>
                  <TableRow>
                    <TableCell><b>{b.name}</b></TableCell>
                    <TableCell>{b.gb ? `${b.gb} غ.ب` : "—"}{b.next ? <span className="text-muted-foreground"> → {b.next.gb} من {b.next.from}</span> : null}</TableCell>
                    <TableCell dir="ltr" className="text-start">{Math.round(b.usedGb * 100) / 100} GB{b.gb ? ` · ${Math.round((b.usedGb / b.gb) * 100)}%` : ""}</TableCell>
                    <TableCell><span dir="ltr">{b.until || "—"}</span>{["active", "expiring"].includes(b.state) ? <span className="text-muted-foreground"> ({b.daysLeft} يومًا)</span> : b.state === "grace" ? <span className="text-muted-foreground"> (مهلة {b.graceLeft})</span> : null}</TableCell>
                    <TableCell><Pill tone={STATE[b.state]?.[0]}>{STATE[b.state]?.[1] || b.state}</Pill></TableCell>
                    <TableCell><Button variant="link" size="sm" data-manual={b.id} onClick={() => setManual(manual === b.id ? null : b.id)}>منح خطة</Button></TableCell>
                  </TableRow>
                  {manual === b.id ? <TableRow><TableCell colSpan={6}><ManualPlan b={b} d={d} onDone={() => { setManual(null); load(); }} /></TableCell></TableRow> : null}
                </React.Fragment>
              ))}
            </TableBody>
          </Table></div>
        ) : <p className="text-sm text-muted-foreground">لا عملاء بعد.</p>}
      </CardContent></Card>

      <Card><CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-bold">سجل الدفعات · <span dir="ltr">{d.month}</span></h2>
          <div className="flex items-center gap-2">
            <NativeSelect id="payMethod" aria-label="الطريقة" value={method} onChange={(e) => setMethod(e.target.value)}>
              <NativeSelectOption value="">كل الطرق</NativeSelectOption>{Object.entries(METHODS).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v}</NativeSelectOption>)}</NativeSelect>
            <Button variant="outline" id="payCsv" disabled={!list.length} onClick={csv}><Download data-icon="inline-start" />تصدير Excel (CSV)</Button>
          </div>
        </div>
        {list.length ? (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>{["التاريخ", "العميل", "الخطة", "المبلغ", "الطريقة", "الوصل", "الحالة"].map((h) => <TableHead key={h} className="text-start">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {list.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell dir="ltr" className="text-start">{day(p.reviewed_at || p.created_at)}</TableCell>
                  <TableCell>{p.client}</TableCell>
                  <TableCell>{planText(p)}{p.kind && p.kind !== "topup" ? <span className="text-muted-foreground"> · {KIND[p.kind]}</span> : null}</TableCell>
                  <TableCell><b>{dzd(p.amount_dzd)}</b></TableCell>
                  <TableCell>{METHODS[p.method] || p.method}{p.source === "admin" ? <span className="text-muted-foreground"> (يدوي)</span> : null}</TableCell>
                  <TableCell>{p.has_receipt ? <a href={receipt(p.id)} target="_blank" rel="noopener" className="text-indigo underline">عرض</a> : p.reference ? <span dir="ltr">{p.reference}</span> : "—"}</TableCell>
                  <TableCell><Pill tone={p.status === "approved" ? "ok" : "bad"}>{p.status === "approved" ? "مقبولة" : "مرفوضة"}</Pill>{p.reason ? <small className="block text-muted-foreground">{p.reason}</small> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        ) : <p className="text-sm text-muted-foreground">لا دفعات في هذا الشهر.</p>}
      </CardContent></Card>
    </div>
  );
}

const L = ({ l, children }: { l: string; children: React.ReactNode }) => <label className="flex flex-col gap-1 text-sm"><span>{l}</span>{children}</label>;

/** «منح خطة»: the price the client would pay (same rules as the portal), editable for cash deals. */
function ManualPlan({ b, d, onDone }: { b: any; d: any; onDone: () => void }) {
  const active = ["active", "expiring"].includes(b.state);
  const durs = d.options.durations.filter((x: any) => x.on);
  const [f, setF] = React.useState({ gb: String(b.gb || 10), months: "1", amount: "", method: "cash", note: "" });
  const [busy, setBusy] = React.useState(false);
  const gbN = Number(f.gb), months = Number(f.months);
  const disc = d.options.durations.find((x: any) => x.months === months)?.discount || 0;
  const total = (active && gbN > b.gb ? Math.round((gbN - b.gb) * d.unit * (b.daysLeft || 0) / 30) : 0) + (months ? Math.round(gbN * d.unit * months * (1 - disc / 100)) : 0);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await admin("payment-manual", { client_id: b.id, gb: gbN, months, amount: f.amount, method: f.method, note: f.note }); toast.success("فُعّلت الخطة."); onDone(); }
    catch (err: any) {
      toast.error(({ bad_amount: "تحقّق من المبلغ.", bad_gb: "المساحة خارج المتاح.", below_usage: "المساحة أقل مما يخزّنه العميل.", bad_months: "اختر مدة متاحة (الترقية فقط لمساحة أكبر خلال خطة نشطة)." } as any)[err.code] || "تعذّر التفعيل.");
      setBusy(false);
    }
  };
  return (
    <form className="pay-manual grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6" data-client={b.id} onSubmit={submit}>
      <L l="المساحة (غ.ب)"><Input name="gb" type="number" min={d.options.min_gb} max={d.options.max_gb} step={d.options.step_gb} required dir="ltr" value={f.gb} onChange={set("gb")} /></L>
      <L l="المدة"><NativeSelect name="months" value={f.months} onChange={set("months")} className="w-full">
        {active ? <NativeSelectOption value="0">ترقية فقط</NativeSelectOption> : null}
        {durs.map((x: any) => <NativeSelectOption key={x.months} value={x.months}>{MONTHS[x.months]}{x.discount ? ` (⁦−${x.discount}%⁩)` : ""}</NativeSelectOption>)}</NativeSelect></L>
      <L l="المبلغ المستلم (دج)"><Input name="amount" type="number" min={0} step={1} dir="ltr" placeholder={String(total)} value={f.amount} onChange={set("amount")} /></L>
      <L l="الطريقة"><NativeSelect name="method" value={f.method} onChange={set("method")} className="w-full">{Object.entries(METHODS).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v}</NativeSelectOption>)}</NativeSelect></L>
      <L l="ملاحظة"><Input name="note" maxLength={80} placeholder="اختياري" value={f.note} onChange={set("note")} /></L>
      <Button type="submit" disabled={busy}>فعّل الخطة</Button>
      <small className="text-muted-foreground sm:col-span-3 lg:col-span-6" data-calc>السعر حسب الخطة: {dzd(total)}. اترك المبلغ فارغًا لاستعماله، أو اكتب ما استلمته فعلًا.</small>
    </form>
  );
}
