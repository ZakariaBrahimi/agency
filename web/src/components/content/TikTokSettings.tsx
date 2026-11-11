"use client";
// What TikTok requires before a Direct Post: the account it goes to (asked from TikTok each time), who can
// watch (no default), interactions (off by default, greyed out when the account turned them off), the
// commercial content disclosure, the consent line, and the video's length against the account's limit.
import * as React from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useCT, isVideo, type Api, type Post } from "./lib";
import { cn } from "@/lib/utils";

const cache: { id?: string; at?: number; c?: any } = {};
const durations: Record<string, number> = {}; // video id -> seconds, read in the browser

export function useTikTok(p: Post, api: Api, on: boolean) {
  const { errText } = useCT();
  const video = (p.media || []).length === 1 && isVideo(p.media[0]) ? p.media[0] : null;
  const [c, setC] = React.useState<any>(cache.id === p.id ? cache.c : null);
  const [err, setErr] = React.useState("");
  const [dur, setDur] = React.useState<number | undefined>(video ? durations[video.id] : undefined);
  React.useEffect(() => {
    if (!on) return;
    if (cache.id === p.id && Date.now() - (cache.at || 0) < 120e3) { setC(cache.c); return; }
    api.get("tiktok-creator").then((d) => { Object.assign(cache, { id: p.id, at: Date.now(), c: d.creator }); setC(d.creator); setErr(""); }).catch((e) => setErr(errText(e)));
  }, [on, p.id, api, errText]);
  // the video's length, read once from the file
  React.useEffect(() => {
    if (!on || !video || durations[video.id] !== undefined) return;
    durations[video.id] = 0;
    const el = document.createElement("video"); el.preload = "metadata"; el.muted = true; el.src = api.media(video.id);
    el.onloadedmetadata = () => { durations[video.id] = Math.round(el.duration || 0); setDur(durations[video.id]); el.removeAttribute("src"); };
  }, [on, video?.id, api]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = p.tiktok || {};
  const tooLong = Boolean(video && c?.max_duration && (dur || 0) > c.max_duration);
  const ready = Boolean(video && s.privacy && !(c && !c.privacy.includes(s.privacy)) && !(s.commercial && !s.brand_own && !s.brand_paid) && !(s.brand_paid && s.privacy === "SELF_ONLY") && !tooLong);
  return { on, c, err, video, dur, tooLong, ready };
}

export function TikTokSettings({ post: p, tt, act }: { post: Post; tt: ReturnType<typeof useTikTok>; act: (a: string, b: any) => Promise<any> }) {
  const { t, errText } = useCT();
  const [local, setLocal] = React.useState<any>(p.tiktok || {});
  React.useEffect(() => setLocal(p.tiktok || {}), [p.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (tt.err) return <p className="text-sm text-red-700">{tt.err}</p>;
  if (!tt.c) return <p className="text-sm text-muted-foreground">{t("tt_loading")}</p>;
  const c = tt.c, s = local;
  const save = async (patch: any) => {
    const next = { ...s, ...patch };
    if (!next.commercial) { next.brand_own = false; next.brand_paid = false; }
    if (next.brand_paid && next.privacy === "SELF_ONLY") next.privacy = "";
    setLocal(next); // at once, then saved
    try { await act("tiktok-settings", { id: p.id, tiktok: next }); } catch (e) { toast.error(errText(e)); }
  };
  const link = (href: string, label: string) => <a href={href} target="_blank" rel="noopener" className="text-indigo underline underline-offset-2">{label}</a>;
  const music = link("https://www.tiktok.com/legal/page/global/music-usage-confirmation/en", t("tt_music"));
  const bc = link("https://www.tiktok.com/legal/page/global/bc-policy/en", t("tt_bc"));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed p-3" id="ceTT">
      <div className="flex items-center gap-3">
        {c.avatar ? <img src={c.avatar} alt="" width={36} height={36} className="rounded-full" /> : null}
        <span className="flex flex-col"><small className="text-muted-foreground">{t("tt_to")}</small>
          <b>{c.nickname || c.username}{c.username ? <>{" "}<bdi dir="ltr" className="font-normal text-muted-foreground">@{c.username}</bdi></> : null}</b></span>
      </div>
      {!tt.video ? <p className="text-sm text-red-700">{t("tt_oneVideo")}</p> : tt.tooLong ? <p className="text-sm text-red-700">{t("tt_tooLong", tt.dur, c.max_duration)}</p> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="ttPrivacy">{t("tt_who")}</Label>
        <NativeSelect id="ttPrivacy" value={s.privacy || ""} onChange={(e) => save({ privacy: e.target.value })} className="w-full sm:w-72 [&_select]:h-10">
          <NativeSelectOption value="" disabled>{t("tt_pick")}</NativeSelectOption>
          {c.privacy.map((x: string) => {
            const off = x === "SELF_ONLY" && s.brand_paid;
            return <NativeSelectOption key={x} value={x} disabled={off} title={off ? t("tt_noPrivate") : undefined}>{t(x)}{off ? ` · ${t("tt_noPrivate")}` : ""}</NativeSelectOption>;
          })}
        </NativeSelect>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("tt_allow")}</legend>
        <div className="flex flex-wrap gap-3">
          {["comment", "duet", "stitch"].map((k) => {
            const off = c[`${k}_disabled`];
            return (
              <label key={k} className={cn("flex items-center gap-2", off && "opacity-50")}>
                <Checkbox data-tt={k} checked={Boolean(s[k] && !off)} disabled={off} onCheckedChange={(v) => save({ [k]: v === true })} />
                {t("tt_" + k)}{off ? <small className="text-muted-foreground">({t("tt_off")})</small> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3">
          <Switch data-tt="commercial" checked={Boolean(s.commercial)} onCheckedChange={(v) => save({ commercial: v })} className="mt-0.5" />
          <span className="flex flex-col"><b>{t("tt_disclose")}</b><small className="text-muted-foreground">{t("tt_discloseSub")}</small></span>
        </label>
        {s.commercial ? (
          <div className="flex flex-col gap-2 ps-12">
            <label className="flex items-start gap-2"><Checkbox data-tt="brand_own" checked={Boolean(s.brand_own)} onCheckedChange={(v) => save({ brand_own: v === true })} className="mt-1" />
              <span><b>{t("tt_own")}</b> <small className="text-muted-foreground">{t("tt_ownSub")}</small></span></label>
            <label className="flex items-start gap-2"><Checkbox data-tt="brand_paid" checked={Boolean(s.brand_paid)} onCheckedChange={(v) => save({ brand_paid: v === true })} className="mt-1" />
              <span><b>{t("tt_paid")}</b> <small className="text-muted-foreground">{t("tt_paidSub")}</small></span></label>
            {!s.brand_own && !s.brand_paid ? <p className="text-sm text-red-700">{t("tt_pickOne")}</p> : <p className="text-sm text-muted-foreground">{t(s.brand_paid ? "tt_labelPaid" : "tt_labelOwn")}</p>}
          </div>
        ) : null}
      </div>
      <p className="text-sm">{t("tt_consent")} {s.commercial && s.brand_paid ? <>{bc}{t("tt_and")}{music}</> : music}{t("tt_tail")}</p>
      <p className="text-xs text-muted-foreground">{t("tt_later")}</p>
    </div>
  );
}
