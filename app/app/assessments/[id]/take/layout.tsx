/** Full-screen taking view: no site navigation (docs/16). */
export default function TakeLayout({ children }: LayoutProps<"/app/assessments/[id]/take">) {
  return <div className="fixed inset-0 z-30 overflow-y-auto bg-paper">{children}</div>;
}
