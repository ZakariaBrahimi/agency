"use client";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { Button } from "@/components/ui/button";

export function Header({ tag, brand, onLogout, logoutLabel }: { tag: string; brand: string; onLogout?: () => void; logoutLabel: string }) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-40 bg-ink text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <a href="/" className="flex items-center gap-2 font-heading text-lg font-bold" aria-label="Nawa">
          <Logo className="size-9" />
          <span>{brand}</span>
        </a>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80">{tag}</span>
        <div className="ms-auto flex items-center gap-2">
          <LangSwitch />
          {onLogout ? (
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-white/80 hover:bg-white/10 hover:text-white">
              <LogOut data-icon="inline-start" className="rtl:-scale-x-100" />
              <span className="max-sm:sr-only">{logoutLabel}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
