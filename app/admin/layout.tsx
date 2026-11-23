import { requirePlatformAdminPage } from "@/lib/auth/session";
import { AppShell } from "@/components/shared/app-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePlatformAdminPage();
  return (
    <AppShell links={[{ href: "/admin", label: "Centres & passes" }]} who="Verity team">
      {children}
    </AppShell>
  );
}
