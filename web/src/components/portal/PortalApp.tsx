"use client";
// /portal: the client's space. Sign in, follow the activation of each platform, manage content with
// Nawa's own tools, and choose where files are stored. Arabic by default; English and French too.
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Header } from "./Header";
import { Login } from "./Login";
import { Platforms } from "./Platforms";
import { Storage } from "./Storage";
import { Content } from "@/components/content/Content";
import { portal } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { T, TS } from "@/i18n/portal";
import { useClipboardDelegation } from "@/components/CopyButton";

type Tab = "platforms" | "content" | "storage";

export function PortalApp() {
  const t = useT(T, TS);
  const { lang } = useLang();
  const [phase, setPhase] = React.useState<"boot" | "login" | "app">("boot");
  const [me, setMe] = React.useState<any>(null);
  const [loginMsg, setLoginMsg] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("platforms");
  const [flash, setFlash] = React.useState<{ pf?: string; tt?: string; li?: string; storage?: string }>({});
  const [seen, setSeen] = React.useState(false); // the content tab stays mounted once opened
  React.useEffect(() => { if (tab === "content") setSeen(true); }, [tab]);
  useClipboardDelegation(t("copy"), t("copied"));

  React.useEffect(() => { document.title = t("title"); }, [t]);

  const boot = React.useCallback(async () => {
    const h = location.hash.slice(1);
    const gmsg = ({ "google-unknown": "g_unknown", "google-denied": "g_denied", "google-failed": "g_failed" } as any)[h];
    if (gmsg) history.replaceState(null, "", location.pathname);
    let m;
    try { m = await portal("me"); } catch { setLoginMsg(gmsg ? t(gmsg) : ""); setPhase("login"); return; }
    setMe(m); setPhase("app");
    const f: any = {};
    const tm = h.match(/^platforms\/(tiktok-(?:connected|denied|failed|scope))$/);
    if (tm) { f.pf = "tiktok"; f.tt = tm[1]; }
    const lm = h.match(/^platforms\/(linkedin-(?:connected|nopage|denied|failed|scope))$/);
    if (lm) { f.pf = "linkedin"; f.li = lm[1]; }
    const sm = ({ "storage/drive-connected": "d_connected", "storage/drive-denied": "d_denied", "storage/drive-failed": "d_failed" } as any)[h];
    if (sm) f.storage = sm;
    setFlash(f);
    if (tm || lm || h.startsWith("storage")) history.replaceState(null, "", location.pathname);
    setTab(h.startsWith("storage") ? "storage" : h.startsWith("content") ? "content" : "platforms");
  }, [t]);

  React.useEffect(() => { boot(); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const out = () => { setMe(null); setPhase("login"); };
    window.addEventListener("nawa:signed-out", out);
    return () => window.removeEventListener("nawa:signed-out", out);
  }, []);

  const go = (v: Tab) => {
    setTab(v);
    if (v === "content") { if (!location.hash.startsWith("#content")) history.replaceState(null, "", "#content"); }
    else if (location.hash) history.replaceState(null, "", location.pathname);
  };
  const logout = async () => { await portal("logout", {}).catch(() => {}); history.replaceState(null, "", location.pathname); setMe(null); setPhase("login"); };

  return (
    <div className="min-h-dvh">
      <Header tag={t("tag")} brand={lang === "ar" ? "نواة" : "Nawa"} logoutLabel={t("logout")} onLogout={phase === "app" ? logout : undefined} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16">
        {phase === "boot" ? (
          <div className="flex flex-col gap-4 py-10" role="status" aria-label={t("loading")}>
            <Skeleton className="h-9 w-56" /><Skeleton className="h-5 w-40" /><Skeleton className="h-10 w-full max-w-md" /><Skeleton className="h-64 w-full" />
          </div>
        ) : phase === "login" ? (
          <Login t={t} message={loginMsg} onSignedIn={boot} />
        ) : (
          <>
            <div className="flex flex-col gap-1 pt-8 pb-5">
              <h1 id="ptCompany" className="font-heading text-3xl font-bold">{me.client.name}</h1>
              <p id="ptUser" className="text-muted-foreground">{t("hello", me.user.name || me.user.email)}</p>
            </div>
            <Tabs value={tab} onValueChange={(v) => go(v as Tab)} className="gap-6">
              <TabsList className="h-11 w-full justify-start gap-1 rounded-xl bg-muted p-1 sm:w-auto">
                <TabsTrigger value="platforms" className="h-9 flex-1 px-4 text-sm sm:flex-none">{t("tabPlatforms")}</TabsTrigger>
                <TabsTrigger value="content" className="h-9 flex-1 px-4 text-sm sm:flex-none">
                  {t("tabContent")}
                  {me.proposals ? <Badge id="ptPropBadge" className="ms-1 h-5 min-w-5 rounded-full bg-indigo px-1.5 text-white" title={t("aiPendingTitle", me.proposals)}>{me.proposals}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="storage" className="h-9 flex-1 px-4 text-sm sm:flex-none">{t("tabStorage")}</TabsTrigger>
              </TabsList>
              <TabsContent value="platforms">
                <Platforms me={me} setMe={setMe} flash={flash} goContent={() => go("content")} />
              </TabsContent>
              <TabsContent value="content" forceMount className="data-[state=inactive]:hidden">
                {seen ? (
                  <Content mode="client" api="/api/portal" active={tab === "content"}
                    onProposals={(n: number) => setMe((m: any) => (m && m.proposals !== n ? { ...m, proposals: n } : m))} />
                ) : null}
              </TabsContent>
              <TabsContent value="storage">
                <Storage flashKey={flash.storage} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
