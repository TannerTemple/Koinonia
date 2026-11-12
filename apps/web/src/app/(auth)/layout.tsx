"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hero-blue flex flex-col justify-between gap-10 p-8 text-on-hero lg:p-14">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-display text-2xl font-semibold">Koinonia</span>
        </div>
        <div className="max-w-md">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-on-hero-muted">κοινωνία · communion, fellowship</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] lg:text-5xl">Stay close to the people you mean to stay close to.</h1>
          <ul className="mt-8 space-y-3 text-on-hero-muted">
            <li><strong className="text-on-hero">Reminders on your rhythm.</strong> Every 3 days for Mom, every month for an old friend.</li>
            <li><strong className="text-on-hero">Notes that remember for you.</strong> The new job, the kids&rsquo; names, what to ask next time.</li>
            <li><strong className="text-on-hero">A place for prayer.</strong> Everyone you said you&rsquo;d pray for, and one intention set apart each day.</li>
          </ul>
        </div>
        <p className="text-sm text-on-hero-muted">&ldquo;They devoted themselves to the apostles&rsquo; teaching and fellowship.&rdquo; Acts 2:42</p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
