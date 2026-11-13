"use client";

import Link from "next/link";
import { useState } from "react";
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
        <h2 className="text-3xl font-semibold">Welcome back</h2>
        <p className="mt-1 text-muted">Sign in to see who&rsquo;s due for a hello.</p>
      </div>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      </Field>
      <Field label="Password" error={errors.password}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
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
    </form>
  );
}
