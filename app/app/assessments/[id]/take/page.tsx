import type { Metadata } from "next";
import { requireStudentPage } from "@/lib/auth/session";
import { TakeScreen } from "@/components/student/take-screen";

export const metadata: Metadata = { title: "Test" };

export default async function TakePage({ params }: PageProps<"/app/assessments/[id]/take">) {
  await requireStudentPage();
  const { id } = await params;
  return <TakeScreen assessmentId={id} />;
}
