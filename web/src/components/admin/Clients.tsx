"use client";
// «العملاء»: companies Nawa manages. Create a client with its first contact (who signs in at /portal),
// follow each platform's activation, storage and invoices, people, and open the client's content.
import * as React from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Confirm } from "@/components/Confirm";
import { PfIcon } from "@/components/portal/Platforms";
import { PORTAL_PLATFORMS as PLATFORMS, PLATFORM_ORDER, PORTAL_STATUS as STATUS } from "@/lib/shared";
// @ts-ignore shared
import { MANUAL_STATUS } from "@site/portal-schema.js";
import { admin, dzd, gb, fmtDate, METHODS, Pill, SectionHead } from "./lib";
import { cn } from "@/lib/utils";

const ERR: Record<string, string> = {
  name_required: "اكتب اسم الشركة.", bad_email: "تحقّق من البريد الإلكتروني.", email_taken: "هذا البريد مسجّل لدى عميل آخر.",
  client_not_found: "هذا العميل غير موجود.", bad_page: "معرّف الصفحة غير صحيح.", storage_not_configured: "قاعدة البيانات غير مربوطة (Supabase).",
};
const errText = (e: any) => ERR[e?.code] || "حدث خطأ. حاول مرة أخرى.";
const INV: Record<string, string> = { paid: "مدفوعة", unpaid: "غير مدفوعة", void: "ملغاة" };
const label = (st: string) => STATUS[st]?.label?.ar || st;
const tone = (st: string) => STATUS[st]?.tone || "idle";

function Field({ label: l, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cn("flex flex-col gap-1.5 text-sm", className)}><span className="font-medium">{l}</span>{children}</label>;
}

