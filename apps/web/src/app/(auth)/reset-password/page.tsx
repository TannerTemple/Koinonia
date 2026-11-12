"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Field, FormError, Input, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const errors = fieldErrors(error);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  if (done) {
    return (
      <div className="space-y-5" role="status">
        <h2 className="text-3xl font-semibold">Password changed</h2>
        <p className="text-muted">You&rsquo;ve been signed out everywhere. Sign in with your new password.</p>
        <Link href="/login" className="inline-block font-semibold text-primary underline-offset-2 hover:underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (token === "") {
    return (
      <div className="space-y-5">
        <h2 className="text-3xl font-semibold">This link isn&rsquo;t complete</h2>
        <p className="text-muted">Open the link from your email again, or ask for a new one.</p>
        <Link href="/forgot-password" className="inline-block font-semibold text-primary underline-offset-2 hover:underline">
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
          await api.auth.resetPassword({ token, password });
          setDone(true);
        } catch (err) {
          setError(err);
        } finally {
          setLoading(false);
        }
      }}
    >
      <div>
        <h2 className="text-3xl font-semibold">Choose a new password</h2>
        <p className="mt-1 text-muted">At least 8 characters. You&rsquo;ll be signed out on every device.</p>
      </div>
      <Field label="New password" error={errors.password}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />}
      </Field>
      <FormError error={error} />
      {errors.token ? (
        <Link href="/forgot-password" className="inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline">
          Send a new link
        </Link>
      ) : null}
      <Button type="submit" loading={loading} disabled={token === null} className="w-full">
        Save new password
      </Button>
    </form>
  );
}
