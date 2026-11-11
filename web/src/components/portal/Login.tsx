"use client";
// Sign in with a 6-digit code sent by email, or with Google.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { portal, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
  );
}

export function Login({ t, message, onSignedIn }: { t: (k: string, ...a: any[]) => any; message: string; onSignedIn: () => void }) {
  const { lang } = useLang();
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(message);
  const codeRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setMsg(message), [message]);
  const err = (e: any) => t("e_" + (e instanceof ApiError ? e.code : "error")) || t("e_error");
  const errText = (e: any) => { const m = err(e); return m.startsWith("e_") ? t("e_error") : m; };

  async function send(addr = email) {
    setBusy(true); setMsg("");
    try {
      await portal("otp-send", { email: addr.trim().toLowerCase() });
      setEmail(addr.trim().toLowerCase()); setStep("code"); setCode("");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) { setMsg(errText(e)); }
    setBusy(false);
  }
  async function verify(c = code) {
    setBusy(true); setMsg("");
    try { await portal("otp-verify", { email, code: c }); onSignedIn(); }
    catch (e) { setMsg(errText(e)); setBusy(false); }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
      <Card className="shadow-sm">
        {step === "email" ? (
          <>
            <CardHeader>
              <CardTitle className="font-heading text-2xl">{t("loginTitle")}</CardTitle>
              <CardDescription>{t("loginLead")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); send(); }}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ptEmail">{t("email")}</Label>
                  <Input id="ptEmail" type="email" autoComplete="email" dir="ltr" required autoFocus value={email}
                    onChange={(e) => setEmail(e.target.value)} className="h-11 text-base" />
                </div>
                <Button type="submit" size="lg" className="h-11 bg-lime text-ink hover:bg-lime/85" disabled={busy}>
                  {busy ? <Spinner /> : null}{busy ? t("sending") : t("sendCode")}
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />{t("or")}<Separator className="flex-1" /></div>
                <Button asChild variant="outline" size="lg" className="pt-google h-11">
                  <a href="/api/portal?action=google"><GoogleIcon />{t("google")}</a>
                </Button>
                {msg ? <p role="alert" id="ptEmailMsg" className="text-sm text-destructive">{msg}</p> : null}
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="font-heading text-2xl">{t("codeTitle")}</CardTitle>
              <CardDescription>{t("codeLead")} <b dir="ltr" className="text-foreground">{email}</b></CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); verify(); }}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ptCode">{t("code")}</Label>
                  <Input id="ptCode" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" required
                    value={code} className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) verify(v); }} />
                </div>
                <Button type="submit" size="lg" className="h-11 bg-lime text-ink hover:bg-lime/85" disabled={busy}>
                  {busy ? <Spinner /> : null}{busy ? t("checking") : t("signIn")}
                </Button>
                <div className="flex justify-between">
                  <Button type="button" variant="link" className="px-0" id="ptResend" onClick={() => send(email)}>{t("resend")}</Button>
                  <Button type="button" variant="link" className="px-0" id="ptChange" onClick={() => { setStep("email"); setMsg(""); }}>{t("changeEmail")}</Button>
                </div>
                {msg ? <p role="alert" id="ptCodeMsg" className="text-sm text-destructive">{msg}</p> : null}
              </form>
            </CardContent>
          </>
        )}
      </Card>
      <a className="text-center text-sm text-muted-foreground underline underline-offset-4" href={`/privacy#${lang}`}>{t("privacy")}</a>
    </div>
  );
}
