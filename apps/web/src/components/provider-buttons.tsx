"use client";

import { SIGN_IN_PROVIDER_LABELS, type SignInProvider } from "@koinonia/shared";

/** The providers' own marks, drawn simply in one colour so they sit calmly on the page. */
function Mark({ provider }: { provider: SignInProvider }) {
  if (provider === "apple")
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
        <path d="M16.37 12.6c.02 2.4 2.1 3.2 2.13 3.21-.02.06-.33 1.14-1.1 2.26-.66.97-1.35 1.94-2.43 1.96-1.06.02-1.4-.63-2.62-.63-1.21 0-1.6.61-2.6.65-1.05.04-1.85-1.05-2.52-2.02-1.37-1.98-2.42-5.6-1.01-8.05.7-1.21 1.95-1.98 3.31-2 1.03-.02 2 .7 2.63.7.63 0 1.81-.86 3.05-.73.52.02 1.98.21 2.92 1.58-.08.05-1.74 1.02-1.72 3.04ZM14.36 5.34c.56-.68.94-1.62.83-2.56-.8.03-1.78.54-2.36 1.21-.52.6-.98 1.56-.85 2.48.9.07 1.82-.45 2.38-1.13Z" />
      </svg>
    );
  if (provider === "google")
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.35Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.07v2.58A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58Z" />
        <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.58C7.2 7.73 9.4 5.98 12 5.98Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

/**
 * "Continue with Apple / Google / Microsoft". A full-page link: the provider's page opens in
 * this tab and comes back to /signed-in. The one used last time on this browser is marked.
 */
export function ProviderButtons({ providers, startBase, lastUsed }: { providers: SignInProvider[]; startBase: string; lastUsed: string | null }) {
  if (providers.length === 0) return null;
  const tz = typeof Intl === "undefined" ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The one used last time goes first.
  const ordered = [...providers].sort((a, b) => Number(b === lastUsed) - Number(a === lastUsed));
  return (
    <div className="space-y-2.5">
      {ordered.map((p) => (
        <a
          key={p}
          href={`${startBase}/v1/auth/oauth/${p}/start?client=web&tz=${encodeURIComponent(tz)}`}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 font-semibold hover:bg-surface-alt"
        >
          <Mark provider={p} />
          <span>Continue with {SIGN_IN_PROVIDER_LABELS[p]}</span>
          {p === lastUsed ? <span className="rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-semibold text-muted">Used last time</span> : null}
        </a>
      ))}
    </div>
  );
}
