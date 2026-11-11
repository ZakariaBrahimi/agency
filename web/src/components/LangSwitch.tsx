"use client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LANGS, useLang, type Lang } from "@/lib/i18n";

const LABEL: Record<Lang, string> = { ar: "ع", en: "EN", fr: "FR" };

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <ToggleGroup type="single" value={lang} onValueChange={(v) => v && setLang(v as Lang)} aria-label="Language"
      className="rounded-lg bg-white/10 p-0.5" size="sm">
      {LANGS.map((l) => (
        <ToggleGroupItem key={l} value={l} lang={l} data-lang={l} aria-label={l}
          className="h-7 min-w-9 rounded-md px-2 text-xs font-semibold text-white/80 hover:bg-white/15 hover:text-white data-[state=on]:bg-lime data-[state=on]:text-ink">
          {LABEL[l]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
