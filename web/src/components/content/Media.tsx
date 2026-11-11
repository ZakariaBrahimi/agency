"use client";
// A post's files: thumbnails in order (move, remove, play a video), uploads with progress, and a video
// post's cover image (sent as the reel cover on Instagram and the video thumbnail on Facebook).
import * as React from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Download, ImagePlus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Confirm } from "@/components/Confirm";
import { Thumb } from "./PostCard";
import { useCT, isVideo, type Api, type Post } from "./lib";
import { cn } from "@/lib/utils";

type Up = { key: number; name: string; pct: number; error?: string };

export function Media({ post: p, mode, api, tenant, act, beforeUpload }: {
  post: Post; mode: "client" | "admin"; api: Api; tenant: string; act: (a: string, b: any) => Promise<any>; beforeUpload: () => Promise<boolean>;
}) {
  const { t, lang, errText } = useCT();
  const CLIENT = mode === "client";
  const media: any[] = p.media || [];
  const [ups, setUps] = React.useState<Up[]>([]);
  const [playing, setPlaying] = React.useState<any>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const coverRef = React.useRef<HTMLInputElement>(null);
  const rtl = lang === "ar";

  async function upload(files: File[], asCover = false) {
    if (!(await beforeUpload())) return;
    for (const file of files) {
      const key = Date.now() + Math.random();
      setUps((u) => [...u, { key, name: file.name, pct: 0 }]);
      const set = (patch: Partial<Up>) => setUps((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      try {
        const d = await act("upload", { id: p.id, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size });
        const uploaded: any = await new Promise((resolve, reject) => {
          const x = new XMLHttpRequest();
          x.open("PUT", d.uploadUrl);
          if (d.contentType) x.setRequestHeader("Content-Type", d.contentType); // «تخزين نواة» keeps the file's type
          x.upload.onprogress = (e) => { if (e.lengthComputable) set({ pct: (e.loaded / e.total) * 100 }); };
          // Google answers with the new file; «تخزين نواة» answers empty and the id comes from the server
          x.onload = () => (x.status < 300 ? resolve(d.fileId ? { id: d.fileId } : JSON.parse(x.responseText || "{}")) : reject(new Error("upload " + x.status)));
          x.onerror = () => reject(new Error("network"));
          x.send(file);
        });
        await act("attach", { id: p.id, file: { id: uploaded.id }, ...(asCover ? { as: "cover" } : {}) });
        setUps((u) => u.filter((x) => x.key !== key));
      } catch (e: any) {
        // a refused connection is usually the storage's CORS rule; a status is the storage refusing the upload
        set({ error: e.code ? errText(e) : e.message === "network" ? t("upNetwork") : t("upStatus", String(e.message).replace("upload ", "")) });
      }
    }
  }
  const moveTo = async (i: number, j: number) => {
    const order = media.map((m) => m.id); [order[i], order[j]] = [order[j], order[i]];
    try { await act("update", { id: p.id, media: order }); } catch (e) { toast.error(errText(e)); }
  };
  const hasVideo = media.some(isVideo) || p.kind === "video";
  const href = (m: any) => (CLIENT || tenant || m.store ? api.media(m.id, 1600) : `https://drive.google.com/file/d/${encodeURIComponent(m.id)}/view`);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-lg font-bold">{t("media")}</h3>
        <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload data-icon="inline-start" />{t("upload")}</Button>
        <input ref={fileRef} type="file" id="ceFiles" accept="image/*,video/*" multiple hidden onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ""; if (f.length) upload(f); }} />
      </div>
      {media.length ? (
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m, i) => (
            <li key={m.id} className="flex flex-col gap-1">
              <a href={isVideo(m) ? api.media(m.id) : href(m)} target="_blank" rel="noopener" title={m.name} data-play={isVideo(m) ? i : undefined}
                onClick={(e) => { if (isVideo(m)) { e.preventDefault(); setPlaying(m); } }}
                className="ct-mthumb relative block aspect-square overflow-hidden rounded-lg border bg-muted">
                <Thumb m={m} cover={p.cover} api={api} size={360} />
                <i dir="ltr" className="absolute start-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white not-italic">{i + 1}</i>
                {CLIENT ? <i className={cn("ct-store absolute end-1 bottom-1 rounded px-1.5 text-[0.65rem] not-italic", m.store === "cloud" ? "bg-indigo text-white" : "bg-white/90 text-ink")}>{m.store === "cloud" ? t("storeCloud") : t("storeDrive")}</i> : null}
              </a>
              <span className="flex items-center justify-center gap-0.5">
                <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => moveTo(i, i - 1)} aria-label={t("moveEarlier")}>{rtl ? <ArrowRight /> : <ArrowLeft />}</Button>
                <Button variant="ghost" size="icon-xs" disabled={i === media.length - 1} onClick={() => moveTo(i, i + 1)} aria-label={t("moveLater")}>{rtl ? <ArrowLeft /> : <ArrowRight />}</Button>
                {!CLIENT ? <Button asChild variant="ghost" size="icon-xs"><a href={`https://drive.google.com/uc?id=${encodeURIComponent(m.id)}&export=download`} aria-label={t("download")}><Download /></a></Button> : null}
                <Confirm title={`${t("removeFile")}: ${m.name || ""}`} action={t("removeFile")} onConfirm={async () => { try { await act("detach", { id: p.id, fileId: m.id, trash: true }); toast.success(t("fileRemoved")); } catch (e) { toast.error(errText(e)); } }}>
                  <Button variant="ghost" size="icon-xs" data-rm={m.id} aria-label={t("removeFile")} className="text-destructive"><X /></Button>
                </Confirm>
              </span>
            </li>
          ))}
        </ol>
      ) : <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{t("noMedia")}</p>}

      {ups.map((u) => (
        <div key={u.key} className={cn("flex flex-col gap-1 rounded-lg border p-2 text-sm", u.error && "border-red-200 bg-red-50")}>
          <span className="flex items-center justify-between gap-2"><span className="truncate">{u.name}</span>{u.error ? <Button variant="ghost" size="icon-xs" onClick={() => setUps((x) => x.filter((y) => y.key !== u.key))} aria-label={t("close")}><X /></Button> : null}</span>
          {u.error ? <span className="text-red-800">{u.error}</span> : <Progress value={u.pct} className="h-1.5" />}
        </div>
      ))}

      {hasVideo || p.cover ? (
        <div className="flex gap-3 rounded-xl border p-3" id="ceCover">
          <div className="grid aspect-[9/16] w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-center text-xs text-muted-foreground">
            {p.cover ? <img src={api.media(p.cover.id, 360)} alt={t("cover")} className="size-full object-cover" /> : t("noCover")}
          </div>
          <div className="flex flex-col gap-2">
            <b>{t("cover")}</b>
            <span className="text-sm text-muted-foreground">{t("coverNote")}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => coverRef.current?.click()}><ImagePlus data-icon="inline-start" />{p.cover ? t("coverChange") : t("coverUpload")}</Button>
              <input ref={coverRef} type="file" id="ceCoverFile" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload([f], true); }} />
              {p.cover ? <Button variant="ghost" size="sm" className="text-destructive" id="ceCoverRm" onClick={async () => { try { await act("cover-remove", { id: p.id }); toast.success(t("coverRemoved")); } catch (e) { toast.error(errText(e)); } }}>{t("coverRemove")}</Button> : null}
            </span>
          </div>
        </div>
      ) : null}

      {p.folderUrl ? <p className="text-sm text-muted-foreground">{t("filesIn")} <a href={p.folderUrl} target="_blank" rel="noopener" className="underline underline-offset-2">{t("driveFolder")}</a>. {t("driveFolderNote")}</p> : null}

      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent id="ctPlayer" className="max-w-[min(92vw,28rem)] bg-black p-2 sm:max-w-[min(92vw,28rem)]" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{playing?.name || "video"}</DialogTitle>
          {playing ? <video src={api.media(playing.id)} poster={p.cover ? api.media(p.cover.id, 1200) : undefined} controls autoPlay playsInline preload="metadata" className="max-h-[80dvh] w-full rounded" aria-label={playing.name || "video"} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
