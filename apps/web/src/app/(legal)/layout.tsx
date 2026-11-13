import Link from "next/link";
import { Logo } from "@/components/logo";
import { LEGAL_DRAFT } from "@/lib/legal";

/** Public pages: readable signed in or out, no app chrome. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Koinonia home">
            <Logo size={30} />
            <span className="font-display text-xl font-semibold">Koinonia</span>
          </Link>
          <nav aria-label="Legal" className="flex gap-5 text-sm font-semibold text-primary">
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="underline-offset-2 hover:underline">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        {LEGAL_DRAFT ? (
          <p role="note" className="mb-8 rounded-xl border border-gold bg-gold-soft px-4 py-3 text-sm text-text">
            <strong>Draft.</strong> This page has not been reviewed by a lawyer and is not yet in effect. Items in [BRACKETS] still need to be filled in.
          </p>
        ) : null}
        <article className="legal space-y-8">{children}</article>
      </main>
    </div>
  );
}
