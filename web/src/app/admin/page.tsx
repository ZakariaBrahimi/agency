import { LangProvider } from "@/lib/i18n";
import { AdminApp } from "@/components/admin/AdminApp";
import { Toaster } from "@/components/ui/sonner";

export const metadata = { title: "لوحة الإدارة | نواة" };

// Nawa's own dashboard: Arabic only.
export default function AdminPage() {
  return (
    <LangProvider fixed="ar">
      <AdminApp />
      <Toaster theme="light" position="bottom-center" richColors />
    </LangProvider>
  );
}
