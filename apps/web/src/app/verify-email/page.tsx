"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { Spinner, errorMessage } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function VerifyEmailPage() {
  const { setUser } = useAuth();
  const [state, setState] = useState<"working" | "done" | { error: string }>("working");
  const started = useRef(false);

  useEffect(() => {
    // The link works once, so make sure it is only spent once.
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState({ error: "This link isn't complete. Open it from your email again." });
      return;
    }
    api.auth.verifyEmail({ token }).then(
      () => {
        setState("done");
        void api.me.get().then(setUser, () => undefined);
      },
      (err) => setState({ error: errorMessage(err) }),
    );
  }, [setUser]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="flex justify-center">
          <Logo size={44} />
        </div>
        {state === "working" ? (
          <Spinner label="Confirming your email" />
        ) : state === "done" ? (
          <div role="status" className="space-y-2">
            <h1 className="text-3xl font-semibold">Email confirmed</h1>
            <p className="text-muted">Thank you. You&rsquo;re all set.</p>
          </div>
        ) : (
          <div role="alert" className="space-y-2">
            <h1 className="text-3xl font-semibold">That didn&rsquo;t work</h1>
            <p className="text-muted">{state.error}</p>
            <p className="text-sm text-muted">You can send yourself a new link from Settings.</p>
          </div>
        )}
        <Link href="/" className="inline-block font-semibold text-primary underline-offset-2 hover:underline">
          Go to Koinonia
        </Link>
      </div>
    </main>
  );
}
