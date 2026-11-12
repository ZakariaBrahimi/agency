"use client";
// «الإعدادات»: the site's contact email and LinkedIn person, what clients pay for «تخزين نواة» (price per
// GB, plan sizes, durations and discounts), a storage check, and how clients pay. Clients only ever see
// the DZD price and the payment details; the dollar figures stay here.
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { request } from "@/lib/api";
import { SectionHead } from "./lib";
import { cn } from "@/lib/utils";

const API = "/api/admin/content?action=billing";
const PAY: [string, string][] = [["baridimob_rip", "بريدي موب: RIP"], ["ccp_name", "CCP: الاسم واللقب"], ["ccp_account", "CCP: رقم الحساب"], ["ccp_key", "CCP: المفتاح (Clé)"], ["redotpay_uid", "RedotPay: UID"], ["redotpay_email", "RedotPay: البريد"]];
const MO: Record<number, string> = { 1: "شهر", 3: "3 أشهر", 6: "6 أشهر", 12: "سنة" };
const price = (s: any) => Math.ceil((Number(s.cost_usd) + Number(s.fee_usd)) * Number(s.rate_dzd) - 1e-9);
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const save = (body: any) => request(API, { method: "POST", body });

const F = ({ l, children }: { l: string; children: React.ReactNode }) => <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">{l}</span>{children}</label>;
function Block({ id, title, lead, children, onSubmit }: { id: string; title: string; lead: React.ReactNode; children: React.ReactNode; onSubmit?: (e: React.FormEvent) => void }) {
  const inner = <CardContent className="flex flex-col gap-4"><h2 className="font-heading text-lg font-bold">{title}</h2><p className="text-sm text-muted-foreground">{lead}</p>{children}</CardContent>;
  return <Card>{onSubmit ? <form id={id} onSubmit={onSubmit}>{inner}</form> : <section id={id}>{inner}</section>}</Card>;
}

export function Settings() {
  const [s, setS] = React.useState<any>(null);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { request(API).then((d) => setS(d.settings)).catch((e) => { if (e.code !== "signed_out") setErr(true); }); }, []);
  const head = <SectionHead title="الإعدادات" lead="أسعار «تخزين نواة» ومعلومات الدفع التي يراها العملاء." />;
  if (err) return <>{head}<p className="py-10 text-center text-muted-foreground">تعذّر التحميل.</p></>;
  if (!s) return <>{head}<div className="grid gap-3"><Skeleton className="h-40" /><Skeleton className="h-60" /></div></>;
  return <>{head}<Forms key={JSON.stringify(s)} s={s} setS={setS} /></>;
}

