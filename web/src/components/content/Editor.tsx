"use client";
// The post window: title, type, planned time, platforms, files, captions, notes, then approval and
// scheduling. Unsaved edits live in the form until «حفظ»; scheduling saves them first.
import * as React from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Confirm } from "@/components/Confirm";
import { CopyButton } from "@/components/CopyButton";
import { Media } from "./Media";
import { Schedule } from "./Schedule";
import { PLATFORMS, PLATFORM_IDS, KINDS, normAt, isAt } from "@/lib/shared";
import { useCT, stOf, STATUS_CLASS, type Api, type Post } from "./lib";
import { cn } from "@/lib/utils";

export type Form = { title: string; kind: string; date: string; platforms: string[]; captions: Record<string, string>; notes: string };
const fromPost = (p: Post): Form => ({ title: p.title || "", kind: p.kind || "image", date: p.date || "", platforms: p.platforms || [], captions: { ...(p.captions || {}) }, notes: p.notes || "" });

export function Editor({ post: p, mode, api, tenant, meta, act, absorb, onClose, onDeleted }: {
  post: Post; mode: "client" | "admin"; api: Api; tenant: string; meta: any;
  act: (a: string, b: any) => Promise<any>; absorb: (d: any) => void; onClose: () => void; onDeleted: () => void;
}) {
  const { t, lang, pf, fmtAt, fmtTime, errText } = useCT();
  const CLIENT = mode === "client";
  const [form, setForm] = React.useState<Form>(() => fromPost(p));
  const [dirty, setDirty] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [warned, setWarned] = React.useState(false);
  const [capTab, setCapTab] = React.useState("all");
  const [why, setWhy] = React.useState<null | string>(null); // the proposal's rejection reason box
  const [busy, setBusy] = React.useState(false);
  const own = React.useRef<string | undefined>(p.updatedAt);
  const titleRef = React.useRef<HTMLInputElement>(null);

  /** Actions from this window: their answer is not "a change made elsewhere". */
  const mine = React.useCallback(async (a: string, b: any) => { const d = await act(a, b); if (d?.post) own.current = d.post.updatedAt; return d; }, [act]);

  // a new post opens with its title selected
  React.useEffect(() => { if (p.title === t("newPostTitle") && !p.captions?.all) setTimeout(() => titleRef.current?.select(), 60); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // pick up files added straight into the post's Drive folder
  React.useEffect(() => { if (p.folderId) api.get("files", { id: p.id }).then((d) => { if (d.post) own.current = d.post.updatedAt; absorb(d); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the post changed: from this window (refresh the form), or elsewhere (Claude, another device)
  React.useEffect(() => {
    if (p.updatedAt === own.current) { if (!dirty) setForm(fromPost(p)); return; }
    own.current = p.updatedAt;
    if (dirty) { setNote(t("changedElsewhere")); return; }
    setForm(fromPost(p)); toast(t("updatedElsewhere"));
  }, [p.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (patch: Partial<Form>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); setWarned(false); setNote(t("unsaved")); };
  const patchOf = (): Partial<Form> => ({ ...form, date: normAt(form.date) });

  const save = async (quiet = false) => {
    setBusy(true);
    try {
      const d = await mine("update", { id: p.id, ...patchOf() });
      setDirty(false); setForm(fromPost(d.post));
      setNote(quiet ? "" : Object.keys(d.post.schedule || {}).length ? t("savedCal") : t("saved"));
      return true;
    } catch (e) { toast.error(errText(e)); return false; }
    finally { setBusy(false); }
  };
  const saveIfDirty = async () => (dirty ? save(true) : true);

  const close = () => {
    if (dirty && !warned) { setWarned(true); setNote(t("closeWarn")); return; }
    onClose();
  };
  const remove = async () => {
    try { onDeleted(); await act("delete", { id: p.id }); toast.success(t("deletedToast")); }
    catch (e) { toast.error(errText(e)); }
  };

  const st = stOf(p);
  const limit = capTab === "all" ? Math.min(...form.platforms.map((k) => PLATFORMS[k].limit).concat([63206])) : PLATFORMS[capTab].limit;
  const capVal = form.captions[capTab] || "";
  const count = [...capVal].length;
  const copyText = capTab === "all" ? capVal : capVal.trim() || form.captions.all || "";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent dir={lang === "ar" ? "rtl" : "ltr"} showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" id="ctDialog">
        <div className="flex items-center gap-2 border-b px-5 py-3">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", STATUS_CLASS[st])}>{t("s_" + st)}</span>
          <span className="text-sm text-muted-foreground">{fmtAt(p.date)}</span>
          {p.from?.by === "claude" ? <span className="rounded-full bg-[#D97757]/15 px-2 py-0.5 text-xs text-[#A4502F]">{t("fromClaude")}</span> : null}
          <Button variant="ghost" size="icon-sm" className="ms-auto" id="ceClose" onClick={close} aria-label={t("close")}>✕</Button>
        </div>
        <DialogTitle className="sr-only">{form.title || t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("planned")}</DialogDescription>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {p.proposal ? (
            <div className="ct-proposal flex flex-col gap-2 rounded-xl border border-[#D97757]/40 bg-[#D97757]/8 p-4">
              <b className="flex items-center gap-2"><Sparkles className="size-4 text-[#D97757]" />{t("propTitle")}</b>
              <span className="text-sm text-muted-foreground">{t("propMade", fmtTime(p.proposal.at))} · {p.date ? t("propAt", fmtAt(p.date)) : t("propNoAt")} · {t("propNotYet")}</span>
              {p.proposal.idea ? <p className="text-sm"><b>{t("propIdea")}</b> {p.proposal.idea}</p> : null}
              {CLIENT ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button id="cePropOk" disabled={busy} className="bg-lime text-ink hover:bg-lime/85" onClick={async () => {
                      setBusy(true);
                      try {
                        if (dirty && !(await save(true))) return;
                        const d = await mine("proposal-approve", { id: p.id });
                        toast.success(d.tiktok_settings ? (d.scheduled ? t("propOkTt") : t("propOkTtOnly")) : d.scheduled ? t("propOk") : t("propOkNoAt"));
                      } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
                    }}>{t("propApprove")}</Button>
                    <Button variant="outline" id="cePropNo" onClick={() => setWhy(why === null ? "" : null)}>{t("propReject")}</Button>
                  </div>
                  {why !== null ? (
                    <div className="flex flex-wrap gap-2">
                      <Input id="cePropReason" autoFocus maxLength={300} placeholder={t("propReason")} value={why} onChange={(e) => setWhy(e.target.value)} className="min-w-60 flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (document.getElementById("cePropReject") as HTMLButtonElement)?.click(); } }} />
                      <Button id="cePropReject" disabled={busy} onClick={async () => {
                        setBusy(true);
                        try { onDeleted(); await act("proposal-reject", { id: p.id, reason: why }); toast.success(t("propRejected")); }
                        catch (e) { toast.error(errText(e)); setBusy(false); }
                      }}>{t("propRejectConfirm")}</Button>
                    </div>
                  ) : null}
                  <small className="text-muted-foreground">{t("propHint")}</small>
                </>
              ) : <span className="text-sm text-muted-foreground">{t("propWaiting")}</span>}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="ceTitle">{t("title")}</Label>
            <Input id="ceTitle" ref={titleRef} maxLength={200} value={form.title} onChange={(e) => edit({ title: e.target.value })} className="h-10 text-base" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ceKind">{t("kind")}</Label>
              <NativeSelect id="ceKind" value={form.kind} onChange={(e) => edit({ kind: e.target.value })} className="w-full [&_select]:h-10">
                {Object.keys(KINDS).map((k) => <NativeSelectOption key={k} value={k}>{t("k_" + k)}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ceDate">{t("planned")}</Label>
              <Input id="ceDate" type="datetime-local" dir="ltr" value={form.date} onChange={(e) => edit({ date: e.target.value })} className="h-10" />
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("platforms")}</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_IDS.map((k: string) => {
                const on = form.platforms.includes(k);
                return (
                  <label key={k} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2", on && "border-indigo bg-indigo/5")}>
                    <Checkbox id={"cePf_" + k} checked={on} onCheckedChange={(v) => edit({ platforms: PLATFORM_IDS.filter((x: string) => (x === k ? v === true : form.platforms.includes(x))) })} />
                    {pf(k)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Media post={p} mode={mode} api={api} tenant={tenant} act={mine} beforeUpload={saveIfDirty} />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-lg font-bold">{t("caption")}</h3>
              <CopyButton value={copyText} label={t("copyCaption")} doneLabel={t("copied")} onCopied={(ok) => (ok ? toast.success(t("copied")) : toast.error(t("copyFail")))} />
            </div>
            <Tabs value={capTab} onValueChange={setCapTab}>
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="all" data-cap="all">{t("capAll")}</TabsTrigger>
                {PLATFORM_IDS.map((k: string) => <TabsTrigger key={k} value={k} data-cap={k}>{pf(k)}{(form.captions[k] || "").trim() ? " •" : ""}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <Textarea id="ceCaption" rows={8} value={capVal} className="min-h-40 text-base leading-relaxed"
              placeholder={capTab === "all" ? t("capAllPh") : t("capPfPh", pf(capTab))}
              onChange={(e) => edit({ captions: { ...form.captions, [capTab]: e.target.value } })} />
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{capTab === "all" ? t("capAllHint") : capVal.trim() ? t("capOwn", pf(capTab)) : t("capUsesAll")}</span>
              <span dir="ltr" className={cn("tabular-nums text-muted-foreground", count > limit && "font-bold text-destructive")} id="ceCount">{count.toLocaleString("en-US")} / {limit.toLocaleString("en-US")}</span>
            </div>
          </section>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ceNotes">{t("notes")}</Label>
            <Textarea id="ceNotes" rows={2} placeholder={t("notesPh")} value={form.notes} onChange={(e) => edit({ notes: e.target.value })} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button id="ceSave" size="lg" disabled={busy} onClick={() => save()}>{t("save")}</Button>
            <span id="ceSaved" role="status" className={cn("text-sm text-muted-foreground", (warned || note === t("changedElsewhere")) && "text-amber-700")}>{note}</span>
          </div>

          <Schedule post={p} form={form} dirty={dirty} mode={mode} meta={meta} api={api} act={mine} saveIfDirty={saveIfDirty} />

          <div className="border-t pt-4">
            <Confirm title={t("delConfirm")} action={t("del")} onConfirm={remove}>
              <Button variant="ghost" className="text-destructive" id="ceDelete">{t("del")}</Button>
            </Confirm>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
