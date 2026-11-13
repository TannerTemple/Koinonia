/** Building blocks for the privacy policy and terms: plain, readable, no client code. */

export function LegalTitle({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <header className="space-y-3">
      <h1 className="text-4xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">Last updated: {updated}</p>
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

/** Shows a mailto link for a real address, or the placeholder as plain text. */
export function Contact({ email }: { email: string }) {
  return email.includes("@") ? (
    <a href={`mailto:${email}`} className="font-semibold text-primary underline underline-offset-2">
      {email}
    </a>
  ) : (
    <strong>{email}</strong>
  );
}
