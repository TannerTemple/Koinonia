"use client";

import { Check, HandHeart, MessagesSquare, NotebookPen, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CADENCE_PRESETS, cadenceLabel } from "@koinonia/shared";
import { Logo } from "@/components/logo";
import { Button, Card, Field, FormError, Input, Select, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useAction, useContacts, useIntentions } from "@/lib/hooks";

/** The rhythms most people want; the full list is on the person's own form. */
const QUICK_RHYTHMS = CADENCE_PRESETS.filter((p) => [7, 14, 28, 90].includes(p.days));
const STEPS = ["welcome", "people", "prayer", "done"] as const;

function Dots({ index }: { index: number }) {
  return (
    <div className="flex justify-center gap-1.5" role="img" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <span key={s} className={cn("h-2 rounded-full transition-all", i === index ? "w-6" : "w-2", i <= index ? "bg-primary" : "bg-border")} />
      ))}
    </div>
  );
}

function Point({ icon, tone, title, body }: { icon: React.ReactNode; tone: string; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone)} aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span className="block text-muted">{body}</span>
      </span>
    </li>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <header>
      <h1 className="text-4xl font-semibold leading-tight">{title}</h1>
      <p className="mt-2 text-lg text-muted">{body}</p>
    </header>
  );
}

/** Add a few people right here: a name and how often. */
function AddPeople() {
  const people = useContacts();
  const [name, setName] = useState("");
  const [days, setDays] = useState(14);
  const add = useAction(() => api.contacts.create({ name, cadenceDays: days }));
  const added = people.data ?? [];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, { onSuccess: () => setName("") });
          }}
        >
          <Field label="Their name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Mom, Uncle Joe, Maria…" autoFocus />}</Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Remind me to reach out</legend>
            <div className="flex flex-wrap gap-2">
              {QUICK_RHYTHMS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  aria-pressed={days === p.days}
                  onClick={() => setDays(p.days)}
                  className={cn("h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors", days === p.days ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-surface-alt")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
          <FormError error={add.error} />
          <Button type="submit" disabled={!name.trim()} loading={add.isPending}>
            <Plus className="size-4" aria-hidden /> {name.trim() ? `Add ${name.trim().split(" ")[0]}` : "Add"}
          </Button>
        </form>
      </Card>

      {added.length > 0 ? (
        <div aria-live="polite">
          <p className="mb-2 text-sm font-bold text-muted">{added.length === 1 ? "1 person added" : `${added.length} people added`}</p>
          <ul className="space-y-1.5">
            {added.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Check className="size-5 shrink-0 text-forest" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-lg font-medium">{p.name}</span>
                <span className="shrink-0 text-muted">{cadenceLabel(p.cadenceDays).toLowerCase()}</span>
              </li>
            ))}
          </ul>
          {added.length > 8 ? <p className="mt-1.5 text-muted">and {added.length - 8} more</p> : null}
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Have your contacts in a file?{" "}
        <Link href="/people/import" className="font-semibold text-primary underline-offset-2 hover:underline">
          Import a contacts file
        </Link>
      </p>
    </div>
  );
}

/** One optional prayer, for one of the people just added or for anything. */
function AddPrayer() {
  const people = useContacts();
  const prayers = useIntentions("ACTIVE");
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const add = useAction(() => api.intentions.create({ title, contactId: contactId || null }));
  const added = prayers.data ?? [];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, { onSuccess: () => setTitle("") });
          }}
        >
          <Field label="What do you want to pray for?">{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Mom's surgery on Friday" autoFocus />}</Field>
          {people.data?.length ? (
            <Field label="Is it for someone?">
              {(p) => (
                <Select {...p} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">No one in particular</option>
                  {people.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <FormError error={add.error} />
          <Button type="submit" variant="forest" disabled={!title.trim()} loading={add.isPending}>
            <Plus className="size-4" aria-hidden /> Add to prayer list
          </Button>
        </form>
      </Card>
      {added.length > 0 ? (
        <ul className="space-y-1.5" aria-live="polite">
          {added.slice(0, 6).map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <Check className="size-5 shrink-0 text-forest" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-lg font-medium">{i.title}</span>
              {i.contactName ? <span className="shrink-0 text-muted">for {i.contactName}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function WelcomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const people = useContacts();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);
  if (!user) return <Spinner />;

  const step = STEPS[index]!;
  const count = people.data?.length ?? 0;
  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const finish = () => router.replace("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-8 px-5 py-8 sm:py-12">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-display text-xl font-semibold">Koinonia</span>
        </span>
        {step !== "done" ? (
          <button type="button" onClick={finish} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-muted underline-offset-2 hover:underline">
            Skip
          </button>
        ) : null}
      </div>
      <Dots index={index} />

      {step === "welcome" ? (
        <>
          <Heading title={`Welcome, ${user.name.split(" ")[0]}.`} body="Koinonia helps you stay close to the people you care about. It does three things." />
          <ul className="space-y-5">
            <Point icon={<MessagesSquare className="size-5" />} tone="bg-primary-soft text-primary" title="Reminds you to reach out" body="You choose how often for each person. Koinonia tells you when it's time." />
            <Point icon={<NotebookPen className="size-5" />} tone="bg-gold-soft text-gold" title="Remembers for you" body="Keep a note on what to ask next time: the new job, the surgery, the kids' names." />
            <Point icon={<HandHeart className="size-5" />} tone="bg-forest-soft text-forest" title="Keeps your prayer list" body="Everyone you said you'd pray for, with one set apart each day." />
          </ul>
          <div>
            <Button onClick={next}>Get started</Button>
          </div>
        </>
      ) : null}

      {step === "people" ? (
        <>
          <Heading title="Who do you want to stay close to?" body="Start with two or three people. You can add more any time." />
          <AddPeople />
          <div>
            <Button variant={count ? "primary" : "secondary"} onClick={next}>
              {count ? "Continue" : "Skip for now"}
            </Button>
          </div>
        </>
      ) : null}

      {step === "prayer" ? (
        <>
          <Heading title="Anything you want to pray for?" body="Add one thing now if you like. Each day Koinonia sets one apart for you." />
          <AddPrayer />
          <div>
            <Button onClick={next}>Continue</Button>
          </div>
        </>
      ) : null}

      {step === "done" ? (
        <>
          <Heading
            title="You're all set."
            body={count ? "Today shows who to reach out to. After you talk to someone, press “I reached out” and Koinonia starts counting again." : "Add your first person from Today whenever you're ready."}
          />
          <p className="text-muted">Want reminders on your phone? The Koinonia iPhone app sends one on the day someone is due. On the web, turn on the daily email in Settings.</p>
          <div>
            <Button onClick={finish}>Go to Today</Button>
          </div>
        </>
      ) : null}
    </main>
  );
}
