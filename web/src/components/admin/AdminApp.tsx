"use client";
// /admin: Nawa's dashboard. Sign in with the admin password, then six sections:
// requests (from /start), content (Nawa's or a client's), clients, payments, settings, Madar.
import * as React from "react";
import { Header } from "@/components/portal/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Content } from "@/components/content/Content";
import { Requests } from "./Requests";
import { Clients } from "./Clients";
import { Payments } from "./Payments";
import { Settings } from "./Settings";
import { Madar } from "./Madar";
import { admin, SectionHead } from "./lib";
import { cn } from "@/lib/utils";

const SECTIONS = [["requests", "الطلبات"], ["content", "المحتوى"], ["clients", "العملاء"], ["payments", "المدفوعات"], ["settings", "الإعدادات"], ["madar", "مدار"]] as const;
type Section = (typeof SECTIONS)[number][0];
const HASH = /^#(content|madar|clients|payments|settings)/;

function Login({ onIn }: { onIn: () => void }) {
  const [pw, setPw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setPw(""); onIn(); return; }
      setMsg(d.error === "not_configured" ? "لم تُضبط كلمة المرور بعد: أضف ADMIN_PASSWORD في إعدادات Vercel ثم أعد النشر."
        : r.status === 429 ? "محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا." : "كلمة المرور غير صحيحة.");
    } catch { setMsg("تعذّر الاتصال. تحقّق من الإنترنت وحاول مرة أخرى."); }
    setBusy(false);
  };
  return (
    <Card className="mx-auto my-12 w-full max-w-md">
      <CardHeader><CardTitle className="font-heading text-2xl">تسجيل الدخول</CardTitle><CardDescription>أدخل كلمة مرور لوحة الإدارة.</CardDescription></CardHeader>
      <CardContent>
        <form id="loginForm" onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label htmlFor="pw">كلمة المرور</Label>
            <Input id="pw" type="password" autoComplete="current-password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} readOnly={busy} className="h-11" /></div>
          <Button id="loginBtn" type="submit" size="lg" disabled={busy} className="h-11 bg-lime text-ink hover:bg-lime/85">{busy ? <Spinner /> : null}{busy ? "جارٍ الدخول…" : "دخول"}</Button>
          {msg ? <p id="loginMsg" role="alert" className="text-sm text-destructive">{msg}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function AdminApp() {
  const [phase, setPhase] = React.useState<"boot" | "login" | "app">("boot");
  const [section, setSection] = React.useState<Section>("requests");
  const [seen, setSeen] = React.useState<Record<string, boolean>>({});
  const [clients, setClients] = React.useState<any[]>([]);
  const [tenant, setTenant] = React.useState("");

  const boot = React.useCallback(async () => {
    const r = await fetch("/api/admin/briefs", { credentials: "same-origin" }).catch(() => null);
    if (!r || r.status === 401) { setPhase("login"); return; }
    setPhase("app");
    const m = location.hash.match(HASH);
    setSection((m?.[1] as Section) || "requests");
    admin("clients").then((d) => setClients(d.clients || [])).catch(() => {});
  }, []);
  React.useEffect(() => { boot(); }, [boot]);
  React.useEffect(() => {
    const out = () => setPhase("login");
    window.addEventListener("nawa:signed-out", out);
    const onHash = () => { const m = location.hash.match(HASH); if (m) setSection(m[1] as Section); };
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener("nawa:signed-out", out); window.removeEventListener("hashchange", onHash); };
  }, []);
  React.useEffect(() => {
    setSeen((s) => (s[section] ? s : { ...s, [section]: true }));
    document.title = (SECTIONS.find((x) => x[0] === section)?.[1] || "الطلبات") + " | نواة";
  }, [section]);

  const go = (s: Section) => {
    if (s !== "requests" && !location.hash.startsWith("#" + s)) history.replaceState(null, "", "#" + s);
    if (s === "requests" && HASH.test(location.hash)) history.replaceState(null, "", location.pathname);
    setSection(s);
  };
  const logout = async () => { await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {}); setPhase("login"); };
  const openContentOf = (id: string) => { setTenant(id); go("content"); };

  return (
    <div className="min-h-dvh">
      <Header tag="لوحة الإدارة" brand="نواة" logoutLabel="تسجيل الخروج" onLogout={phase === "app" ? logout : undefined} hideLang />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16">
        {phase === "boot" ? (
          <div className="flex flex-col gap-4 py-10" role="status" aria-label="جارٍ التحميل"><Skeleton className="h-10 w-full max-w-xl" /><Skeleton className="h-72 w-full" /></div>
        ) : phase === "login" ? (
          <Login onIn={boot} />
        ) : (
          <>
            <nav id="sections" aria-label="أقسام اللوحة" className="flex gap-1 overflow-x-auto py-5">
              {SECTIONS.map(([k, l]) => (
                <button key={k} type="button" data-section={k} aria-pressed={section === k} onClick={() => go(k)}
                  className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors", section === k ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{l}</button>
              ))}
            </nav>
            <section hidden={section !== "requests"} id="dash">{seen.requests ? <Requests active={section === "requests"} /> : null}</section>
            <section hidden={section !== "content"} id="content">
              {seen.content ? (
                <>
                  <SectionHead title="المحتوى" />
                  <Content mode="admin" api="/api/admin/content" active={section === "content"} tenant={tenant} clients={clients} onTenant={setTenant} />
                </>
              ) : null}
            </section>
            <section hidden={section !== "clients"} id="clients">{seen.clients ? <Clients onClients={setClients} onContent={openContentOf} /> : null}</section>
            <section hidden={section !== "payments"} id="payments">{seen.payments ? <Payments active={section === "payments"} /> : null}</section>
            <section hidden={section !== "settings"} id="settings">{seen.settings ? <Settings /> : null}</section>
            <section hidden={section !== "madar"} id="madar">{seen.madar ? <Madar /> : null}</section>
          </>
        )}
      </main>
    </div>
  );
}
