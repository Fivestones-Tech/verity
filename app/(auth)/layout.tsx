import { Wordmark } from "@/components/ui/wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <div className="mb-8">
        <Wordmark />
      </div>
      {children}
      <footer className="mt-auto pt-10 text-xs text-lo">© Lumio. Verity is a Lumio product.</footer>
    </main>
  );
}
