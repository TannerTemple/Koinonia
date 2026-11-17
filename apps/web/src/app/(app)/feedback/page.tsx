"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAND, FEEDBACK_KINDS, FEEDBACK_KIND_LABELS, type FeedbackKind } from "@koinonia/shared";
import { Button, Card, Field, FormError, PageHeader, Textarea, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { APP_VERSION } from "@/lib/version";

const PROMPTS: Record<FeedbackKind, string> = {
  PROBLEM: "What were you trying to do, and what happened instead?",
  IDEA: `What would make ${BRAND.name} better for you?`,
  OTHER: "What's on your mind?",
};

/** "Send feedback / report a problem": one box, one button. */
export default function FeedbackPage() {
  const [kind, setKind] = useState<FeedbackKind>("PROBLEM");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errors = fieldErrors(error);

  if (sent) {
    return (
      <>
        <PageHeader title="Thank you" />
        <Card className="space-y-4 p-6">
          <p className="text-lg">Your message was sent. It really does help.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="font-semibold text-primary underline underline-offset-2">
              Back to Today
            </Link>
            <button
              type="button"
              className="font-semibold text-muted underline underline-offset-2"
              onClick={() => {
                setSent(false);
                setMessage("");
              }}
            >
              Send another
            </button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Send feedback" subtitle="Found a problem, or have an idea? Tell us in your own words." />
      <Card className="p-6">
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setSending(true);
            setError(null);
            try {
              await api.feedback.send({ kind, message, appVersion: APP_VERSION, platform: "web" });
              setSent(true);
            } catch (err) {
              setError(err);
            } finally {
              setSending(false);
            }
          }}
        >
          <fieldset>
            <legend className="mb-1.5 block text-sm font-semibold">What is it about?</legend>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`min-h-11 rounded-full border px-4 text-base font-semibold ${kind === k ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-surface-alt"}`}
                >
                  {FEEDBACK_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Your message" hint={PROMPTS[kind]} error={errors.message}>
            {(p) => <Textarea {...p} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={7} autoFocus />}
          </Field>
          <FormError error={error} />
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" loading={sending} disabled={message.trim().length < 3}>
              Send
            </Button>
            <p className="text-sm text-muted">Sent with your name, email and the app version ({APP_VERSION}), so we can reply and find the problem.</p>
          </div>
        </form>
      </Card>
    </>
  );
}
