"use client";
// «الطلبات»: briefs sent from /start. A list with a status filter, the chosen request's answers,
// its status and internal note; Telegram notifications setup underneath.
import * as React from "react";
import { toast } from "sonner";
import { RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Pill, SectionHead, Stat, fmtDate } from "./lib";
// @ts-ignore shared with the /start form and the API
import { PROJECT, CONTACT, CURRENCY_NAME, DEFAULT_CURRENCY, t as tr, serviceById, formatAnswer } from "@site/brief-schema.js";

const STATUS: Record<string, [string, string]> = { new: ["جديد", "new"], contacted: ["تم التواصل", "review"], in_progress: ["قيد العمل", "wait"], won: ["تم الاتفاق", "ok"], closed: ["مغلق", "idle"] };
const LANG_NAME: Record<string, string> = { ar: "العربية", en: "English", fr: "Français" };
const SECTION_HASH = /^#(content|madar|clients|payments|settings)/;
const ago = (s: string) => {
  const m = Math.round((Date.now() - +new Date(s)) / 60000);
  if (m < 1) return "الآن"; if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

export function Requests({ active }: { active: boolean }) {
  const [briefs, setBriefs] = React.useState<any[] | null>(null);
  const [setup, setSetup] = React.useState(false);
  const [updated, setUpdated] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<string | null>(() => (typeof location !== "undefined" && !SECTION_HASH.test(location.hash) && location.hash.slice(1)) || null);
  const [note, setNote] = React.useState(""); const [noteMsg, setNoteMsg] = React.useState("");
  const detailRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    try {
      const d = await request("/api/admin/briefs"); setBriefs(d.briefs || []);
      setUpdated("آخر تحديث: " + new Date().toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) { if (e.code === "service_key_missing") setSetup(true); else if (e.code !== "signed_out") setBriefs([]); }
  }, []);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    const id = setInterval(() => { if (active && !document.hidden) load(); }, 60000);
    return () => clearInterval(id);
  }, [active, load]);
  const b = briefs?.find((x) => x.id === selected);
  React.useEffect(() => { setNote(b?.admin_note || ""); setNoteMsg(""); }, [b?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (id: string, body: any) => {
    try { const { brief } = await request("/api/admin/briefs", { method: "PATCH", body: { id, ...body } }); setBriefs((bs) => bs!.map((x) => (x.id === id ? brief : x))); return true; }
    catch { toast.error("تعذّر الحفظ. حاول مرة أخرى."); return false; }
  };
  const select = (id: string) => {
    setSelected(id); history.replaceState(null, "", "#" + id);
    if (matchMedia("(max-width: 900px)").matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  if (setup) {
    return (
      <Card id="setup"><CardContent className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-bold">خطوة أخيرة</h1>
        <p>تسجيل الدخول يعمل، لكن قراءة الطلبات تحتاج مفتاح الخدمة من Supabase. قسم «المحتوى» يعمل بدونه.</p>
        <ol className="flex list-decimal flex-col gap-1 ps-5">
          <li>افتح مشروع <b>nawa</b> في Supabase ← Project Settings ← API Keys، وانسخ مفتاح <b dir="ltr">service_role</b> (أو secret).</li>
          <li>في Vercel ← nawa-studio ← Settings ← Environment Variables أضف <code dir="ltr">SUPABASE_SERVICE_ROLE_KEY</code> بهذه القيمة.</li>
          <li>أعد النشر، ثم حدّث هذه الصفحة.</li>
        </ol>
      </CardContent></Card>
    );
  }
  if (!briefs) return <div className="grid gap-4"><Skeleton className="h-20" /><Skeleton className="h-96" /></div>;

  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, briefs.filter((x) => x.status === k).length]));
  const shown = briefs.filter((x) => filter === "all" || x.status === filter);
  const rows = (list: any[], values: any, currency: string) => list.map((q) => [q, formatAnswer(q, values?.[q.id], "ar", currency)]).filter(([, v]) => v)
    .map(([q, v]: any) => <div key={q.id} className="kv flex flex-wrap justify-between gap-2 border-b py-2 last:border-0"><span className="text-muted-foreground">{tr(q.label, "ar").replace(/[؟?]\s*$/, "")}</span><b>{v}</b></div>);

  let detail: React.ReactNode = <p className="py-16 text-center text-muted-foreground">اختر طلبًا لعرض تفاصيله.</p>;
  if (b) {
    const c = b.contact || {};
    const wa = (c.whatsapp || "").replace(/[^\d]/g, "");
    const services = (b.services || []).map((id: string) => serviceById(id)).filter(Boolean);
    const currency = b.business?.currency || DEFAULT_CURRENCY;
    detail = (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground" dir="ltr">#{b.id.slice(0, 8)}</span>
            <h2 className="font-heading text-2xl font-bold">{b.business?.business || "—"}</h2>
            <p className="text-sm text-muted-foreground">{fmtDate(b.created_at)} · لغة الطلب: {LANG_NAME[b.lang] || b.lang}</p>
          </div>
          <label className="flex flex-col gap-1 text-sm"><span>الحالة</span>
            <NativeSelect id="statusSel" value={b.status} onChange={(e) => patch(b.id, { status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v[0]}</NativeSelectOption>)}
            </NativeSelect></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 p-3">
          <div className="flex flex-col"><b>{c.name}</b><span dir="ltr" className="text-sm">{c.email}</span>{c.whatsapp ? <span dir="ltr" className="text-sm">{c.whatsapp}</span> : null}</div>
          <div className="flex gap-2">
            {wa ? <Button asChild className="bg-lime text-ink hover:bg-lime/85"><a target="_blank" rel="noopener" href={`https://wa.me/${wa}?text=${encodeURIComponent(`مرحبًا ${c.name || ""}، معك فريق نواة بخصوص طلبك (${b.business?.business || ""}).`)}`}>واتساب</a></Button> : null}
            <Button asChild variant="outline"><a href={`mailto:${c.email}?subject=${encodeURIComponent("نواة · طلبك " + (b.business?.business || ""))}`}>بريد</a></Button>
          </div>
        </div>
        <p className="text-sm">يفضّل التواصل عبر: <b>{formatAnswer(CONTACT.find((q: any) => q.id === "prefer"), c.prefer, "ar")}</b></p>
        <div className="flex flex-wrap gap-2">{services.map((s: any) => <span key={s.id} className="rounded-full bg-indigo/10 px-3 py-1 text-sm text-indigo">{tr(s.title, "ar")}</span>)}</div>
        {services.map((s: any) => (
          <section key={s.id} className="flex flex-col"><h3 className="mb-1 font-bold">{tr(s.title, "ar")}</h3>{rows(s.questions, b.answers?.[s.id], currency).length ? rows(s.questions, b.answers?.[s.id], currency) : <p className="text-sm text-muted-foreground">لا توجد إجابات.</p>}</section>
        ))}
        <section className="flex flex-col"><h3 className="mb-1 font-bold">المشروع</h3>{rows(PROJECT, b.business, currency)}
          <div className="kv flex justify-between gap-2 py-2"><span className="text-muted-foreground">العملة</span><b>{tr(CURRENCY_NAME[currency], "ar")}</b></div></section>
        {c.notes ? <section><h3 className="mb-1 font-bold">ملاحظات العميل</h3><p className="whitespace-pre-wrap">{c.notes}</p></section> : null}
        <section className="flex flex-col gap-2">
          <h3 className="font-bold">ملاحظاتك الداخلية</h3>
          <Textarea id="noteBox" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: اتصلت به يوم الأحد، يريد عرض سعر قبل نهاية الشهر" />
          <div className="flex items-center gap-3"><Button variant="outline" id="saveNote" onClick={async () => { if (await patch(b.id, { admin_note: note })) setNoteMsg("تم الحفظ."); }}>حفظ الملاحظة</Button><span id="noteMsg" role="status" className="text-sm text-muted-foreground">{noteMsg}</span></div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title="الطلبات" lead={<span id="updated">{updated}</span>}>
        <Button variant="outline" id="refresh" onClick={load}><RefreshCw data-icon="inline-start" />تحديث</Button>
      </SectionHead>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" id="stats">
        <Stat n={briefs.length} label="الكل" /><Stat n={counts.new} label="جديدة" hl />
        <Stat n={briefs.filter((x) => Date.now() - +new Date(x.created_at) < 7 * 864e5).length} label="هذا الأسبوع" /><Stat n={counts.won} label="تم الاتفاق" />
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" id="tabs">
        {[["all", "الكل", briefs.length], ...Object.entries(STATUS).map(([k, v]) => [k, v[0], counts[k]])].map(([k, l, n]: any) => (
          <button key={k} type="button" role="tab" data-f={k} aria-selected={filter === k} onClick={() => setFilter(k)}
            className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm", filter === k ? "border-ink bg-ink text-white" : "bg-card hover:bg-muted")}>
            {l}<span dir="ltr" className={cn("rounded-full px-1.5 text-xs", filter === k ? "bg-white/15" : "bg-muted")}>{n}</span></button>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="flex flex-col gap-2" id="list" aria-live="polite">
          {shown.length ? shown.map((x) => {
            const s = STATUS[x.status] || STATUS.new;
            const svc = (x.services || []).map((id: string) => tr(serviceById(id)?.title, "ar")).filter(Boolean).join(" · ");
            return (
              <button key={x.id} type="button" data-id={x.id} onClick={() => select(x.id)}
                className={cn("item flex flex-col gap-1 rounded-xl border bg-card p-3 text-start transition-colors hover:border-indigo/50", x.id === selected && "on border-indigo ring-2 ring-indigo/15", x.status === "new" && "unread")}>
                <span className="flex items-center justify-between gap-2"><b className={cn(x.status === "new" && "text-indigo")}>{x.business?.business || "—"}</b><Pill tone={s[1]}>{s[0]}</Pill></span>
                <span className="text-sm">{x.contact?.name || ""}</span>
                <span className="text-xs text-muted-foreground">{svc}</span>
                <span className="text-xs text-muted-foreground" title={fmtDate(x.created_at)}>{ago(x.created_at)}</span>
              </button>
            );
          }) : <p className="py-10 text-center text-muted-foreground">لا توجد طلبات {filter === "all" ? "بعد" : "بهذه الحالة"}.</p>}
        </div>
        <Card ref={detailRef} id="detail"><CardContent>{detail}</CardContent></Card>
      </div>
      <Telegram />
    </div>
  );
}

function Telegram() {
  const [d, setD] = React.useState<any>(null);
  const [err, setErr] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    request("/api/admin/telegram").then((x) => { setD(x); if (!x.token || !x.chatId) setOpen(true); }).catch((e) => { if (e.code !== "signed_out") setErr("تعذّر التحقق من إعدادات تيليغرام."); });
  }, []);
  const test = async (chatId?: string) => {
    try { await request("/api/admin/telegram", { method: "POST", body: { chatId } }); setMsg("أُرسلت الرسالة. تحقّق من تيليغرام."); }
    catch (e: any) { setMsg("تعذّر الإرسال: " + e.code); }
  };
  return (
    <Card id="tg"><Collapsible open={open} onOpenChange={setOpen}><CardContent className="flex flex-col gap-3">
      <CollapsibleTrigger className="flex items-center gap-2 text-start font-bold">إشعارات تيليغرام<ChevronDown className={cn("ms-auto size-4 transition-transform", open && "rotate-180")} /></CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 text-sm" id="tgBody">
        {err ? <p>{err}</p> : !d ? <p className="text-muted-foreground">جارٍ التحقق من إعدادات تيليغرام…</p> : !d.token ? (
          <>
            <p>لم يُضبط البوت بعد.</p>
            <ol className="flex list-decimal flex-col gap-1 ps-5">
              <li>افتح تيليغرام وراسل <b dir="ltr">@BotFather</b>، أرسل <code dir="ltr">/newbot</code> واختر اسمًا، وانسخ الـ token.</li>
              <li>في Vercel ← Settings ← Environment Variables أضف <code dir="ltr">TELEGRAM_BOT_TOKEN</code>، ثم أعد النشر.</li>
              <li>أرسل أي رسالة لبوتك، ثم عد إلى هنا لتحديد المحادثة.</li>
            </ol>
          </>
        ) : (
          <>
            <p>البوت: <b dir="ltr">@{d.bot}</b> · المحادثة المضبوطة: {d.chatId ? <><code dir="ltr">{d.chatId}</code> ✅</> : <b>لم تُضبط بعد</b>}</p>
            {d.chatId ? <Button variant="outline" className="self-start" onClick={() => test()}>إرسال رسالة تجريبية</Button>
              : <p>أرسل رسالة لبوتك على تيليغرام، ثم حدّث. انسخ رقم المحادثة وأضفه في Vercel باسم <code dir="ltr">TELEGRAM_CHAT_ID</code> ثم أعد النشر.</p>}
            {d.chats?.length ? (
              <><p className="text-muted-foreground">محادثات راسلت البوت مؤخرًا:</p>
                <ul className="flex flex-col gap-1">{d.chats.map((c: any) => <li key={c.id}><b>{c.name || c.type}</b> · <code dir="ltr">{c.id}</code> <Button variant="link" size="sm" onClick={() => test(String(c.id))}>إرسال رسالة تجريبية</Button></li>)}</ul></>
            ) : null}
            <p className="text-muted-foreground" role="status">{msg}</p>
          </>
        )}
      </CollapsibleContent>
    </CardContent></Collapsible></Card>
  );
}
