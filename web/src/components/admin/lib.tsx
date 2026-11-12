"use client";
import * as React from "react";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";

/** The admin content API (/api/admin/content): GET without a body, POST with one. */
export const admin = (action: string, body?: any, qs = "") =>
  request(`/api/admin/content?action=${action}${qs}`, body !== undefined ? { method: "POST", body } : {});

export const dzd = (n: any) => `${Math.round(Number(n || 0)).toLocaleString("en-US")} دج`;
export const gb = (b: any) => { const v = Number(b || 0) / 1e9; return `${v < 10 ? v.toFixed(v < 1 ? 2 : 1) : Math.round(v)} غ.ب`; };
export const day = (iso: any) => String(iso || "").slice(0, 10);
export const fmtDate = (s: string) => new Date(s).toLocaleString("ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const METHODS: Record<string, string> = { baridimob: "بريدي موب", ccp: "CCP", redotpay: "RedotPay", cash: "نقدًا", other: "أخرى" };

const TONE: Record<string, string> = {
  idle: "bg-muted text-muted-foreground", wait: "bg-amber-100 text-amber-800", review: "bg-indigo/10 text-indigo",
  ok: "bg-green-100 text-green-800", bad: "bg-red-100 text-red-800", new: "bg-lime/40 text-ink",
};
export function Pill({ tone = "idle", children, className }: { tone?: string; children: React.ReactNode; className?: string }) {
  return <span className={cn("cl-st tone-" + tone, "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[tone], className)}>{children}</span>;
}

export function SectionHead({ title, lead, children }: { title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
      <div className="flex flex-col gap-1"><h1 className="font-heading text-3xl font-bold">{title}</h1>{lead ? <p className="text-muted-foreground">{lead}</p> : null}</div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Stat({ n, label, hl }: { n: React.ReactNode; label: string; hl?: boolean }) {
  return (
    <div className={cn("stat flex flex-col gap-0.5 rounded-2xl border bg-card p-4", hl && "hl border-ink bg-ink text-white")}>
      <b dir="ltr" className={cn("font-heading text-2xl", hl && "text-lime")}>{n}</b>
      <span className={cn("text-sm text-muted-foreground", hl && "text-white/70")}>{label}</span>
    </div>
  );
}
