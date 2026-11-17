"use client";

import { BellRing, HandHeart, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BETA_DEVICES, BRAND, type BetaDevice } from "@koinonia/shared";
import { Logo } from "@/components/logo";
import { Button, Field, FormError, Input, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";

const DEVICE_LABELS: Record<BetaDevice, string> = { iphone: "iPhone", android: "Android", other: "Something else" };

const POINTS = [
  { icon: BellRing, title: "Reminds you to reach out", body: "Every week for Mom, every month for an old friend. You choose; it tells you when it's time." },
  { icon: NotebookPen, title: "Remembers for you", body: "The new job, the surgery, the kids' names. A note now, so you know what to ask next time." },
  { icon: HandHeart, title: "Keeps your prayer list", body: "Everyone you said you'd pray for, with one set apart each day." },
];

/** The public page: what the app is, and a short form to ask for a beta invite. */
export default function BetaPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [device, setDevice] = useState<BetaDevice>("iphone");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  return (
    <div className="min-h-dvh">
      <header className="hero-blue text-on-hero">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Logo size={34} />
              <span className="font-display text-2xl font-semibold">{BRAND.name}</span>
            </div>
            <Link href="/login" className="rounded-full border border-white/40 px-4 py-2 font-semibold hover:bg-white/10">
              Sign in
            </Link>
          </div>
          <div className="max-w-2xl py-12 sm:py-16">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-on-hero-muted">{BRAND.origin}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] sm:text-5xl">{BRAND.tagline}</h1>
            <p className="mt-5 text-lg text-on-hero-muted">{BRAND.description}</p>
            <a href="#invite" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-white px-6 text-lg font-semibold text-primary hover:brightness-95">
              Ask for an invite
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-5 py-12">
        <section aria-label="What it does" className="grid gap-6 sm:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6">
              <Icon className="size-7 text-primary" aria-hidden />
              <h2 className="mt-3 text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-muted">{body}</p>
            </div>
          ))}
        </section>

        <section className="max-w-2xl space-y-2 text-lg">
          <h2 className="text-2xl font-semibold">Free, simple, and private</h2>
          <p className="text-muted">
            {BRAND.name} is in beta: a small group is trying it and saying what works. It is free. What you write about the people you love stays yours; it is never sold or shown to anyone else, and you can export or delete all of it whenever you like.
          </p>
        </section>

        <section id="invite" className="max-w-xl scroll-mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          {done ? (
            <div role="status" className="space-y-3">
              <h2 className="text-2xl font-semibold">Thank you. You&rsquo;re on the list.</h2>
              <p className="text-muted">When a spot opens you&rsquo;ll get an email from Apple&rsquo;s TestFlight with a link to install the app. In the meantime you can use {BRAND.name} in your browser.</p>
              <Link href="/register" className="inline-block font-semibold text-primary underline underline-offset-2">
                Create an account on the web
              </Link>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setSending(true);
                setError(null);
                try {
                  await api.beta.signup({ email, name: name || undefined, device, consent: consent as true });
                  setDone(true);
                } catch (err) {
                  setError(err);
                } finally {
                  setSending(false);
                }
              }}
            >
              <div>
                <h2 className="text-2xl font-semibold">Try the iPhone app</h2>
                <p className="mt-1 text-muted">Leave your email and we&rsquo;ll send an invite through Apple&rsquo;s TestFlight.</p>
              </div>
              <Field label="Email" error={errors.email}>
                {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
              </Field>
              <Field label="First name (optional)" error={errors.name}>
                {(p) => <Input {...p} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
              </Field>
              <fieldset>
                <legend className="mb-1.5 block text-sm font-semibold">Your phone</legend>
                <div className="flex flex-wrap gap-2">
                  {BETA_DEVICES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={device === d}
                      onClick={() => setDevice(d)}
                      className={`min-h-11 rounded-full border px-4 font-semibold ${device === d ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-surface-alt"}`}
                    >
                      {DEVICE_LABELS[d]}
                    </button>
                  ))}
                </div>
                {device !== "iphone" ? <p className="mt-2 text-sm text-muted">The app is iPhone-only for now. Leave your email anyway and we&rsquo;ll tell you when that changes; the web version works on any phone today.</p> : null}
              </fieldset>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]" />
                <span>
                  You may email me about the {BRAND.name} beta. Nothing else, and I can ask to be removed at any time. See the{" "}
                  <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {errors.consent ? <p className="text-sm font-semibold text-danger">{errors.consent}</p> : null}
              <FormError error={error} />
              <Button type="submit" loading={sending} disabled={!email || !consent} className="w-full">
                Ask for an invite
              </Button>
            </form>
          )}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-5 px-5 py-6 text-sm text-muted">
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>
          <Link href="/register" className="underline underline-offset-2">
            Create an account
          </Link>
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline underline-offset-2">
            Terms of Use
          </Link>
        </div>
      </footer>
    </div>
  );
}
