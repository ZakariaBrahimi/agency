"use client";
// The interface language: Arabic by default, English and French from the switcher.
// Chosen with ?lang=…, remembered on this device (localStorage "nawa.lang"), and applied to <html lang dir>.
import * as React from "react";
import { DirectionProvider } from "@/components/ui/direction";

export const LANGS = ["ar", "en", "fr"] as const;
export type Lang = (typeof LANGS)[number];
export type Dict = Record<string, any>;
export type Dicts = { ar: Dict; en?: Dict; fr?: Dict };

const Ctx = React.createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "ar", setLang: () => {} });

function initialLang(): Lang {
  if (typeof window === "undefined") return "ar";
  try {
    const q = new URLSearchParams(location.search).get("lang") as Lang;
    if (LANGS.includes(q)) return q;
    const s = localStorage.getItem("nawa.lang") as Lang;
    if (LANGS.includes(s)) return s;
  } catch {}
  return "ar";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, set] = React.useState<Lang>("ar");
  React.useEffect(() => set(initialLang()), []);
  React.useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = React.useCallback((l: Lang) => {
    set(l);
    try { localStorage.setItem("nawa.lang", l); } catch {}
  }, []);
  return (
    <Ctx.Provider value={{ lang, setLang }}>
      <DirectionProvider dir={lang === "ar" ? "rtl" : "ltr"}>{children}</DirectionProvider>
    </Ctx.Provider>
  );
}

export const useLang = () => React.useContext(Ctx);

/** A translator over one or more dictionaries: t(key, ...args); functions are called with the args. */
export function useT(...dicts: Dicts[]) {
  const { lang } = useLang();
  return React.useCallback(
    (k: string, ...a: any[]): any => {
      for (const d of dicts) {
        const v = d[lang]?.[k] ?? d.ar[k];
        if (v !== undefined) return typeof v === "function" ? v(...a) : v;
      }
      return k;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, ...dicts],
  );
}

/** Picks the text for a language from { ar, en, fr } (Arabic when missing). */
export const pick = (v: any, lang: Lang) => (v && typeof v === "object" && !Array.isArray(v) ? v[lang] ?? v.ar : v);

/** Numbers with western digits (ar-DZ would write 14.997, which reads like a decimal). */
export const num = (n: number, lang: Lang) => Math.max(0, Math.floor(n)).toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
