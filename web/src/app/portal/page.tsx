import { LangProvider } from "@/lib/i18n";
import { PortalApp } from "@/components/portal/PortalApp";
import { Toaster } from "@/components/ui/sonner";

export const metadata = { title: "مساحة العميل | نواة" };

export default function PortalPage() {
  return (
    <LangProvider>
      <PortalApp />
      <Toaster theme="light" position="bottom-center" richColors />
    </LangProvider>
  );
}
