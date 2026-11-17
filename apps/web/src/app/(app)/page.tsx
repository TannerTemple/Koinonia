"use client";

import { ArrowRight, Cake, Check, ChevronRight, Flame, HandHeart, MessagesSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { dailyWord, formatDay, formatLongDay, gettingStarted, greetingFor, prayerStreakLine, reachOutSummary, relativeDay, soFarLine, weekStreakLine, type Contact, type Home, type Note } from "@koinonia/shared";
import { ReachOutCard } from "@/components/contacts";
import { IntentionModal, PrayTodayCard } from "@/components/prayer";
import { Avatar, Button, Card, ErrorState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useAction, useHome } from "@/lib/hooks";

/** One or two encouraging lines under the greeting: what is going well, or what today would keep going. */
function StreakStrip({ home }: { home: Home }) {
  const lines = [prayerStreakLine(home.keep.prayerStreak), weekStreakLine(home.keep.reachOutWeeks)].filter((l): l is string => Boolean(l));
  if (lines.length === 0) return null;
  return (
    <div className="-mt-6 flex items-start gap-3 rounded-2xl bg-surface-alt px-4 py-3.5" aria-label="Your streaks">
      <Flame className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
      <div className="space-y-1">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

/** The quiet end of Today: a memory, a word for today, and what has been built up so far. */
function KeepGoing({ home }: { home: Home }) {
  const word = dailyWord(home.today);
  const memory = home.keep.memory;
  const soFar = soFarLine(home.keep.totals);
  return (
    <section className="space-y-4" aria-label="For today">
      {memory ? (
        <Link href={`/people/${memory.contactId}`} className="block rounded-2xl border border-border bg-surface p-5 hover:bg-surface-alt">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold">{memory.label}</p>
          <p className="mt-1 text-lg">
            You reached out to <span className="font-semibold">{memory.contactName}</span>.
          </p>
          {memory.summary ? <p className="mt-1 text-muted">&ldquo;{memory.summary}&rdquo;</p> : null}
          <p className="mt-2 font-semibold text-primary">How are they now?</p>
        </Link>
      ) : null}

      <figure className="rounded-2xl bg-surface-alt p-5">
        <figcaption className="text-sm font-semibold uppercase tracking-wide text-muted">A word for today</figcaption>
        <blockquote className="mt-2 font-serif text-xl leading-snug">&ldquo;{word.text}&rdquo;</blockquote>
        <p className="mt-1 text-sm text-muted">{word.reference}</p>
        <p className="mt-3 font-semibold">{word.nudge}</p>
      </figure>

      {soFar ? (
        <Link href="/review" className="flex items-center gap-3 rounded-2xl px-1 py-1 hover:underline">
          <span className="min-w-0 flex-1 text-muted">
            {soFar} <span className="font-semibold text-primary">See your week</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

/** A big, plain heading for one of the two things the app is for. */
function Heading({ icon, tone, title, summary }: { icon: React.ReactNode; tone: "primary" | "forest"; title: string; summary?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-3 text-3xl font-semibold">
        <span className={cn("flex size-10 items-center justify-center rounded-full", tone === "primary" ? "bg-primary-soft text-primary" : "bg-forest-soft text-forest")} aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {summary ? <p className="mt-1.5 text-lg text-muted">{summary}</p> : null}
    </div>
  );
}

const SmallLabel = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-sm font-bold text-muted" style={{ fontFamily: "var(--font-sans)" }}>{children}</h3>;

/** The first three things to do, ticking themselves off. */
function GettingStartedCard({ home, onAddPrayer }: { home: Home; onAddPrayer: () => void }) {
  const steps = gettingStarted(home);
  if (steps.finished) return null;
  const rows = [
    {
      done: steps.addedPerson,
      title: "Add someone you want to stay close to",
      hint: "Then choose how often you'd like to be reminded.",
      action: (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/people/new">
            <Button>Add a person</Button>
          </Link>
          <Link href="/people/import" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Or import from a contacts file
          </Link>
        </div>
      ),
    },
    {
      done: steps.addedPrayer,
      title: "Add something to pray for",
      hint: "For a person, or anything on your heart.",
      action: <Button onClick={onAddPrayer}>Add to prayer list</Button>,
    },
    {
      done: steps.reachedOut,
      title: "After you talk to someone, press “I reached out”",
      hint: "Koinonia starts counting again and reminds you next time.",
      action: null,
    },
  ];
  const next = rows.findIndex((r) => !r.done);
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-2xl font-semibold">Getting started</h2>
      <p className="mt-0.5 text-muted">{steps.done} of 3 done</p>
      <ol className="mt-4 space-y-4">
        {rows.map((row, i) => (
          <li key={row.title} className="flex gap-3.5">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                row.done ? "bg-forest text-on-primary" : i === next ? "border-2 border-primary text-primary" : "border-2 border-border text-muted",
              )}
              aria-hidden
            >
              {row.done ? <Check className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-lg font-semibold leading-snug", row.done && "text-muted line-through")}>
                <span className="sr-only">{row.done ? "Done: " : `Step ${i + 1}: `}</span>
                {row.title}
              </p>
              {!row.done ? <p className="mt-0.5 text-muted">{row.hint}</p> : null}
              {!row.done && i === next && row.action ? <div className="mt-3">{row.action}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function FollowUp({ note, today }: { note: Note; today: string }) {
  const done = useAction(() => api.notes.update(note.id, { followUpDone: true }));
  const late = note.followUpDay! < today;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <div className="min-w-0 flex-1 basis-64">
        <p className={cn("text-sm font-bold", late ? "text-danger" : "text-primary")}>
          <Link href={`/people/${note.contactId}`} className="underline-offset-2 hover:underline">
            {note.contactName}
          </Link>{" "}
          · {relativeDay(note.followUpDay!, today)}
        </p>
        <p className="mt-0.5 text-lg leading-snug">{note.body}</p>
      </div>
      <Button size="sm" variant="secondary" loading={done.isPending} onClick={() => done.mutate(undefined)} aria-label={`Mark follow-up with ${note.contactName} done`}>
        <Check className="size-4" aria-hidden /> Done
      </Button>
    </li>
  );
}

/** A person who isn't due yet: name and when. */
function NextRow({ contact, today }: { contact: Contact; today: string }) {
  return (
    <li>
      <Link href={`/people/${contact.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-surface-alt">
        <Avatar name={contact.name} size={40} />
        <span className="min-w-0 flex-1 truncate text-lg font-semibold">{contact.name}</span>
        <span className="shrink-0 text-muted">{contact.dueDay ? relativeDay(contact.dueDay, today) : ""}</span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

const listClass = "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface";

export default function TodayPage() {
  const user = useUser();
  const { data: home, error, isPending, refetch } = useHome();
  const [addingPrayer, setAddingPrayer] = useState(false);
  if (isPending) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const due = [...home.overdue, ...home.dueToday];
  const next = home.upcoming.length ? home.upcoming.slice(0, 5) : home.nextUp ? [home.nextUp] : [];
  const hasPeople = home.stats.contacts > 0;
  // Until the first prayer is added, the getting-started card is the only prompt for it.
  const hasPrayers = gettingStarted(home).addedPrayer;

  return (
    <div className="space-y-10">
      <header>
        <p className="font-semibold text-muted">{formatLongDay(home.today)}</p>
        <h1 className="mt-0.5 text-4xl font-semibold sm:text-5xl">
          {greetingFor(new Date().getHours())}, {user.name.split(" ")[0]}.
        </h1>
      </header>

      <StreakStrip home={home} />

      <GettingStartedCard home={home} onAddPrayer={() => setAddingPrayer(true)} />

      {/* ---- 1. Reach out ------------------------------------------------ */}
      {hasPeople ? (
        <section className="space-y-4" aria-label="Reach out">
          <Heading icon={<MessagesSquare className="size-5" />} tone="primary" title="Reach out" summary={reachOutSummary(due.length, home.stats.contacts)} />

          {due.length > 0 ? (
            <ul className="space-y-3">
              {due.map((p) => (
                <ReachOutCard key={p.id} contact={p} today={home.today} />
              ))}
            </ul>
          ) : null}

          {home.followUps.length > 0 ? (
            <div>
              <SmallLabel>Things you wanted to ask about</SmallLabel>
              <ul className={listClass}>
                {home.followUps.map((n) => (
                  <FollowUp key={n.id} note={n} today={home.today} />
                ))}
              </ul>
            </div>
          ) : null}

          {next.length > 0 ? (
            <div>
              <SmallLabel>{due.length ? "Coming up" : "Next up"}</SmallLabel>
              <ul className={listClass}>
                {next.map((p) => (
                  <NextRow key={p.id} contact={p} today={home.today} />
                ))}
              </ul>
            </div>
          ) : due.length === 0 ? (
            <p className="text-muted">Nobody has a reminder set. Open a person and choose how often you&rsquo;d like to reach out.</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href="/people/new">
              <Button variant="secondary">
                <Plus className="size-4" aria-hidden /> Add a person
              </Button>
            </Link>
            <Link href="/people">
              <Button variant="ghost">See everyone ({home.stats.contacts})</Button>
            </Link>
          </div>
        </section>
      ) : null}

      {/* ---- 2. Pray ----------------------------------------------------- */}
      {hasPrayers ? (
        <section className="space-y-4" aria-label="Pray">
          <Heading icon={<HandHeart className="size-5" />} tone="forest" title="Pray" />
          <PrayTodayCard prayer={home.prayer} onAdd={() => setAddingPrayer(true)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAddingPrayer(true)}>
              <Plus className="size-4" aria-hidden /> Add to prayer list
            </Button>
            <Link href="/prayer">
              <Button variant="ghost">See prayer list ({home.stats.activeIntentions})</Button>
            </Link>
          </div>
        </section>
      ) : null}

      {home.birthdays.length > 0 ? (
        <section>
          <SmallLabel>Birthdays coming up</SmallLabel>
          <ul className={listClass}>
            {home.birthdays.map(({ contact, day }) => (
              <li key={contact.id}>
                <Link href={`/people/${contact.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface-alt">
                  <Cake className="size-5 shrink-0 text-gold" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-lg font-semibold">{contact.name}</span>
                  <span className="shrink-0 text-muted">
                    {formatDay(day, home.today)} · {relativeDay(day, home.today)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <KeepGoing home={home} />

      <IntentionModal open={addingPrayer} onClose={() => setAddingPrayer(false)} />
    </div>
  );
}
