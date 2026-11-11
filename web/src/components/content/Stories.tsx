"use client";
// Nawa's own highlight stories: six ready-made sets published to Instagram in order. Instagram has no API
// for highlights, so the highlight itself is made in the app.
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Confirm } from "@/components/Confirm";
import { STORY_SETS, storyFiles, storyCover } from "@/lib/shared";
import { useCT, STATUS_CLASS, type Api } from "./lib";
import { cn } from "@/lib/utils";

export function Stories({ api, meta }: { api: Api; meta: any }) {
  const { t, fmtTime, errText } = useCT();
  const [sets, setSets] = React.useState<any>({});
  const [queue, setQueue] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(true);
  const [busy, setBusy] = React.useState("");
  React.useEffect(() => { try { setOpen(localStorage.getItem("nawa.ct.stories") !== "closed"); } catch {} }, []);
  React.useEffect(() => { api.get("stories").then((d) => { setSets(d.sets || {}); setQueue(d.queue || []); }).catch(() => {}); }, [api]);
  const live = meta?.configured && meta.accounts;
  const done = STORY_SETS.filter((s: any) => sets[s.id]?.publishedAt).length;
  const label = (set: any, st: any) => (st.publishedAt ? t("stAgain") : st.done ? t("stFinish", set.count - st.done) : t("stPublish", set.count));
  const publish = async (set: any) => {
    setBusy(set.id);
    try {
      const d = await api.post("story", { set: set.id });
      setSets(d.sets); setQueue(d.queue || []);
      const st = d.sets[set.id];
      if (st.publishedAt) toast.success(t("stOk", set.name)); else if (st.error) toast.error(st.error.message); else toast(t("stSome", st.done, set.count));
    } catch (e) { toast.error(errText(e)); }
    setBusy("");
  };
  return (
    <Card>
      <Collapsible open={open} onOpenChange={(o) => { setOpen(o); try { localStorage.setItem("nawa.ct.stories", o ? "open" : "closed"); } catch {} }}>
        <CardContent className="flex flex-col gap-4">
          <CollapsibleTrigger className="flex items-center gap-2 text-start">
            <b>{t("stories")}</b><span className="text-sm text-muted-foreground">{t("storiesSub", STORY_SETS.length, done)}</span>
            <ChevronDown className={cn("ms-auto size-4 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("storiesLead")}</p>
            {meta && !live ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>Meta:</b> {meta.error || t("e_meta_not_configured")}</p> : null}
            <ul className="grid gap-3 md:grid-cols-2">
              {STORY_SETS.map((set: any) => {
                const st = sets[set.id] || {};
                const status = st.publishedAt ? [t("stDone", fmtTime(st.publishedAt)), "published"] : st.done ? [t("stPart", st.done, set.count), "scheduled"] : queue.includes(set.id) ? [t("stQueued"), "scheduled"] : null;
                return (
                  <li key={set.id} className="flex flex-col gap-3 rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <span className="size-9 rounded-full bg-cover bg-center ring-2 ring-indigo/30" style={{ backgroundImage: `url(${storyCover(set)})` }} />
                      <b>{set.name}</b>
                      {status ? <span className={cn("ms-auto rounded-full border px-2 py-0.5 text-xs", STATUS_CLASS[status[1]])}>{status[0]}</span> : null}
                    </div>
                    <div className="flex gap-2 overflow-x-auto">{storyFiles(set).map((f: string, i: number) => (
                      <a key={f} href={f} target="_blank" rel="noopener" className="shrink-0"><img src={f} alt={`${set.name} · ${t("stFrame", i + 1)}`} loading="lazy" className="h-28 rounded-md border" /></a>
                    ))}</div>
                    {st.error ? <p className="text-sm text-destructive">{st.error.message}</p> : null}
                    <div className="flex flex-wrap items-center gap-2">
                      {live ? (
                        <Confirm title={t("stConfirm", set.name)} action={label(set, st)} destructive={false} onConfirm={() => publish(set)}>
                          <Button data-story={set.id} disabled={!!busy} variant={st.publishedAt ? "outline" : "default"}>{busy === set.id ? t("publishingNow") : label(set, st)}</Button>
                        </Confirm>
                      ) : null}
                      <Button asChild variant="link" size="sm"><a href={storyCover(set)} download={`highlight-${set.id}.jpg`}>{t("stCover")}</a></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
