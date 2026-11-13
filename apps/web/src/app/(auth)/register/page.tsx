"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, FormError, Input, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const errors = fieldErrors(error);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          signIn(await api.auth.register({ ...form, timezone }));
        } catch (err) {
          setError(err);
          setLoading(false);
        }
      }}
    >
      <div>
        <h2 className="text-3xl font-semibold">Create your account</h2>
        <p className="mt-1 text-muted">Free. Takes a minute.</p>
      </div>
      <Field label="Your name" error={errors.name}>
        {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={set("name")} required maxLength={80} />}
      </Field>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={form.email} onChange={set("email")} required />}
      </Field>
      <Field label="Phone" hint="Optional. Lets friends find you by number." error={errors.phone}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />}
      </Field>
      <Field label="Password" hint="At least 8 characters." error={errors.password}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required minLength={8} />}
      </Field>
      <FormError error={error} />
      <Button type="submit" loading={loading} className="w-full">
        Create account
      </Button>
      <p className="text-center text-xs text-muted">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="font-semibold underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="text-center text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
