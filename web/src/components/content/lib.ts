"use client";
// Helpers for «المحتوى»: the API (with the client being managed, for the admin), dates in Algiers time,
// statuses and error texts in the chosen language.
import * as React from "react";
import { request, ApiError } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { C } from "@/i18n/content";
import { postStatus } from "@/lib/shared";

export type Post = any;

export function makeApi(base: string, tenant: string) {
  const url = (action = "", params: Record<string, string> = {}) => {
    const q = new URLSearchParams({ ...(action ? { action } : {}), ...params, ...(tenant ? { client: tenant } : {}) }).toString();
    return base + (q ? "?" + q : "");
  };
  return {
    url,
    get: (action = "", params: Record<string, string> = {}) => request(url(action, params)),
    post: (action: string, body: any) => request(url(action), { method: "POST", body }),
    media: (id: string, size?: number) => url("media", { id, ...(size ? { size: String(size) } : {}) }),
  };
}
export type Api = ReturnType<typeof makeApi>;

/** Today in Algiers (UTC+1 all year), as YYYY-MM-DD. */
export const todayAt = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
export const isVideo = (m: any) => Boolean(m?.video || /^video\//.test(m?.mimeType || ""));
export const stOf = (p: Post) => (p.proposal ? "proposal" : postStatus(p));
export const byDate = (a: Post, b: Post) => (a.date || "9999").localeCompare(b.date || "9999");

export function useCT() {
  const t = useT(C);
  const { lang } = useLang();
  const pf = React.useCallback((k: string) => t("pf_" + k), [t]);
  const fmtAt = React.useCallback((at?: string) => {
    if (!at) return t("noDate");
    const [d, tm] = at.split("T");
    const [y, m, day] = d.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    return `${t("days")[wd]} ${day} ${t("months")[m - 1]} · ${tm}`;
  }, [t]);
  const fmtTime = React.useCallback((iso: string) => new Date(iso).toLocaleString(t("locale"), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [t]);
  const errText = React.useCallback((e: any) => {
    const code = e instanceof ApiError ? e.code : e?.code;
    if (code?.startsWith?.("caption_too_long")) return t("e_caption_too_long");
    if (code && (C.ar as any)["e_" + code]) return t("e_" + code);
    return e?.msg || t("e_error");
  }, [t]);
  return { t, lang, pf, fmtAt, fmtTime, errText };
}

export const STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-indigo/10 text-indigo border-indigo/20",
  publishing: "bg-amber-100 text-amber-800 border-amber-200",
  published: "bg-green-100 text-green-800 border-green-200",
  proposal: "bg-[#D97757]/15 text-[#A4502F] border-[#D97757]/30",
};
