import { requireStudentPage } from "@/lib/auth/session";
import { AppShell } from "@/components/shared/app-shell";

export default async function StudentLayout({ children }: LayoutProps<"/app">) {
  const { student } = await requireStudentPage();
  return (
    <AppShell links={[{ href: "/app", label: "My tests" }, { href: "/app/pass", label: "My pass" }]} who={student.full_name}>
      {children}
    </AppShell>
  );
}
