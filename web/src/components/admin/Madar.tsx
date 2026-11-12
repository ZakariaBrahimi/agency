"use client";
// «مدار»: write and publish articles, tips and podcast episodes; read newsletter sign-ups and
// "write with us" pitches. Data lives in Supabase (madar_* tables) through /api/admin/madar.
import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, FileText, Lightbulb, Mic, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Confirm } from "@/components/Confirm";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Pill, SectionHead, Stat } from "./lib";
// @ts-ignore shared with the public Madar pages
import { TOPICS, topicById, KINDS, renderMarkdown, readingMinutes, slugify, SLUG } from "@site/madar-schema.js";

const API = "/api/admin/madar";
const ERR: Record<string, string> = {
  title_required: "اكتب عنوانًا.", bad_slug: "الرابط: حروف إنجليزية صغيرة وأرقام وشرطات فقط.", slug_taken: "هذا الرابط مستخدم. اختر رابطًا آخر.",
  reserved_slug: "هذا الرابط محجوز لصفحات مدار. اختر رابطًا آخر.", bad_audio_url: "رابط الصوت يجب أن يبدأ بـ https://", bad_topic: "اختر المسار.",
  service_key_missing: "أضف SUPABASE_SERVICE_ROLE_KEY في Vercel.",
};
const fmt = (s?: string) => (s ? new Date(s).toLocaleString("ar-DZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const publicUrl = (p: any) => (p.kind === "article" ? `/madar/${p.slug}` : p.kind === "tip" ? `/madar/tips/${p.number ?? p.slug}` : `/madar/podcast/${p.slug}`);
const isLive = (p: any) => p.status === "published" && p.published_at && new Date(p.published_at) <= new Date();
const blank = (kind: string) => ({ kind, status: "draft", title: "", slug: "", topic: "product", excerpt: "", body: "", author_name: "فريق نواة", author_role: "", series: "", series_part: null, featured: false, number: null, audio_url: "", duration_min: null, chapters: [], published_at: null });
const localDT = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return new Date(+d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const NEW = [["article", "مقال", "مقال طويل مع عناوين وسلسلة اختيارية", FileText], ["tip", "نصيحة", "جملة واحدة ومثال قصير، تُرقَّم تلقائيًا", Lightbulb], ["episode", "حلقة بودكاست", "«نبض»: رابط الصوت والفصول والنص الكامل", Mic]] as const;

export function Madar() {
  const [data, setData] = React.useState<{ posts: any[]; subscribers: any[]; pitches: any[] } | null>(null);
  const [err, setErr] = React.useState("");
  const [tab, setTab] = React.useState("posts");
  const [kind, setKind] = React.useState("all");
  const [edit, setEdit] = React.useState<any>(null);
  const load = React.useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([request(`${API}?what=posts`), request(`${API}?what=subscribers`), request(`${API}?what=pitches`)]);
      setData({ posts: a.posts, subscribers: b.subscribers, pitches: c.pitches }); setErr("");
    } catch (e: any) { if (e.code !== "signed_out") setErr(ERR[e.code] || "تعذّر التحميل. حاول مرة أخرى."); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (edit) {
    return <Editor post={edit} onBack={() => setEdit(null)}
      onSaved={(p, isNew) => setData((d) => d && ({ ...d, posts: isNew ? [p, ...d.posts] : d.posts.map((x) => (x.id === p.id ? p : x)) }))}
      onDeleted={(id) => { setData((d) => d && ({ ...d, posts: d.posts.filter((x) => x.id !== id) })); setEdit(null); }} />;
  }
  const head = (
    <SectionHead title="مدار" lead={<>المقالات والنصائح والبودكاست على <a href="/madar" target="_blank" rel="noopener" dir="ltr" className="underline">/madar ↗</a></>}>
      {data ? (
        <>
          <Button variant="outline" id="mdRefresh" onClick={load}><RefreshCw data-icon="inline-start" />تحديث</Button>
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild><Button id="mdNew" className="bg-lime text-ink hover:bg-lime/85"><Plus data-icon="inline-start" />جديد<ChevronDown data-icon="inline-end" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {NEW.map(([k, l, d, Icon]) => (
                <DropdownMenuItem key={k} data-kind={k} onSelect={() => setEdit(blank(k))} className="flex items-start gap-3 py-2">
                  <Icon className="mt-0.5 size-5 text-indigo" /><span className="flex flex-col"><b>{l}</b><small className="text-muted-foreground">{d}</small></span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </SectionHead>
  );
  if (err) return <>{head}<p className="py-10 text-center text-muted-foreground">{err}</p></>;
  if (!data) return <>{head}<div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div></>;

  const { posts, subscribers, pitches } = data;
  const newPitches = pitches.filter((p) => p.status === "new").length;
  const tabs: [string, string, number][] = [["posts", "المحتوى", posts.length], ["subscribers", "المشتركون", subscribers.length], ["pitches", "أفكار الكتّاب", pitches.length]];
  const list = posts.filter((p) => kind === "all" || p.kind === kind);
  const setPitch = async (id: string, status: string) => {
    try { const d = await request(API, { method: "PATCH", body: { pitch: id, status } }); setData({ ...data, pitches: pitches.map((p) => (p.id === d.pitch.id ? d.pitch : p)) }); }
    catch { toast.error("تعذّر الحفظ."); }
  };
  const copy = async (text: string, ok: string) => { try { await navigator.clipboard.writeText(text); toast.success(ok); } catch { toast.error("تعذّر النسخ."); } };
  const P: Record<string, [string, string]> = { new: ["جديدة", "new"], accepted: ["مقبولة", "ok"], declined: ["مرفوضة", "idle"] };

  return (
    <div className="flex flex-col gap-5" id="mdBody">
      {head}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={posts.filter((p) => p.kind === "article" && isLive(p)).length} label="مقالات منشورة" />
        <Stat n={posts.filter((p) => p.kind === "tip" && isLive(p)).length} label="نصائح" />
        <Stat n={subscribers.length} label="مشتركو رسالة الخميس" />
        <Stat n={newPitches} label="أفكار جديدة من الكتّاب" hl={!!newPitches} />
      </div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map(([k, l, c]) => (
          <button key={k} type="button" role="tab" data-tab={k} aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm", tab === k ? "border-ink bg-ink text-white" : "bg-card hover:bg-muted")}>
            {l}<span dir="ltr" className={cn("rounded-full px-1.5 text-xs", tab === k ? "bg-white/15" : "bg-muted")}>{c}</span></button>
        ))}
      </div>

      {tab === "posts" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">{[["all", "الكل"], ["article", "المقالات"], ["tip", "النصائح"], ["episode", "الحلقات"]].map(([k, l]) => (
            <Button key={k} size="sm" variant={kind === k ? "default" : "ghost"} data-kind={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</Button>
          ))}</div>
          {list.length ? (
            <div className="flex flex-col gap-2">
              {list.map((p) => {
                const t = topicById(p.topic);
                const st = p.status === "draft" ? ["مسودة", "idle"] : isLive(p) ? ["منشور", "ok"] : ["مجدول", "wait"];
                return (
                  <button key={p.id} type="button" data-id={p.id} onClick={() => setEdit(JSON.parse(JSON.stringify(p)))}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 text-start transition-colors hover:border-indigo/50">
                    <span className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-white" style={{ background: t.color }}>{KINDS[p.kind]}{p.number ? ` #${p.number}` : ""}</span>
                    <span className="flex min-w-0 flex-1 flex-col"><b className="truncate">{p.title}</b>
                      <span className="text-sm text-muted-foreground">{t.ar}{p.featured ? " · ★ مميّز" : ""} · {p.status === "draft" ? "آخر تعديل " + fmt(p.updated_at) : fmt(p.published_at)}</span></span>
                    <Pill tone={st[1]}>{st[0]}</Pill>
                  </button>
                );
              })}
            </div>
          ) : <p className="py-10 text-center text-muted-foreground">لا شيء هنا بعد. ابدأ بـ «جديد».</p>}
        </div>
      ) : tab === "subscribers" ? (
        subscribers.length ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3"><Button variant="outline" id="mdCopyEmails" onClick={() => copy(subscribers.map((r) => r.email).join(", "), `تم نسخ ${subscribers.length} عنوان.`)}>نسخ كل العناوين</Button>
              <span className="text-sm text-muted-foreground">الصقها في أداة البريد (Gmail، Mailchimp…) لإرسال رسالة الخميس.</span></div>
            <Card><CardContent className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead className="text-start">البريد</TableHead><TableHead className="text-start">من صفحة</TableHead><TableHead className="text-start">التاريخ</TableHead></TableRow></TableHeader>
              <TableBody>{subscribers.map((r) => <TableRow key={r.email}><TableCell dir="ltr" className="text-start">{r.email}</TableCell><TableCell>{r.source || "—"}</TableCell><TableCell>{fmt(r.created_at)}</TableCell></TableRow>)}</TableBody>
            </Table></CardContent></Card>
          </div>
        ) : <p className="py-10 text-center text-muted-foreground">لا مشتركين بعد. نموذج الاشتراك موجود في رئيسية مدار وفي نهاية كل مقال.</p>
      ) : pitches.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {pitches.map((p) => (
            <Card key={p.id}><CardContent className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2"><b>{p.title}</b><Pill tone={P[p.status][1]}>{P[p.status][0]}</Pill></div>
              <span className="text-sm text-muted-foreground">{topicById(p.topic).ar} · {p.name} · <span dir="ltr">{p.email}</span> · {fmt(p.created_at)}</span>
              {p.outline ? <p className="whitespace-pre-wrap text-sm">{p.outline}</p> : null}
              {p.links ? <p className="text-sm text-muted-foreground" dir="auto">{p.links}</p> : null}
              <div className="flex flex-wrap gap-2">
                {p.status !== "accepted" ? <Button size="sm" className="bg-lime text-ink hover:bg-lime/85" data-pitch={p.id} data-st="accepted" onClick={() => setPitch(p.id, "accepted")}>قبول</Button> : null}
                {p.status !== "declined" ? <Button size="sm" variant="outline" data-pitch={p.id} data-st="declined" onClick={() => setPitch(p.id, "declined")}>رفض</Button> : null}
                {p.status !== "new" ? <Button size="sm" variant="link" data-pitch={p.id} data-st="new" onClick={() => setPitch(p.id, "new")}>إعادة إلى «جديدة»</Button> : null}
                <Button size="sm" variant="link" onClick={() => copy(p.email, "تم نسخ البريد.")}>نسخ البريد</Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      ) : <p className="py-10 text-center text-muted-foreground">لا أفكار بعد. صفحة «اكتب معنا» على <span dir="ltr">/madar/write</span>.</p>}
    </div>
  );
}

const F = ({ l, hint, children }: { l?: string; hint?: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5 text-sm">{l ? <span className="font-medium">{l}</span> : null}{children}{hint ? <small className="text-muted-foreground">{hint}</small> : null}</label>
);

function Editor({ post, onBack, onSaved, onDeleted }: { post: any; onBack: () => void; onSaved: (p: any, isNew: boolean) => void; onDeleted: (id: string) => void }) {
  const [p, setP] = React.useState<any>(() => ({ ...post, chaptersText: (post.chapters || []).map((c: any) => `${c.t} ${c.title}`).join("\n"), published_local: localDT(post.published_at) }));
  const [dirty, setDirty] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [warned, setWarned] = React.useState(false);
  const slugTouched = React.useRef(false);
  const ta = React.useRef<HTMLTextAreaElement>(null);
  const isNew = !p.id;
  React.useEffect(() => { scrollTo({ top: 0 }); }, []);
  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn);
  }, [dirty]);
  const set = (patch: any) => { setP((x: any) => ({ ...x, ...patch })); setDirty(true); };

  const insertMd = (kind: string) => {
    const el = ta.current!; const [s, e] = [el.selectionStart, el.selectionEnd]; const sel = el.value.slice(s, e);
    const lineStart = el.value.lastIndexOf("\n", s - 1) + 1;
    const wrap = ({ b: ["**", "**", "نص عريض"], link: ["[", "](https://)", "نص الرابط"], code: ["`", "`", "code"] } as any)[kind];
    let v: string;
    if (wrap) v = el.value.slice(0, s) + wrap[0] + (sel || wrap[2]) + wrap[1] + el.value.slice(e);
    else { const prefix = ({ h2: "## ", ul: "- ", ol: "1. ", quote: "> 💡 " } as any)[kind]; v = el.value.slice(0, lineStart) + prefix + el.value.slice(lineStart); }
    set({ body: v }); requestAnimationFrame(() => el.focus());
  };
  const back = () => {
    if (dirty && !warned) { setWarned(true); toast.error("لديك تغييرات غير محفوظة. اضغط «رجوع» مرة أخرى للخروج دون حفظ."); setTimeout(() => setWarned(false), 4000); return; }
    onBack();
  };
  const save = async (status: string) => {
    const out: any = {
      ...post, status, title: p.title, slug: String(p.slug || "").replace(/^-+|-+$/g, ""), topic: p.topic, excerpt: p.excerpt, body: p.body,
      author_name: p.author_name, author_role: p.author_role, series: p.series || "", series_part: p.series_part ?? "", featured: Boolean(p.featured),
      number: p.number ?? "", audio_url: p.audio_url || "", duration_min: p.duration_min ?? "",
      chapters: String(p.chaptersText || "").split("\n").map((l: string) => l.trim().match(/^(\d{1,2}(?::\d{2}){1,2})\s+(.+)$/)).filter(Boolean).map((m: any) => ({ t: m[1], title: m[2] })),
      published_at: p.published_local ? new Date(p.published_local).toISOString() : (status === "published" ? post.published_at : null),
    };
    if (!out.slug) out.slug = `${post.kind}-${Date.now().toString(36)}`;
    if (!out.title.trim()) return setMsg(ERR.title_required);
    if (!SLUG.test(out.slug)) return setMsg(ERR.bad_slug);
    setBusy(true); setMsg("");
    try {
      const d = await request(API, { method: post.id ? "PUT" : "POST", body: post.id ? { id: post.id, post: out } : { post: out } });
      onSaved(d.post, !post.id);
      Object.assign(post, d.post);
      setP({ ...d.post, chaptersText: (d.post.chapters || []).map((c: any) => `${c.t} ${c.title}`).join("\n"), published_local: localDT(d.post.published_at) });
      setDirty(false);
      toast.success(status === "draft" ? "تم حفظ المسودة." : isLive(d.post) ? "تم النشر. تظهر على الموقع خلال دقيقتين." : "تمت الجدولة في التاريخ المحدد.");
    } catch (e: any) { if (e.code !== "signed_out") setMsg(ERR[e.code] || "تعذّر الحفظ. حاول مرة أخرى."); }
    setBusy(false);
  };
  const tip = p.kind === "tip";

  return (
    <form id="mdForm" noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4 py-2">
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 p-3 backdrop-blur">
        <Button type="button" variant="ghost" id="mdBack" onClick={back}><ArrowRight data-icon="inline-start" />رجوع إلى القائمة</Button>
        <span className="text-sm text-muted-foreground">{isNew ? "جديد" : "تعديل"} · {KINDS[p.kind]}{p.id && isLive(p) ? <> · <a href={publicUrl(p)} target="_blank" rel="noopener" className="underline">عرض الصفحة ↗</a></> : null}</span>
        <span className="ms-auto flex gap-2">
          <Button type="button" variant="outline" data-status="draft" disabled={busy} onClick={() => save("draft")}>حفظ كمسودة</Button>
          <Button type="button" data-status="published" disabled={busy} className="bg-lime text-ink hover:bg-lime/85" onClick={() => save("published")}>{p.status === "published" ? "حفظ التعديلات" : "نشر"}</Button>
        </span>
      </div>
      {msg ? <p id="mdMsg" role="alert" className="text-sm text-destructive">{msg}</p> : null}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
        <Card><CardContent className="flex flex-col gap-4">
          <F l={tip ? "النصيحة (جملة واحدة)" : "العنوان"}><Input name="title" maxLength={200} required value={p.title} className="h-12 text-lg font-bold"
            onChange={(e) => { const v = e.target.value; const patch: any = { title: v }; if (!p.id && !slugTouched.current) { const s = slugify(v); if (s) patch.slug = s; } set(patch); }} /></F>
          {!tip ? <F l="المقدمة" hint="تظهر تحت العنوان وفي جوجل والبطاقات."><Textarea name="excerpt" rows={2} maxLength={400} value={p.excerpt} onChange={(e) => set({ excerpt: e.target.value })} /></F> : null}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{tip ? "مثال أو شرح قصير" : p.kind === "episode" ? "ملاحظات الحلقة والنص الكامل" : "نص المقال"}</span>
              <div className="flex flex-wrap items-center gap-1" role="toolbar">
                {[["h2", "ع", "عنوان"], ["b", "B", "عريض"], ["ul", "•", "قائمة"], ["ol", "1.", "قائمة مرقمة"], ["quote", "💡", "ملاحظة بارزة"], ["link", "🔗", "رابط"], ["code", "</>", "كود"]].map(([k, l, t]) => (
                  <Button key={k} type="button" variant="outline" size="icon-sm" data-md={k} title={t} aria-label={t} onClick={() => insertMd(k)} disabled={preview}>{l}</Button>
                ))}
                <span className="ms-2 flex rounded-lg bg-muted p-0.5">
                  <Button type="button" size="sm" variant={preview ? "ghost" : "secondary"} data-view="write" aria-pressed={!preview} onClick={() => setPreview(false)}>كتابة</Button>
                  <Button type="button" size="sm" variant={preview ? "secondary" : "ghost"} data-view="preview" aria-pressed={preview} onClick={() => setPreview(true)}>معاينة</Button>
                </span>
              </div>
            </div>
            {preview ? <div id="mdPreview" className="md-preview min-h-60 rounded-xl border p-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.body).html || '<p class="text-muted-foreground">لا شيء بعد.</p>' }} />
              : <Textarea ref={ta} name="body" id="mdBodyText" dir="rtl" rows={tip ? 5 : 22} value={p.body} onChange={(e) => set({ body: e.target.value })} className="font-[inherit] leading-loose" />}
            {p.kind === "article" ? <small id="mdCount" className="text-muted-foreground">{readingMinutes(p.body)} دقائق قراءة تقريبًا</small> : null}
            <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">طريقة الكتابة</summary>
              <div className="pt-2"><code>## عنوان</code> · <code>**عريض**</code> · <code>- عنصر</code> · <code>1. عنصر</code> · <code>&gt; 💡 ملاحظة</code> (تبدأ برمز تعبيري فتصبح بطاقة ملوّنة) · <code>[نص](https://…)</code> · <code>![وصف](https://…صورة)</code> · <code>- [ ] مهمة</code> · <code>==تمييز==</code> · سطر فارغ بين الفقرات.</div></details>
          </div>
        </CardContent></Card>
        <Card><CardContent className="flex flex-col gap-4">
          <F l="المسار"><NativeSelect name="topic" value={p.topic} onChange={(e) => set({ topic: e.target.value })} className="w-full">{TOPICS.map((t: any) => <NativeSelectOption key={t.id} value={t.id}>{t.ar}</NativeSelectOption>)}</NativeSelect></F>
          <F l="الرابط" hint={tip ? "صفحة النصيحة تستخدم رقمها، والرابط للتمييز فقط." : "بالإنجليزية: كلمات قصيرة بشرطات. لا تغيّره بعد النشر."}>
            <span className="flex items-center gap-1" dir="ltr"><span className="text-xs text-muted-foreground">{p.kind === "article" ? "/madar/" : tip ? "/madar/tips/" : "/madar/podcast/"}</span>
              <Input name="slug" dir="ltr" maxLength={80} placeholder="honest-roadmap" value={p.slug} onChange={(e) => { slugTouched.current = true; set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-") }); }} /></span>
          </F>
          {p.kind !== "article" ? <F l={tip ? "رقم النصيحة" : "رقم الحلقة"} hint="اتركه فارغًا ليُعطى الرقم التالي تلقائيًا."><Input name="number" type="number" min={1} dir="ltr" value={p.number ?? ""} onChange={(e) => set({ number: e.target.value })} /></F> : null}
          {p.kind === "article" ? (
            <>
              <label className="flex items-center gap-2 text-sm"><Checkbox name="featured" checked={Boolean(p.featured)} onCheckedChange={(v) => set({ featured: v === true })} />مقال مميّز في رئيسية مدار</label>
              <div className="grid grid-cols-[1fr_5rem] gap-2"><F l="سلسلة"><Input name="series" placeholder="أساسيات المنتج" value={p.series || ""} onChange={(e) => set({ series: e.target.value })} /></F>
                <F l="الجزء"><Input name="series_part" type="number" min={1} dir="ltr" value={p.series_part ?? ""} onChange={(e) => set({ series_part: e.target.value })} /></F></div>
            </>
          ) : null}
          {p.kind === "episode" ? (
            <>
              <F l="رابط ملف الصوت" hint="MP3 مستضاف (Spotify for Creators، Archive.org…)."><Input name="audio_url" dir="ltr" placeholder="https://…/episode-1.mp3" value={p.audio_url || ""} onChange={(e) => set({ audio_url: e.target.value })} /></F>
              <F l="المدة بالدقائق"><Input name="duration_min" type="number" min={1} dir="ltr" value={p.duration_min ?? ""} onChange={(e) => set({ duration_min: e.target.value })} /></F>
              <F l="الفصول" hint="سطر لكل فصل: الوقت ثم العنوان."><Textarea name="chapters" rows={5} placeholder={"0:00 البداية والفكرة\n9:40 يوم الإطلاق"} value={p.chaptersText} onChange={(e) => set({ chaptersText: e.target.value })} /></F>
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-2"><F l="الكاتب"><Input name="author_name" maxLength={80} value={p.author_name} onChange={(e) => set({ author_name: e.target.value })} /></F>
            <F l="الصفة"><Input name="author_role" maxLength={80} placeholder="Product Manager" value={p.author_role || ""} onChange={(e) => set({ author_role: e.target.value })} /></F></div>
          <F l="تاريخ النشر" hint="فارغ = الآن عند النشر. تاريخ لاحق = يُنشر تلقائيًا في وقته."><Input name="published_at" type="datetime-local" dir="ltr" value={p.published_local} onChange={(e) => set({ published_local: e.target.value })} /></F>
          {p.id ? (
            <Confirm title="حذف نهائي؟" body={p.title} action="حذف نهائي" onConfirm={async () => {
              try { await request(`${API}?id=${p.id}`, { method: "DELETE" }); toast.success("تم الحذف."); onDeleted(p.id); } catch (e: any) { if (e.code !== "signed_out") toast.error("تعذّر الحذف."); }
            }}><Button type="button" variant="ghost" className="self-start text-destructive" id="mdDelete">حذف نهائي</Button></Confirm>
          ) : null}
        </CardContent></Card>
      </div>
    </form>
  );
}
