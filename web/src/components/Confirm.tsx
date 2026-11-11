"use client";
// A button that asks before doing something hard to undo (shadcn AlertDialog).
import * as React from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLang } from "@/lib/i18n";

const CANCEL = { ar: "تراجع", en: "Cancel", fr: "Annuler" };

export function Confirm({ children, title, body, action, onConfirm, destructive = true }: {
  children: React.ReactElement; title: string; body?: React.ReactNode; action: string;
  onConfirm: () => void | Promise<void>; destructive?: boolean;
}) {
  const { lang } = useLang();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {body ? <AlertDialogDescription>{body}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{CANCEL[lang]}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={() => onConfirm()}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
