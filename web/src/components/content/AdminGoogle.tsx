"use client";
// Admin only: Nawa's Google account (content lives in its Drive) and the client being managed.
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/lib/api";
import { useCT } from "./lib";

export function AdminGoogle({ status, bar, account, clients, tenant, onTenant, onDisconnected }: {
  status: any; bar?: boolean; account?: { rootUrl?: string; email?: string }; clients?: any[]; tenant?: string; onTenant?: (id: string) => void; onDisconnected?: () => void;
}) {
  const { t } = useCT();
  if (bar) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {clients?.length ? (
          <label className="flex items-center gap-1.5"><span>{t("contentOf")}</span>
            <select id="ctTenant" value={tenant} onChange={(e) => onTenant?.(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-foreground">
              <option value="">{t("nawa")}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select> ·</label>
        ) : null}
        <span>{t("account")} <b dir="ltr" className="text-foreground">{account?.email || "Google"}</b></span> ·
        {account?.rootUrl ? <><a href={account.rootUrl} target="_blank" rel="noopener" className="underline underline-offset-2">{t("driveRoot")}</a> ·</> : null}
        <Button variant="link" size="sm" className="h-auto px-0" id="ctDisconnect" onClick={async () => { await request("/api/admin/google", { method: "DELETE" }).catch(() => {}); onDisconnected?.(); }}>{t("disconnect")}</Button>
      </p>
    );
  }
  if (!status) return null;
  if (!status.configured) {
    return (
      <Card><CardHeader><CardTitle>{t("googleFirst")}</CardTitle><CardDescription>{t("googleKeys")}</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ul className="list-disc ps-5"><li><code dir="ltr">GOOGLE_CLIENT_ID</code></li><li><code dir="ltr">GOOGLE_CLIENT_SECRET</code></li></ul>
          <p className="text-sm text-muted-foreground">{t("googleRedirect")} <code dir="ltr">{status.redirectUri}</code></p>
        </CardContent></Card>
    );
  }
  return (
    <Card><CardHeader><CardTitle>{t("googleConnectTitle")}</CardTitle><CardDescription>{t("googleConnectLead")}</CardDescription></CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <Button asChild size="lg" className="bg-lime text-ink hover:bg-lime/85"><a href="/api/admin/google?connect=1">{t("googleConnect")}</a></Button>
        <p className="text-sm text-muted-foreground">{t("googleWarn")}</p>
      </CardContent></Card>
  );
}
