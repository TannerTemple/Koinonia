/** Building blocks for the privacy policy and terms: plain, readable, no client code. */

export function LegalTitle({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <header className="space-y-3">
      <h1 className="text-4xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">
        Last updated: <Fill>{updated}</Fill>
      </p>
      <div className="space-y-3 text-lg leading-relaxed">{children}</div>
    </header>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 leading-relaxed">
      <h2 id={id} className="scroll-mt-6 text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Bullets({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6 marker:text-muted">{children}</ul>;
}

/** A fact from lib/legal.ts: highlighted while it is still a [PLACEHOLDER]. */
export function Fill({ children }: { children: string }) {
  return children.startsWith("[") ? <mark className="rounded bg-gold-soft px-1 font-semibold text-text">{children}</mark> : <>{children}</>;
}

/** Shows a mailto link for a real address, or the highlighted placeholder. */
export function Contact({ email }: { email: string }) {
  return email.includes("@") ? (
    <a href={`mailto:${email}`} className="font-semibold text-primary underline underline-offset-2">
      {email}
    </a>
  ) : (
    <Fill>{email}</Fill>
  );
}
