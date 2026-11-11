"use client";
// «المحذوفات»: deleted posts, restorable for 30 days.
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Confirm } from "@/components/Confirm";
import { useCT } from "./lib";

export function Trash({ items, act }: { items: any[]; act: (a: string, b: any) => Promise<any> }) {
  const { t, fmtAt, fmtTime, errText } = useCT();
  const left = (iso: string) => Math.max(0, 30 - Math.floor((Date.now() - Date.parse(iso)) / 864e5));
  const run = async (a: string, tid: string, ok: string) => { try { await act(a, { tid }); toast.success(ok); } catch (e) { toast.error(errText(e)); } };
  return (
    <div className="ct-trash flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("trashLead")}</p>
      {items.map((x) => (
        <Card key={x.id}><CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <b>{x.title}</b>
            <span className="text-sm text-muted-foreground">
              {x.by === "claude" ? t("byClaude") : t("deleted")} · {fmtTime(x.deletedAt)}{x.date ? ` · ${t("wasDue", fmtAt(x.date))}` : ""} · {t("purgeIn", left(x.deletedAt))}
            </span>
            {x.reason ? <span className="text-sm">{t("reason")}: {x.reason}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button data-restore={x.id} onClick={() => run("trash-restore", x.id, t("restored"))}>{t("restore")}</Button>
            <Confirm title={t("purgeConfirm")} action={t("purge")} onConfirm={() => run("trash-purge", x.id, t("purged"))}>
              <Button variant="ghost" className="text-destructive" data-purge={x.id}>{t("purge")}</Button>
            </Confirm>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}
