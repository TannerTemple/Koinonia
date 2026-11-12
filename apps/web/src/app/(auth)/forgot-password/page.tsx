"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, FormError, Input, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const errors = fieldErrors(error);

  if (sent) {
    return (
      <div className="space-y-5" role="status">
        <h2 className="text-3xl font-semibold">Check your email</h2>
        <p className="text-muted">
          If <strong className="text-text">{email}</strong> has a Koinonia account, a link to choose a new password is on its way. It works for one hour.
        </p>
        <p className="text-sm text-muted">Nothing after a few minutes? Check spam, or make sure it&rsquo;s the address you signed up with.</p>
        <Link href="/login" className="inline-block font-semibold text-primary underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          await api.auth.forgotPassword({ email });
          setSent(true);
        } catch (err) {
          setError(err);
        } finally {
          setLoading(false);
        }
      }}
    >
      <div>
        <h2 className="text-3xl font-semibold">Forgot your password?</h2>
        <p className="mt-1 text-muted">Enter your email and we&rsquo;ll send a link to choose a new one.</p>
      </div>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      </Field>
      <FormError error={error} />
      <Button type="submit" loading={loading} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