export function Clients({ onClients, onContent }: { onClients: (c: any[]) => void; onContent: (id: string) => void }) {
  const [d, setD] = React.useState<any>(null);
  const [err, setErr] = React.useState("");
  const [open, setOpen] = React.useState<null | "new" | string>(null);
  const [checking, setChecking] = React.useState(false);
  const absorb = React.useCallback((x: any) => { setD(x); onClients(x.clients || []); }, [onClients]);
  const load = React.useCallback(async (fresh = false) => {
    try { absorb(await admin(fresh ? "clients&fresh=1" : "clients")); setErr(""); } catch (e: any) { if (e.code !== "signed_out") setErr(errText(e)); }
  }, [absorb]);
  React.useEffect(() => { load(); }, [load]);

  const head = (
    <SectionHead title="العملاء" lead={<>يدخل العملاء من <a href="/portal" target="_blank" rel="noopener" dir="ltr" className="underline">/portal ↗</a> ويديرون محتواهم بنفس أدوات نواة.</>}>
      <Button variant="outline" id="clRefresh" disabled={checking} onClick={async () => { setChecking(true); await load(true); setChecking(false); }}><RefreshCw className={cn(checking && "animate-spin")} data-icon="inline-start" />تحقق من المنصات</Button>
      <Button id="clNew" className="bg-lime text-ink hover:bg-lime/85" onClick={() => setOpen("new")}><Plus data-icon="inline-start" />عميل جديد</Button>
    </SectionHead>
  );
  if (err) return <>{head}<p className="py-10 text-center text-muted-foreground">{err}</p></>;
  if (!d) return <>{head}<div id="clBody" className="grid gap-3 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div></>;

  const free = (d.pages || []).filter((p: any) => !p.used);
  const clients: any[] = d.clients || [];
  const current = open && open !== "new" ? clients.find((c) => c.id === open) : null;

  return (
    <div className="flex flex-col">
      {head}
      <div id="clBody" className="flex flex-col gap-4">
        {!d.mail ? <div className="cl-note rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>إرسال رموز الدخول غير مضبوط بعد.</b> أضف في Vercel ← Environment Variables: <code dir="ltr">SMTP_USER</code> (بريد Gmail لنواة) و<code dir="ltr">SMTP_PASS</code> (كلمة مرور تطبيق من Google، وليست كلمة المرور العادية)، ثم أعد النشر. الدخول عبر Google يعمل الآن.</div> : null}
        {!d.meta ? <div className="cl-note rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Meta غير مربوطة:</b> لا يمكن التحقق من فيسبوك وإنستغرام تلقائيًا.</div> : null}
        {free.length ? (
          <div className="cl-note ok rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900"><b>صفحات وصلنا الوصول إليها ولم تُربط بعميل:</b>{" "}
            {free.map((p: any, i: number) => <React.Fragment key={p.id}>{i ? " · " : ""}<bdi>{p.name}</bdi>{p.ig ? <span dir="ltr" className="text-muted-foreground"> @{p.ig.username}</span> : null}</React.Fragment>)}. افتح العميل واختر صفحته.</div>
        ) : null}
        {clients.length ? (
          <ul className="cl-list grid gap-3 md:grid-cols-2">
            {clients.map((c) => {
              const s = c.storage; const unpaid = s ? s.invoices.filter((i: any) => i.status === "unpaid") : [];
              const active = PLATFORM_ORDER.filter((k: string) => c.status?.[k]?.status === "active").length;
              return (
                <li key={c.id} className={cn("cl-card flex flex-col gap-3 rounded-2xl border bg-card p-4", !c.active && "off opacity-70")}>
                  <div className="flex flex-wrap items-center gap-2"><b className="text-lg">{c.name}</b>{c.active ? null : <Pill>موقوف</Pill>}<span className="text-sm text-muted-foreground">{[c.industry, c.city].filter(Boolean).join(" · ")}</span></div>
                  <div className="flex items-center gap-1.5">
                    {PLATFORM_ORDER.map((k: string) => (
                      <span key={k} title={`${PLATFORMS[k].name.ar} · ${label(c.status[k].status)}`}
                        className={cn("grid size-8 place-items-center rounded-lg", { ok: "bg-green-100 text-green-800", wait: "bg-amber-100 text-amber-800", review: "bg-indigo/10 text-indigo", bad: "bg-red-100 text-red-800", idle: "bg-muted text-muted-foreground" }[tone(c.status[k].status) as string])}><PfIcon k={k} size={16} /></span>
                    ))}
                    <span className="ms-1 text-sm text-muted-foreground">{active} من 4 مفعّلة</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{c.users.map((u: any) => u.name || u.email).join("، ") || "لا أحد"}</div>
                  {s ? (
                    <div className="cl-storage flex flex-wrap gap-1.5 text-xs">
                      <Pill>{s.drive.connected ? `Drive ${gb(s.drive.bytes)}` : "Drive غير مربوط"}</Pill>
                      <Pill>{s.cloud.enabled ? `سحابة ${gb(s.cloud.bytes)}${s.cloud.pref === "cloud" ? " · الملفات الجديدة هنا دائمًا" : ""}` : "سحابة متوقفة"}</Pill>
                      {s.plan && s.plan.state !== "none" ? <Pill tone="review">خطة {s.plan.gb} غ.ب · حتى {s.plan.until}{s.plan.state === "expiring" ? ` · ${s.plan.daysLeft} أيام` : s.plan.state === "grace" ? " · مهلة" : s.plan.state === "paused" ? " · متوقفة" : ""}</Pill> : <Pill>بلا خطة</Pill>}
                      {unpaid.length ? <Pill tone="wait">{unpaid.length} غير مدفوعة · {dzd(unpaid.reduce((a: number, i: any) => a + i.amount_dzd, 0))}</Pill> : null}
                    </div>
                  ) : null}
                  {c.ai ? (
                    <div className="cl-ai flex flex-wrap items-center gap-2 rounded-lg bg-[#D97757]/10 px-3 py-2 text-sm">
                      <Sparkles className="size-4 text-[#D97757]" />
                      <span>Claude مربوط{c.ai.last_used_at ? ` · آخر استعمال ${c.ai.last_used_at.slice(0, 10)}` : " · لم يُستعمل بعد"} · {c.ai.drafts_total} مسودة{c.ai.pending ? <> · <b>{c.ai.pending} بانتظار العميل</b></> : null}</span>
                      <Confirm title="إلغاء رابط Claude لهذا العميل؟" action="إلغاء الرابط" onConfirm={async () => { try { absorb(await admin("client-ai-revoke", { id: c.id })); toast.success("أُلغي رابط Claude لهذا العميل."); } catch { toast.error("تعذّر الإلغاء."); } }}>
                        <Button variant="link" size="sm" className="ms-auto h-auto px-0 text-destructive" data-ai-revoke={c.id}>إلغاء الرابط</Button>
                      </Confirm>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button data-manage={c.id} onClick={() => setOpen(c.id)}>إدارة</Button>
                    <Button variant="outline" data-content={c.id} onClick={() => onContent(c.id)}>المحتوى</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Card className="cl-empty"><CardContent className="flex flex-col gap-2"><b>لا يوجد عملاء بعد.</b>
            <p className="text-muted-foreground">أضف أول عميل: اسم الشركة وبريد الشخص الذي سيدخل. يدخل بعدها من <a href="/portal" target="_blank" rel="noopener" dir="ltr" className="underline">/portal ↗</a> برمز يصله على بريده أو بحساب Google.</p></CardContent></Card>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent dir="rtl" id="clDialog" className="flex max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
          {open === "new" ? <CreateClient onDone={(x) => { absorb(x); setOpen(x.created); toast.success("أُضيف العميل. يمكنه الدخول الآن من /portal."); }} />
            : current ? <ManageClient key={current.id} c={current} pages={d.pages} absorb={absorb} reload={() => load(true)} onGone={() => setOpen(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateClient({ onDone }: { onDone: (d: any) => void }) {
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) || "");
    setBusy(true);
    try { onDone(await admin("client-create", { client: { name: v("name"), industry: v("industry"), city: v("city"), phone: v("phone"), website: v("website") }, user: { name: v("u_name"), email: v("u_email"), phone: v("u_phone") } })); }
    catch (err) { toast.error(errText(err)); setBusy(false); }
  };
  return (
    <form id="clForm" onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader><DialogTitle className="font-heading text-xl">عميل جديد</DialogTitle></DialogHeader>
      <fieldset className="flex flex-col gap-3"><legend className="mb-2 font-bold">الشركة</legend>
        <Field label="اسم الشركة *"><Input name="name" required maxLength={200} autoComplete="organization" autoFocus /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="المجال"><Input name="industry" maxLength={200} placeholder="مطعم، متجر ملابس، عيادة…" /></Field><Field label="المدينة"><Input name="city" maxLength={200} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="الهاتف"><Input name="phone" maxLength={40} dir="ltr" inputMode="tel" /></Field><Field label="الموقع"><Input name="website" maxLength={200} dir="ltr" placeholder="https://" /></Field></div>
      </fieldset>
      <fieldset className="flex flex-col gap-3"><legend className="mb-2 font-bold">الشخص الذي يدخل</legend>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="الاسم"><Input name="u_name" maxLength={120} autoComplete="name" /></Field><Field label="البريد الإلكتروني *"><Input name="u_email" type="email" required dir="ltr" autoComplete="email" /></Field></div>
        <Field label="الهاتف"><Input name="u_phone" maxLength={40} dir="ltr" inputMode="tel" /></Field>
        <p className="text-sm text-muted-foreground">يدخل من <b dir="ltr">/portal</b> برمز يصل إلى هذا البريد، أو بحساب Google بنفس البريد.</p>
      </fieldset>
      <Button type="submit" size="lg" disabled={busy} className="self-start bg-lime text-ink hover:bg-lime/85">إضافة العميل</Button>
    </form>
  );
}

function ManageClient({ c, pages, absorb, reload, onGone }: { c: any; pages: any[] | null; absorb: (d: any) => void; reload: () => Promise<void>; onGone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [pf, setPf] = React.useState(() => Object.fromEntries(PLATFORM_ORDER.map((k: string) => [k, { status: c.status[k].status, url: c.status[k].url || "", note: c.status[k].note || "" }])));
  const [page, setPage] = React.useState(c.fb_page_id || "");
  const [info, setInfo] = React.useState({ name: c.name || "", industry: c.industry || "", city: c.city || "", phone: c.phone || "", website: c.website || "", notes: c.notes || "" });
  const [user, setUser] = React.useState({ name: "", email: "" });
  const [methods, setMethods] = React.useState<Record<string, string>>({});
  const run = async (action: string, body: any, msg: string) => {
    setBusy(true);
    try { const d = await admin(action, body); absorb(d); if (!d.clients.some((x: any) => x.id === c.id)) onGone(); toast.success(msg); }
    catch (e) { toast.error(errText(e)); }
    setBusy(false);
  };
  const pageOpts = pages ? pages.filter((p) => !p.used || p.id === c.fb_page_id) : [];
  const s = c.storage;

  return (
    <div id="clForm" className="flex flex-col gap-6">
      <DialogHeader><DialogTitle className="font-heading text-xl" id="clDlgTitle">{c.name}</DialogTitle></DialogHeader>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between"><h3 className="font-bold">المنصات</h3>
          <Button variant="link" size="sm" id="clCheck" disabled={busy} onClick={async () => { setBusy(true); await reload(); setBusy(false); toast.success("تم التحقق من فيسبوك وإنستغرام."); }}>تحقق الآن</Button></div>
        <ul className="flex flex-col gap-3">
          {PLATFORM_ORDER.map((k: string) => {
            const st = c.status[k]; const p = PLATFORMS[k];
            return (
              <li key={k} className="flex flex-col gap-3 rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PfIcon k={k} size={18} /><b>{p.name.ar}</b><Pill tone={tone(st.status)}>{label(st.status)}</Pill>
                  {st.name ? <a href={st.url} target="_blank" rel="noopener" className="text-sm text-muted-foreground hover:underline">{st.name} ↗</a> : null}
                  <span className="ms-auto text-xs text-muted-foreground">{st.connect ? "يربطه العميل من حسابه" : p.auto ? "تحقق تلقائي" : "تحديث يدوي"}</span>
                </div>
                {k === "facebook" ? (
                  <>
                    <Field label="صفحة العميل">
                      {pages ? (
                        <NativeSelect data-page value={page} onChange={(e) => setPage(e.target.value)} className="w-full">
                          <NativeSelectOption value="">— لم تُحدَّد —</NativeSelectOption>
                          {pageOpts.map((pg) => <NativeSelectOption key={pg.id} value={pg.id}>{pg.name}{pg.ig ? ` · @${pg.ig.username}` : ""}</NativeSelectOption>)}
                          {c.fb_page_id && !pageOpts.some((pg) => pg.id === c.fb_page_id) ? <NativeSelectOption value={c.fb_page_id}>{c.fb_page_id} (لا وصول بعد)</NativeSelectOption> : null}
                        </NativeSelect>
                      ) : <Input data-page dir="ltr" value={page} onChange={(e) => setPage(e.target.value)} placeholder="Page ID" />}
                    </Field>
                    <p className="text-xs text-muted-foreground">تظهر هنا الصفحات التي وصلنا الوصول إليها. بعد قبول طلب الشراكة: Business Settings ← System users ← أضف الصفحة لمستخدم النظام، ثم «تحقق الآن».</p>
                  </>
                ) : null}
                {k === "instagram" ? <p className="text-xs text-muted-foreground">يُقرأ من صفحة فيسبوك تلقائيًا.</p> : null}
                {k === "tiktok" && st.connect ? <p className="text-xs text-muted-foreground">{st.status === "active" ? "ربطه العميل بـ «تسجيل الدخول بتيك توك». الفيديوهات المجدولة تُنشر تلقائيًا." : "لم يربطه العميل بعد: يضغط «ربط تيك توك» في «المنصات»."}</p> : null}
                {k === "linkedin" && st.connect ? <p className="text-xs text-muted-foreground">{st.status === "active" ? "ربطه العميل بحسابه على لينكدإن واختار الصفحة. المنشورات المجدولة تُنشر عليها تلقائيًا." : st.status === "waiting_client" ? "ربطه العميل، وبقي أن يختار الصفحة في «المنصات»." : "لم يربطه العميل بعد: يضغط «ربط لينكدإن» في «المنصات»."}</p> : null}
                {!p.auto && !st.connect ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="الحالة"><NativeSelect data-status={k} value={pf[k].status} onChange={(e) => setPf({ ...pf, [k]: { ...pf[k], status: e.target.value } })} className="w-full">
                      {MANUAL_STATUS.map((x: string) => <NativeSelectOption key={x} value={x}>{label(x)}</NativeSelectOption>)}</NativeSelect></Field>
                    <Field label="رابط الحساب"><Input data-url={k} dir="ltr" value={pf[k].url} onChange={(e) => setPf({ ...pf, [k]: { ...pf[k], url: e.target.value } })} placeholder="https://" /></Field>
                  </div>
                ) : null}
                <Field label="ملاحظة يراها العميل"><Input data-note={k} maxLength={500} value={pf[k].note} onChange={(e) => setPf({ ...pf, [k]: { ...pf[k], note: e.target.value } })} /></Field>
              </li>
            );
          })}
        </ul>
        <Button id="clSavePf" disabled={busy} className="self-start" onClick={() => {
          const platforms: any = {};
          for (const k of PLATFORM_ORDER) {
            platforms[k] = { note: pf[k].note };
            if (!PLATFORMS[k].auto && !c.status[k].connect) { platforms[k].status = pf[k].status; platforms[k].url = pf[k].url; }
          }
          run("client-update", { id: c.id, platforms, fb_page_id: page }, "حُفظت المنصات.");
        }}>حفظ المنصات</Button>
      </section>

      {s ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-bold">التخزين والفواتير</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-xl border p-3 text-sm"><b>Google Drive (مجاني)</b><span className="text-muted-foreground">{s.drive.connected ? <>مربوط: <bdi dir="ltr">{s.drive.email}</bdi></> : "لم يربطه العميل بعد"}</span><span>{gb(s.drive.bytes)} من {gb(s.drive.cap)}</span></div>
            <div className="flex flex-col gap-1 rounded-xl border p-3 text-sm"><b>«تخزين نواة»</b><span className="text-muted-foreground">{s.cloud.enabled ? "مفعّل" : "متوقف"}{s.cloud.available ? "" : " · غير مضبوط بعد (R2)"}</span><span>{gb(s.cloud.bytes)} · {dzd(s.estimate.price_dzd)}/غ.ب</span>
              <Button variant="link" size="sm" className="h-auto self-start px-0" id="clCloud" disabled={busy} onClick={() => run("client-cloud", { id: c.id, enabled: !s.cloud.enabled }, s.cloud.enabled ? "أُوقف «تخزين نواة» لهذا العميل." : "فُعّل «تخزين نواة» لهذا العميل.")}>{s.cloud.enabled ? "إيقاف" : "تفعيل"}</Button></div>
            <div className="flex flex-col gap-1 rounded-xl border p-3 text-sm"><b>هذا الشهر</b><span>حتى الآن: {dzd(s.estimate.so_far_dzd)}</span><span>المتوقع: {dzd(s.estimate.projected_dzd)}</span></div>
          </div>
          {s.invoices.length ? (
            <ul className="cl-invs flex flex-col divide-y rounded-xl border">
              {s.invoices.map((i: any) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
                  <span dir="ltr">{i.month}</span><span>{gb(Number(i.avg_gb) * 1e9)}</span><b>{dzd(i.amount_dzd)}</b>
                  <Pill tone={i.status === "paid" ? "ok" : i.status === "void" ? "idle" : "wait"}>{INV[i.status]}{i.status === "paid" && i.method ? " · " + (METHODS[i.method] || i.method) : ""}</Pill>
                  <span className="ms-auto flex items-center gap-2">
                    {i.status === "paid" ? <Button variant="link" size="sm" data-inv={i.id} data-st="unpaid" disabled={busy} onClick={() => run("invoice-mark", { id: i.id, status: "unpaid" }, "أُعيدت إلى غير مدفوعة.")}>إلغاء الدفع</Button> : (
                      <>
                        <NativeSelect size="sm" data-method={i.id} aria-label="طريقة الدفع" value={methods[i.id] || "baridimob"} onChange={(e) => setMethods({ ...methods, [i.id]: e.target.value })}>
                          {Object.entries(METHODS).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v}</NativeSelectOption>)}</NativeSelect>
                        <Button variant="outline" size="sm" data-inv={i.id} data-st="paid" disabled={busy} onClick={() => run("invoice-mark", { id: i.id, status: "paid", method: methods[i.id] || "baridimob" }, "سُجّلت الفاتورة مدفوعة.")}>تم الدفع</Button>
                        {i.status === "unpaid" ? <Button variant="link" size="sm" className="text-destructive" data-inv={i.id} data-st="void" disabled={busy} onClick={() => run("invoice-mark", { id: i.id, status: "void" }, "أُلغيت الفاتورة.")}>إلغاء الفاتورة</Button> : null}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">لا فواتير بعد. تصدر تلقائيًا أول كل شهر عن الشهر السابق.</p>}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="font-bold">الأشخاص</h3>
        <ul className="flex flex-col divide-y rounded-xl border">
          {c.users.map((u: any) => (
            <li key={u.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="flex min-w-0 flex-1 flex-col"><span><b>{u.name || "—"}</b> <span dir="ltr" className="text-muted-foreground">{u.email}</span>{u.role === "owner" ? <> <Pill>المسؤول</Pill></> : null}</span>
                <span className="text-xs text-muted-foreground">{u.last_login_at ? "آخر دخول: " + fmtDate(u.last_login_at) : "لم يدخل بعد"}</span></span>
              <Confirm title={`إزالة ${u.email}؟`} body="يخرج من حسابه فورًا." action="إزالة" onConfirm={() => run("client-user-remove", { id: u.id, email: u.email }, "أُزيل الشخص وخرج من حسابه.")}>
                <Button variant="ghost" size="sm" className="text-destructive" data-rmuser={u.id} data-email={u.email}>إزالة</Button>
              </Confirm>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input id="clUName" placeholder="الاسم" maxLength={120} value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} className="min-w-36 flex-1" />
          <Input id="clUEmail" type="email" dir="ltr" placeholder="email@example.com" value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} className="min-w-48 flex-1" />
          <Button variant="outline" id="clAddUser" disabled={busy} onClick={() => run("client-user-add", { client_id: c.id, ...user }, "أُضيف الشخص. يمكنه الدخول الآن.")}>إضافة شخص</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-bold">بيانات الشركة</h3>
        <Field label="اسم الشركة"><Input name="name" maxLength={200} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="المجال"><Input name="industry" maxLength={200} value={info.industry} onChange={(e) => setInfo({ ...info, industry: e.target.value })} /></Field>
          <Field label="المدينة"><Input name="city" maxLength={200} value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="الهاتف"><Input name="phone" dir="ltr" maxLength={40} value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></Field>
          <Field label="الموقع"><Input name="website" dir="ltr" maxLength={200} value={info.website} onChange={(e) => setInfo({ ...info, website: e.target.value })} /></Field></div>
        <Field label="ملاحظات داخلية"><Textarea name="notes" rows={2} maxLength={2000} value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} /></Field>
        <Button id="clSaveInfo" disabled={busy} className="self-start" onClick={() => run("client-update", { id: c.id, ...info }, "حُفظت البيانات.")}>حفظ البيانات</Button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button variant="ghost" id="clToggle" disabled={busy} onClick={() => run("client-update", { id: c.id, active: !c.active }, c.active ? "أُوقف دخول العميل." : "أُعيد تفعيل الدخول.")}>{c.active ? "إيقاف الدخول مؤقتًا" : "إعادة تفعيل الدخول"}</Button>
        <Confirm title={`حذف ${c.name}؟`} body="المنشورات تبقى في Drive." action="حذف العميل" onConfirm={() => run("client-delete", { id: c.id }, "حُذف العميل.")}>
          <Button variant="ghost" className="text-destructive" id="clDelete">حذف العميل</Button>
        </Confirm>
      </div>
    </div>
  );
}
