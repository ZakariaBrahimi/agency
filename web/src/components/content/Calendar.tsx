"use client";
// The month calendar. Wide screens show each day's posts; phones show a compact month (a dot per post)
// and the chosen day's posts underneath.
import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard, PfBadges } from "./PostCard";
import { useCT, stOf, byDate, todayAt, STATUS_CLASS, type Api, type Post } from "./lib";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = { draft: "bg-muted-foreground/50", scheduled: "bg-indigo", publishing: "bg-amber-500", published: "bg-green-600", proposal: "bg-[#D97757]" };

export function Calendar({ posts, month, setMonth, api, onOpen, onNew }: {
  posts: Post[]; month: string | null; setMonth: (m: string) => void; api: Api; onOpen: (id: string) => void; onNew: (day: string) => void;
}) {
  const { t, lang, fmtAt } = useCT();
  const today = todayAt();
  const m0 = React.useMemo(() => {
    if (month) return month;
    const cur = today.slice(0, 7);
    const upcoming = posts.filter((p) => p.date && p.date.slice(0, 10) >= today).sort(byDate)[0];
    return posts.some((p) => p.date?.startsWith(cur)) || !upcoming ? cur : upcoming.date.slice(0, 7);
  }, [month, posts, today]);
  const [y, m] = m0.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // weeks start on Sunday
  const [day, setDay] = React.useState<string>("");
  const selDay = day.startsWith(m0) ? day : today.startsWith(m0) ? today : posts.find((p) => p.date?.startsWith(m0))?.date.slice(0, 10) || `${m0}-01`;
  const shift = (n: number) => setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  const onDay = (key: string) => posts.filter((p) => p.date?.startsWith(key)).sort(byDate);
  const undated = posts.filter((p) => !p.date);
  const rtl = lang === "ar";
  const dayList = onDay(selDay);
  const [, sm, sd] = selDay.split("-").map(Number);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" id="ctPrev" onClick={() => shift(-1)} aria-label={t("prevMonth")}>{rtl ? <ChevronRight /> : <ChevronLeft />}</Button>
        <h2 className="font-heading text-xl font-bold">{t("months")[m - 1]} <span dir="ltr">{y}</span></h2>
        <Button variant="outline" size="icon" id="ctNext" onClick={() => shift(1)} aria-label={t("nextMonth")}>{rtl ? <ChevronLeft /> : <ChevronRight />}</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {(t("daysShort") as string[]).map((d, i) => <div key={i} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"><span className="md:hidden">{d}</span><span className="max-md:hidden">{t("days")[i]}</span></div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: lead }, (_, i) => <div key={"o" + i} className="min-h-14 border-e border-b bg-muted/20 md:min-h-32" />)}
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1, key = `${m0}-${String(d).padStart(2, "0")}`, list = onDay(key);
            const isToday = key === today, sel = key === selDay;
            return (
              <div key={key} data-day={key} onClick={() => setDay(key)}
                className={cn("group relative flex min-h-14 flex-col gap-1 border-e border-b p-1 md:min-h-32 md:p-1.5", sel && "max-md:bg-indigo/5", "max-md:cursor-pointer")}>
                <span dir="ltr" className={cn("grid size-6 place-items-center self-start rounded-full text-xs font-medium", isToday && "bg-lime font-bold text-ink", sel && !isToday && "max-md:bg-ink max-md:text-white")}>{d}</span>
                <div className="flex flex-wrap gap-1 md:hidden">{list.map((p) => <i key={p.id} className={cn("size-1.5 rounded-full", DOT[stOf(p)])} />)}</div>
                <div className="flex flex-col gap-1 max-md:hidden">
                  {list.map((p) => (
                    <button key={p.id} type="button" data-open={p.id} onClick={(e) => { e.stopPropagation(); onOpen(p.id); }}
                      className={cn("ct-chip st-" + stOf(p), "flex flex-col gap-0.5 rounded-md border px-1.5 py-1 text-start text-xs leading-tight transition-shadow hover:shadow-sm", STATUS_CLASS[stOf(p)])}>
                      <span className="line-clamp-2 font-medium">{p.title}</span>
                      <span className="flex items-center gap-1"><PfBadges p={p} small /></span>
                    </button>
                  ))}
                </div>
                <button type="button" data-new={key} onClick={(e) => { e.stopPropagation(); onNew(key); }} aria-label={t("newOnDay", d)}
                  className="absolute end-1 top-1 hidden size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:grid md:group-hover:grid">
                  <Plus className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 md:hidden" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <b><span dir="ltr">{sd}</span> {t("months")[sm - 1]}</b>
          <Button variant="outline" size="sm" onClick={() => onNew(selDay)}><Plus data-icon="inline-start" />{t("addOnDay")}</Button>
        </div>
        {dayList.length ? dayList.map((p) => (
          <button key={p.id} type="button" data-open={p.id} onClick={() => onOpen(p.id)} className={cn("ct-dayitem st-" + stOf(p), "flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-start")}>
            <span className={cn("rounded-full border px-2 py-0.5 text-xs", STATUS_CLASS[stOf(p)])}>{t("s_" + stOf(p))}</span>
            <b>{p.title}</b>
            <span className="text-sm text-muted-foreground">{fmtAt(p.date)}</span>
            <span className="flex gap-1"><PfBadges p={p} /></span>
          </button>
        )) : <p className="text-sm text-muted-foreground">{t("noDayPosts")}</p>}
      </div>

      {undated.length ? (
        <>
          <h3 className="font-heading text-lg font-bold">{t("undated")}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{undated.map((p) => <PostCard key={p.id} p={p} api={api} onOpen={onOpen} />)}</div>
        </>
      ) : null}
    </div>
  );
}
