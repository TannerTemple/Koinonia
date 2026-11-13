"use client";

import { HandHeart, Home, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/people", label: "People", icon: Users },
  { href: "/prayer", label: "Prayer", icon: HandHeart },
  { href: "/settings", label: "Settings", icon: Settings },
];

function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <p className="min-w-0 flex-1">
        <strong>Confirm your email.</strong>{" "}
        <span className="text-muted">
          {state === "sent" ? `A new link is on its way to ${email}.` : state === "failed" ? "Couldn't send it just now. Try again in a minute." : `We sent a link to ${email}. It lets you reset your password if you ever forget it.`}
        </span>
      </p>
      <button
        type="button"
        disabled={state === "sending" || state === "sent"}
        className="min-h-11 rounded-lg px-3 font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
        onClick={() => {
          setState("sending");
          api.auth.resendVerification().then(() => setState("sent"), () => setState("failed"));
        }}
      >
        {state === "sent" ? "Sent" : "Resend link"}
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  if (!user) return <Spinner />;

  const items = user.role === "ADMIN" ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Desktop: sidebar */}
      <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="font-display text-xl font-semibold">Koinonia</span>
        </Link>
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 font-semibold transition-colors",
                  isActive(href) ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-surface-alt hover:text-text",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-auto truncate px-2 text-sm text-muted">Signed in as {user.name}</p>
      </nav>

      <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-3xl">
          {user.emailVerified ? null : <VerifyEmailBanner email={user.email} />}
          {children}
        </div>
      </main>

      {/* Phone: bottom tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="flex">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold", isActive(href) ? "text-primary" : "text-muted")}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
