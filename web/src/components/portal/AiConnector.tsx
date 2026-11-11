"use client";
// «المساعد الذكي»: the client's Claude connector. The client creates a private link (shown once) and adds
// it to Claude as a custom connector. Claude can only create draft proposals; they wait in «المحتوى».
import * as React from "react";
import { Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Confirm } from "@/components/Confirm";
import { CopyButton } from "@/components/CopyButton";
import { portal } from "@/lib/api";
import { num, useLang, useT } from "@/lib/i18n";
import { T, TS } from "@/i18n/portal";

export function AiConnector() {
  const t = useT(T, TS);
  const { lang } = useLang();
  const [ai, setAi] = React.useState<any>(null);
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { portal("ai-link").then(setAi).catch(() => setAi(false)); }, []);
  if (!ai) return null;
  const l = ai.link;
  const date = (iso: string) => String(iso || "").slice(0, 10);
  const create = async () => { setBusy(true); try { const d = await portal("ai-link", {}); setUrl(d.url); setAi({ ...ai, link: d.link }); } catch {} setBusy(false); };
  const revoke = async () => { setBusy(true); try { await portal("ai-revoke", {}); setUrl(""); setAi({ ...ai, link: null }); } catch {} setBusy(false); };

  return (
    <Card id="ptAi">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#D97757] text-white"><Sparkles className="size-5" /></span>
          <div className="flex flex-1 flex-col"><b>{t("aiTitle")}</b><span className="text-sm text-muted-foreground">{t("aiSub")}</span></div>
          {l ? <Badge className="bg-green-100 text-green-800">{t("aiOn")}</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">{t("aiLead")}</p>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-green-700" />{t("aiCan")}</li>
          <li className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-red-700" />{t("aiCant")}</li>
        </ul>
        {url ? (
          <div className="pt-ai-url flex flex-col gap-2 rounded-xl border border-indigo/30 bg-indigo/5 p-3">
            <b>{t("aiYourLink")}</b>
            <div className="flex items-center gap-2"><code dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-card px-2 py-1.5 text-sm">{url}</code><CopyButton value={url} label={t("copy")} doneLabel={t("copied")} className="pt-copy" /></div>
            <Alert className="border-amber-200 bg-amber-50 text-amber-900"><AlertDescription className="text-amber-900">{t("aiOnce")}</AlertDescription></Alert>
          </div>
        ) : null}
        {l || url ? (
          <ol className="pt-ai-steps flex list-decimal flex-col gap-1.5 ps-5 text-sm">{(t("aiSteps") as string[]).map((x, i) => <li key={i}>{x}</li>)}</ol>
        ) : null}
        {l ? (
          <p className="text-xs text-muted-foreground">
            {t("aiLinked", l.created_by || "—", date(l.created_at))} · {l.last_used_at ? t("aiUsed", date(l.last_used_at)) : t("aiNever")} · {t("aiDrafts", num(l.drafts_total || 0, lang))}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {l ? (
            <>
              <Confirm title={t("aiNewConfirm")} action={t("aiNew")} onConfirm={create}><Button variant="outline" disabled={busy} id="ptAiNew">{t("aiNew")}</Button></Confirm>
              <Confirm title={t("aiRevokeConfirm")} action={t("aiRevoke")} onConfirm={revoke}><Button variant="ghost" className="text-destructive" disabled={busy} id="ptAiOff">{t("aiRevoke")}</Button></Confirm>
            </>
          ) : (
            <Button size="lg" disabled={busy} onClick={create} id="ptAiCreate">{t("aiCreate")}</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