function Forms({ s, setS }: { s: any; setS: (x: any) => void }) {
  const [contact, setContact] = React.useState({ email: s.contact?.email || "", linkedin_name: s.contact?.linkedin_name || "", linkedin_url: s.contact?.linkedin_url || "" });
  const [pr, setPr] = React.useState({ cost_usd: String(s.cost_usd), fee_usd: String(s.fee_usd), rate_dzd: String(s.rate_dzd) });
  const [plans, setPlans] = React.useState({
    min_gb: String(s.plans.min_gb), max_gb: String(s.plans.max_gb), step_gb: String(s.plans.step_gb), photo_mb: String(s.plans.photo_mb), video_mb: String(s.plans.video_mb),
    durations: s.plans.durations.map((d: any) => ({ months: d.months, on: d.on, discount: String(d.discount) })),
  });
  const [pay, setPay] = React.useState<Record<string, string>>(Object.fromEntries(PAY.map(([k]) => [k, s.payment?.[k] || ""])));
  const [check, setCheck] = React.useState<React.ReactNode>(null);
  const [checking, setChecking] = React.useState(false);
  const unit = price({ cost_usd: Number(pr.cost_usd), fee_usd: Number(pr.fee_usd), rate_dzd: Number(pr.rate_dzd) });
  const planInput = () => ({
    min_gb: Number(plans.min_gb), max_gb: Number(plans.max_gb), step_gb: Number(plans.step_gb), photo_mb: Number(plans.photo_mb), video_mb: Number(plans.video_mb),
    durations: [1, 3, 6, 12].map((m) => { const d = plans.durations.find((x: any) => x.months === m); return { months: m, on: m === 1 || Boolean(d?.on), discount: Number(d?.discount) || 0 }; }),
  });
  const go = async (body: any, ok: string, errs: Record<string, string> = {}) => {
    try { setS((await save(body)).settings); toast.success(ok); } catch (e: any) { toast.error(errs[e.code] || "تعذّر الحفظ."); }
  };
  const p = planInput();
  const line = (g: number, d: any) => <span key={d.months}>{g} غ.ب × {MO[d.months]} = <b>{n(g * unit * d.months * (1 - d.discount / 100))} دج</b>{d.discount ? <span className="text-muted-foreground"> (بدل {n(g * unit * d.months)} دج)</span> : null}</span>;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Block id="stContact" title="معلومات التواصل" lead="البريد الذي يظهر للزوار في الموقع (زر «راسلنا» ونسخ البريد)، وفي نموذج الطلب وسياسة الخصوصية."
        onSubmit={(e) => { e.preventDefault(); go({ contact }, "حُفظت معلومات التواصل.", { bad_email: "تحقّق من البريد.", bad_linkedin: "رابط الملف يجب أن يكون مثل https://www.linkedin.com/in/الاسم" }); }}>
        <F l="بريد التواصل"><Input name="email" type="email" dir="ltr" maxLength={120} required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></F>
        <p className="text-sm text-muted-foreground">الشخص الذي يضيفه العملاء مسؤولًا (Content admin) على صفحة شركتهم في LinkedIn. يظهر اسمه ورابط ملفه في خطوات تفعيل LinkedIn في بوابة العملاء. LinkedIn يقبل الأشخاص فقط، لا الصفحات.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <F l="الاسم كما يظهر على LinkedIn"><Input name="linkedin_name" maxLength={80} placeholder="مثال: Zakaria Brahimi" value={contact.linkedin_name} onChange={(e) => setContact({ ...contact, linkedin_name: e.target.value })} /></F>
          <F l="رابط ملفه الشخصي"><Input name="linkedin_url" type="url" dir="ltr" maxLength={200} placeholder="https://www.linkedin.com/in/…" value={contact.linkedin_url} onChange={(e) => setContact({ ...contact, linkedin_url: e.target.value })} /></F>
        </div>
        <p className="text-xs text-muted-foreground">قد يستغرق ظهور التغيير في الموقع حتى 5 دقائق.</p>
        <Button type="submit" className="self-start">حفظ</Button>
      </Block>

      <Block id="stPrice" title="التخزين والأسعار" lead="سعر «تخزين نواة» للعميل لكل غيغابايت في الشهر = (تكلفة التخزين + رسومك) × سعر الصرف، مقرّبًا إلى الدينار. يرى العميل السعر بالدينار فقط."
        onSubmit={(e) => { e.preventDefault(); go({ cost_usd: Number(pr.cost_usd), fee_usd: Number(pr.fee_usd), rate_dzd: Number(pr.rate_dzd) }, "حُفظت الأسعار.", { bad_number: "تحقّق من الأرقام." }); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <F l="تكلفة التخزين (دولار / غ.ب / شهر)"><Input name="cost_usd" type="number" step="0.001" min="0" dir="ltr" value={pr.cost_usd} onChange={(e) => setPr({ ...pr, cost_usd: e.target.value })} /></F>
          <F l="رسوم نواة (دولار / غ.ب / شهر)"><Input name="fee_usd" type="number" step="0.01" min="0" dir="ltr" value={pr.fee_usd} onChange={(e) => setPr({ ...pr, fee_usd: e.target.value })} /></F>
          <F l="سعر الصرف (دج لكل 1 دولار)"><Input name="rate_dzd" type="number" step="1" min="1" dir="ltr" value={pr.rate_dzd} onChange={(e) => setPr({ ...pr, rate_dzd: e.target.value })} /></F>
        </div>
        <div id="stPreview" aria-live="polite" className="flex flex-col gap-1 rounded-xl bg-ink p-4 text-sm text-white">
          {Number.isFinite(unit) && unit >= 0 ? <><b className="text-lime">سعر العميل: {n(unit)} دج لكل غيغابايت شهريًا</b><span className="text-white/75">عميل يخزّن 10 غيغابايت يدفع {n(unit * 10)} دج شهريًا · 50 غيغابايت: {n(unit * 50)} دج</span></> : <b>أدخل أرقامًا صحيحة.</b>}
        </div>
        <p className="text-xs text-muted-foreground">التغيير يُطبَّق على الحسابات من الآن، وكل فاتورة صادرة تحتفظ بالسعر الذي صدرت به.</p>
        <Button type="submit" className="self-start">حفظ الأسعار</Button>
      </Block>

      <Block id="stPlans" title="خطط «تخزين نواة»" lead="ما يختاره العميل في نافذة الخطة: المساحة بالمؤشر، والمدة، وتخفيض كل مدة. السعر الشهري للغيغابايت يأتي من «التخزين والأسعار»."
        onSubmit={(e) => { e.preventDefault(); go({ plans: planInput() }, "حُفظت الخطط."); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          {[["min_gb", "أقل مساحة (غ.ب)"], ["max_gb", "أكبر مساحة (غ.ب)"], ["step_gb", "خطوة المؤشر (غ.ب)"]].map(([k, l]) => (
            <F key={k} l={l}><Input name={k} type="number" min="1" step="1" dir="ltr" value={(plans as any)[k]} onChange={(e) => setPlans({ ...plans, [k]: e.target.value })} /></F>
          ))}
        </div>
        <div className="flex flex-col divide-y rounded-xl border">
          <div className="grid grid-cols-3 gap-2 p-2 text-xs text-muted-foreground"><span>المدة</span><span>متاحة</span><span>التخفيض %</span></div>
          {plans.durations.map((d: any, i: number) => (
            <div key={d.months} className="grid grid-cols-3 items-center gap-2 p-2">
              <b>{MO[d.months]}</b>
              <Switch data-on={d.months} checked={d.months === 1 || d.on} disabled={d.months === 1} title={d.months === 1 ? "الشهر متاح دائمًا" : undefined}
                onCheckedChange={(v) => setPlans({ ...plans, durations: plans.durations.map((x: any, j: number) => (j === i ? { ...x, on: v } : x)) })} />
              <Input name={"disc_" + d.months} type="number" min="0" max="90" step="0.5" dir="ltr" aria-label={`تخفيض ${d.months} أشهر`} value={d.discount}
                onChange={(e) => setPlans({ ...plans, durations: plans.durations.map((x: any, j: number) => (j === i ? { ...x, discount: e.target.value } : x)) })} />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F l="حجم الصورة للتقدير (م.ب)"><Input name="photo_mb" type="number" min="0.05" step="0.05" dir="ltr" value={plans.photo_mb} onChange={(e) => setPlans({ ...plans, photo_mb: e.target.value })} /></F>
          <F l="حجم الفيديو القصير للتقدير (م.ب)"><Input name="video_mb" type="number" min="1" step="1" dir="ltr" value={plans.video_mb} onChange={(e) => setPlans({ ...plans, video_mb: e.target.value })} /></F>
        </div>
        <div id="stPlanPreview" aria-live="polite" className="flex flex-col gap-1 rounded-xl bg-muted p-4 text-sm">
          <b>أمثلة بالسعر الحالي ({n(unit)} دج لكل غيغابايت شهريًا)</b>
          {line(20, p.durations[0])}{p.durations[2].on ? line(20, p.durations[2]) : null}{p.durations[3].on ? line(20, p.durations[3]) : null}
          <span>20 غ.ب ≈ {n(Math.floor(20000 / (p.photo_mb || 1)))} صورة أو {n(Math.floor(20000 / (p.video_mb || 1)))} فيديو قصير</span>
        </div>
        <Button type="submit" className="self-start">حفظ الخطط</Button>
      </Block>

      <Block id="stCheck" title="فحص «تخزين نواة»" lead="يتأكد من الاتصال بالتخزين، ومن إمكانية حفظ ملف، ومن السماح بالرفع من الموقع. لا يعرض أي مفاتيح.">
        <div id="stCheckOut" aria-live="polite" className="flex flex-col gap-1 text-sm">{check}</div>
        <Button variant="outline" className="self-start" id="stCheckBtn" disabled={checking} onClick={async () => {
          setChecking(true); setCheck(<p className="text-muted-foreground">جارٍ الفحص…</p>);
          try { setCheck(checkLines((await request("/api/admin/content?action=storage-check")).check)); } catch { setCheck(<p className="text-red-700">تعذّر الفحص.</p>); }
          setChecking(false);
        }}>افحص الآن</Button>
      </Block>

      <Block id="stPay" title="معلومات الدفع" lead="تظهر للعملاء في «التخزين» تحت فواتيرهم. اترك أي حقل فارغًا لإخفائه."
        onSubmit={(e) => { e.preventDefault(); go({ payment: pay }, "حُفظت معلومات الدفع."); }}>
        <div className="grid gap-3 sm:grid-cols-2">{PAY.map(([k, l]) => <F key={k} l={l}><Input name={k} dir="ltr" maxLength={120} value={pay[k]} onChange={(e) => setPay({ ...pay, [k]: e.target.value })} /></F>)}</div>
        <Button type="submit" className="self-start">حفظ معلومات الدفع</Button>
      </Block>
    </div>
  );
}

// Plain-words result of the storage check, with what to fix for each failure.
const CHECK: Record<string, Record<string, string>> = {
  connect: {
    ok: "الاتصال بالتخزين يعمل.",
    unreachable: "تعذّر الوصول إلى التخزين: تأكد أن R2_ACCOUNT_ID هو معرّف الحساب فقط (32 حرفًا ورقمًا)، وليس رابطًا كاملًا.",
    InvalidAccessKeyId: "مفتاح الوصول غير صحيح: تحقّق من R2_ACCESS_KEY_ID في Vercel.",
    SignatureDoesNotMatch: "المفتاح السري لا يطابق مفتاح الوصول: تحقّق من R2_SECRET_ACCESS_KEY في Vercel.",
    NoSuchBucket: "اسم الحاوية غير موجود: يجب أن يكون R2_BUCKET مطابقًا تمامًا لاسم الحاوية في Cloudflare.",
    AccessDenied: "المفتاح لا يملك صلاحية هذه الحاوية: أنشئ مفتاحًا بصلاحية Object Read & Write على هذه الحاوية.",
    Unauthorized: "المفتاح لا يملك صلاحية هذه الحاوية: أنشئ مفتاحًا بصلاحية Object Read & Write على هذه الحاوية.",
  },
  write: { ok: "حفظ الملفات وقراءتها يعمل.", AccessDenied: "المفتاح يقرأ فقط: يلزمه صلاحية Object Read & Write." },
  cors: {
    ok: "الرفع من الموقع مسموح (CORS).",
    missing: "الرفع من الموقع غير مسموح: أضف قاعدة CORS للحاوية في Cloudflare (Settings ← CORS Policy) بعنوان الموقع.",
    other_origin: "قاعدة CORS موجودة لكن بعنوان موقع آخر: أضف عنوان هذا الموقع في AllowedOrigins.",
  },
};
function checkLines(c: any) {
  const P = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => <p className={cn(ok ? "st-ok text-green-700" : "st-bad text-red-700")}>{ok ? "✓" : "✗"} {children}</p>;
  if (!c?.configured) return <P ok={false}>«تخزين نواة» غير مضبوط: أضف متغيرات R2 الأربعة في Vercel ثم أعد النشر.</P>;
  return (
    <>
      {c.account === "bad_format" ? <P ok={false}>R2_ACCOUNT_ID ليس بالشكل المتوقع: لا يحتوي على معرّف حساب (32 حرفًا ورقمًا من صفحة R2 في Cloudflare). صحّحه في Vercel ثم أعد النشر.</P>
        : c.account === "extracted" ? <P ok>استُخرج معرّف الحساب من قيمة R2_ACCOUNT_ID (يُفضّل أن تكون المعرّف وحده).</P> : null}
      {["connect", "write", "cors"].map((k) => (c[k] ? <P key={k} ok={c[k] === "ok"}>{CHECK[k][c[k]] || `${k}: ${c[k]}`}</P> : null))}
    </>
  );
}
