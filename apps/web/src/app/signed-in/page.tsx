"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { LAST_SIGN_IN_KEY, SIGN_IN_PROVIDERS, rememberSignIn, type SignInProvider } from "@koinonia/shared";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Where Google, Microsoft or Apple send people back: remember how they signed in, then go on. */
function SignedIn() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const method = params.get("method");
  const isNew = params.get("new") === "1";

  useEffect(() => {
    if (user === undefined) return; // still loading
    if (user === null) {
      router.replace("/login?signin_error=failed");
      return;
    }
    if ((SIGN_IN_PROVIDERS as readonly string[]).includes(method ?? "")) {
      try {
        window.localStorage.setItem(LAST_SIGN_IN_KEY, rememberSignIn(user, method as SignInProvider));
      } catch {
        /* storage unavailable */
      }
    }
    router.replace(isNew ? "/welcome" : "/");
  }, [user, method, isNew, router]);

  return <Spinner />;
}

export default function SignedInPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SignedIn />
    </Suspense>
  );
}
