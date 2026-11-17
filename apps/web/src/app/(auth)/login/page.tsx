"use client";

import { BRAND } from "@koinonia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LAST_SIGN_IN_KEY, maskEmail, readLastSignIn, signInErrorMessage, type LastSignIn, type PublicConfig } from "@koinonia/shared";
import { ProviderButtons } from "@/components/provider-buttons";
import { Button, Field, FormError, Input, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const errors = fieldErrors(error);
  // Who signed in on this browser last time, and how, so coming back is one tap or one field.
  const [last, setLast] = useState<LastSignIn | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [outsideError, setOutsideError] = useState<string | null>(null);
  useEffect(() => {
    let found: LastSignIn | null = null;
    try {
      found = readLastSignIn(window.localStorage.getItem(LAST_SIGN_IN_KEY));
    } catch {
      /* storage unavailable */
    }
    // Coming back from Google, Microsoft or Apple without success.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error") ?? params.get("signin_error");
    if (code) setOutsideError(signInErrorMessage(code, params.get("method")));

    let cancelled = false;
    void api
      .config()
      .catch(() => null)
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        // The person running the service can switch the memory off (FEATURES_OFF=lastSignIn).
        if (!found || c?.features.lastSignIn === false) return;
        const remembered = found;
        setLast(remembered);
        if (remembered.method === "email") setEmail((current) => current || remembered.email);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const forget = () => {
    try {
      window.localStorage.removeItem(LAST_SIGN_IN_KEY);
    } catch {
      /* storage unavailable */
    }
    setLast(null);
    setEmail("");
  };

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          signIn(await api.auth.login({ email, password }));
        } catch (err) {
          setError(err);
          setLoading(false);
        }
      }}
    >
      <div>
        <h2 className="text-3xl font-semibold">{last?.firstName ? `Welcome back, ${last.firstName}` : "Welcome back"}</h2>
        {last && last.method === "email" ? (
          <p className="mt-1 text-muted">
            <span className="mr-2 rounded-full bg-surface-alt px-2.5 py-0.5 text-sm font-semibold">Used last time</span>
            {maskEmail(last.email)}{" "}
            <button type="button" onClick={forget} className="font-semibold text-primary underline-offset-2 hover:underline">
              Not you?
            </button>
          </p>
        ) : (
          <p className="mt-1 text-muted">Sign in to see who&rsquo;s due for a hello.</p>
        )}
      </div>
      {outsideError ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
          {outsideError}
        </p>
      ) : null}
      {config && config.signIn.providers.length > 0 ? (
        <>
          <ProviderButtons providers={config.signIn.providers} startBase={config.signIn.startBase} lastUsed={last?.method ?? null} />
          <p className="flex items-center gap-3 text-sm text-muted" aria-hidden>
            <span className="h-px flex-1 bg-border" /> or with your email <span className="h-px flex-1 bg-border" />
          </p>
        </>
      ) : null}
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      </Field>
      <Field label="Password" error={errors.password}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus={last?.method === "email"} key={last?.method === "email" ? "known" : "new"} />}
      </Field>
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="font-semibold text-primary underline-offset-2 hover:underline">
          Forgot password?
        </Link>
      </p>
      <FormError error={error} />
      <Button type="submit" loading={loading} className="w-full">
        Sign in
      </Button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-semibold text-primary underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/beta" className="font-semibold text-primary underline-offset-2 hover:underline">
          What is {BRAND.name}?
        </Link>
      </p>
    </form>
  );
}
