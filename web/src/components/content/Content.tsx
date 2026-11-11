"use client";
// «المحتوى»: plan, draft, edit, schedule and publish posts. The same tools in two places:
// - /portal (mode "client"): a client's own content, through /api/portal
// - /admin  (mode "admin"):  Nawa's own content, or a client's (tenant), through /api/admin/content
import * as React from "react";
import { toast } from "sonner";
import { CalendarDays, List, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "./Calendar";
import { PostCard } from "./PostCard";
import { Trash } from "./Trash";
import { Editor } from "./Editor";
import { Stories } from "./Stories";
import { AdminGoogle } from "./AdminGoogle";
import { makeApi, useCT, stOf, byDate, todayAt, type Post } from "./lib";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = { mode: "client" | "admin"; api: string; active?: boolean; tenant?: string; clients?: any[]; onTenant?: (id: string) => void; onProposals?: (n: number) => void };

export function Content({ mode, api: base, active = true, tenant = "", clients, onTenant, onProposals }: Props) {
  const { t, errText } = useCT();
  const CLIENT = mode === "client";
  const api = React.useMemo(() => makeApi(base, tenant), [base, tenant]);
  const [google, setGoogle] = React.useState<any>(CLIENT ? { connected: true } : null);
  const [loaded, setLoaded] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [trash, setTrash] = React.useState<any[]>([]);
  const [settings, setSettings] = React.useState<any>({});
  const [acct, setAcct] = React.useState<{ rootUrl?: string; email?: string }>({});
  const [meta, setMeta] = React.useState<any>(null);
  const [view, setView] = React.useState<"calendar" | "list">("calendar");
  const [filter, setFilter] = React.useState("all");
  const [month, setMonth] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const acting = React.useRef(0);
  const postsRef = React.useRef(posts); postsRef.current = posts;

  React.useEffect(() => { try { const v = localStorage.getItem("nawa.ct.view"); if (v === "list" || v === "calendar") setView(v); } catch {} }, []);

  /** Takes in what the server sent back (the whole list, or one post). */
  const absorb = React.useCallback((d: any) => {
    if (d.posts) { setPosts(d.posts); if (CLIENT) onProposals?.(d.posts.filter((p: Post) => p.proposal).length); }
    if (d.post) setPosts((ps) => ps.some((p) => p.id === d.post.id) ? ps.map((p) => (p.id === d.post.id ? d.post : p)) : [...ps, d.post]);
    if (d.trash) setTrash(d.trash);
    if (d.settings) setSettings(d.settings);
    if (d.rootUrl || d.email !== undefined) setAcct((a) => ({ rootUrl: d.rootUrl ?? a.rootUrl, email: d.email ?? a.email }));
  }, [CLIENT, onProposals]);
  const act = React.useCallback(async (action: string, body: any) => {
    acting.current++;
    try { const d = await api.post(action, body); absorb(d); return d; } finally { acting.current--; }
  }, [api, absorb]);

  const loadContent = React.useCallback(async () => {
    setLoaded(false); setErr(""); setMeta(null); setPosts([]); setMonth(null); setFilter("all");
    try { absorb(await api.get()); setLoaded(true); }
    catch (e: any) {
      if (e.code === "google_not_connected" && !CLIENT) { setGoogle(null); return; }
      if (e.code !== "signed_out") setErr(errText(e));
      return;
    }
    api.get("meta").then(setMeta).catch(() => {});
  }, [api, absorb, CLIENT, errText]);

  // admin: the Google account comes first (content lives in Nawa's Drive)
  React.useEffect(() => {
    if (CLIENT || google) return;
    request("/api/admin/google").then(setGoogle).catch((e) => setErr(errText(e)));
  }, [CLIENT, google, errText]);
  React.useEffect(() => { if (google?.connected) loadContent(); }, [google?.connected, loadContent]);

  // a post opened from the address (#content/p_…), and messages after connecting Google
  React.useEffect(() => {
    if (!loaded || !active) return;
    const route = () => {
      const h = location.hash.replace(/^#content\/?/, "");
      const g = ({ "google-connected": ["g_connected", false], "google-denied": ["g_denied", true], "google-failed": ["g_failed", true] } as any)[h];
      if (g) { (g[1] ? toast.error : toast.success)(t(g[0])); history.replaceState(null, "", "#content"); }
      else if (h.startsWith("p_") && postsRef.current.some((p) => p.id === h)) setOpenId(h);
    };
    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, [loaded, active, t]);

  // Keeps the calendar and the open post in step with changes made elsewhere (Claude, another device,
  // the scheduler): every 20 seconds while the page is visible, and when it comes back.
  React.useEffect(() => {
    if (!loaded) return;
    const sig = (ps: Post[]) => ps.map((x) => `${x.id}:${x.updatedAt || ""}`).join("|");
    const refresh = async () => {
      if (acting.current || document.hidden) return;
      let d; try { d = await api.get(); } catch { return; }
      if (acting.current || sig(d.posts || []) === sig(postsRef.current)) return;
      absorb(d);
    };
    const id = setInterval(refresh, 20e3);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(id); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [loaded, api, absorb]);

  // the open post was deleted somewhere else (Claude, another device)
  const selfDeleted = React.useRef(false);
  React.useEffect(() => {
    if (!openId || !loaded || posts.some((p) => p.id === openId)) return;
    if (!selfDeleted.current) toast.error(t("deletedElsewhere"));
    selfDeleted.current = false; setOpenId(null); history.replaceState(null, "", "#content");
  }, [posts, openId, loaded, t]);

  const openPost = (id: string) => { setOpenId(id); if (location.hash !== "#content/" + id) history.replaceState(null, "", "#content/" + id); };
  const closePost = () => { setOpenId(null); history.replaceState(null, "", "#content"); };
  const newPost = async (date = "") => {
    try { const d = await act("create", { title: t("newPostTitle"), date, platforms: ["instagram", "facebook"] }); openPost(d.post.id); }
    catch (e) { toast.error(errText(e)); }
  };

  if (!CLIENT && google && !google.connected) return <AdminGoogle status={google} />;
  if (err) return <p className="py-12 text-center text-muted-foreground">{err}</p>;
  if (!loaded) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label={t("loadingContent")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-10 w-80" /><Skeleton className="h-[28rem] w-full" />
      </div>
    );
  }

  const counts: Record<string, number> = { draft: 0, scheduled: 0, published: 0, proposal: 0, publishing: 0 };
  posts.forEach((p) => counts[stOf(p)]++);
  const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), today = todayAt();
  const thisWeek = posts.filter((p) => p.date && p.date.slice(0, 10) >= today && p.date.slice(0, 10) <= weekEnd).length;
  const shown = posts.filter((p) => filter === "all" || stOf(p) === filter);
  const filters: [string, string, number][] = [
    ["all", t("all"), posts.length],
    ...(counts.proposal ? [["proposal", t("proposals"), counts.proposal] as [string, string, number]] : []),
    ["draft", t("s_draft"), counts.draft], ["scheduled", t("s_scheduled"), counts.scheduled], ["published", t("s_published"), counts.published],
  ];
  const open = openId ? posts.find((p) => p.id === openId) : null;
  const effectiveFilter = filter === "trash" && !trash.length ? "all" : filter;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1" id="ctAccount">
          {!CLIENT ? (
            <AdminGoogle status={google} account={acct} clients={clients} tenant={tenant} onTenant={onTenant} onDisconnected={() => setGoogle(null)} bar />
          ) : null}
        </div>
        <div className="flex items-center gap-2" id="ctHeadActions">
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => { if (!v) return; setView(v as any); try { localStorage.setItem("nawa.ct.view", v); } catch {} }}>
            <ToggleGroupItem value="calendar" data-view="calendar" aria-label={t("calendar")} className="gap-1.5 px-3"><CalendarDays className="size-4" /><span className="max-sm:sr-only">{t("calendar")}</span></ToggleGroupItem>
            <ToggleGroupItem value="list" data-view="list" aria-label={t("list")} className="gap-1.5 px-3"><List className="size-4" /><span className="max-sm:sr-only">{t("list")}</span></ToggleGroupItem>
          </ToggleGroup>
          <Button id="ctNew" className="bg-lime text-ink hover:bg-lime/85" onClick={() => newPost("")}><Plus data-icon="inline-start" />{t("newPost")}</Button>
        </div>
      </div>

      {!settings.seeded && !CLIENT && !tenant ? (
        <Card className="border-lime bg-lime/10"><CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div><b>{t("seedTitle")}</b><p className="text-sm text-muted-foreground">{t("seedLead")}</p></div>
          <Button id="ctSeed" onClick={async () => { try { const d = await act("seed", {}); const first = (d.posts || []).filter((p: Post) => p.date).sort(byDate)[0]; if (first) setMonth(first.date.slice(0, 7)); toast.success(t("seeded")); } catch (e) { toast.error(errText(e)); } }}>{t("seedBtn")}</Button>
        </CardContent></Card>
      ) : null}

      {!CLIENT && !tenant ? <Stories api={api} meta={meta} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["st_drafts", counts.draft], ["st_scheduled", counts.scheduled, true], ["st_published", counts.published], ["st_week", thisWeek]].map(([k, n, hl]: any) => (
          <div key={k} className={cn("flex flex-col gap-0.5 rounded-2xl border bg-card p-4", hl && "border-ink bg-ink text-white")}>
            <b dir="ltr" className={cn("font-heading text-3xl", hl && "text-lime")}>{n}</b>
            <span className={cn("text-sm text-muted-foreground", hl && "text-white/70")}>{t(k)}</span>
          </div>
        ))}
      </div>

      <div role="tablist" aria-label={t("filterBy")} className="flex flex-wrap gap-2">
        {filters.map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={effectiveFilter === k} onClick={() => setFilter(k)} data-cf={k}
            className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors", effectiveFilter === k ? "border-ink bg-ink text-white" : "bg-card hover:bg-muted")}>
            {l}<span dir="ltr" className={cn("rounded-full px-1.5 text-xs", effectiveFilter === k ? "bg-white/15" : "bg-muted")}>{n}</span>
          </button>
        ))}
        {trash.length ? (
          <button type="button" role="tab" aria-selected={effectiveFilter === "trash"} onClick={() => setFilter("trash")} data-cf="trash"
            className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm", effectiveFilter === "trash" ? "border-ink bg-ink text-white" : "bg-card hover:bg-muted")}>
            <Trash2 className="size-4" />{t("trash")}<span dir="ltr" className="rounded-full bg-muted px-1.5 text-xs text-foreground">{trash.length}</span>
          </button>
        ) : null}
      </div>

      <div id="ctView" className="contents">
      {effectiveFilter === "trash" ? (
        <Trash items={trash} act={act} />
      ) : view === "list" ? (
        shown.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...shown].sort(byDate).map((p) => <PostCard key={p.id} p={p} api={api} onOpen={openPost} />)}</div>
        ) : <p className="py-12 text-center text-muted-foreground">{t("emptyFilter")}</p>
      ) : (
        <Calendar posts={shown} month={month} setMonth={setMonth} api={api} onOpen={openPost} onNew={(d) => newPost(d + "T20:00")} />
      )}
      </div>

      {open ? (
        <Editor key={open.id} post={open} mode={mode} api={api} tenant={tenant} meta={meta} act={act} absorb={absorb} onClose={closePost} onDeleted={() => { selfDeleted.current = true; }} />
      ) : null}
    </div>
  );
}
