"use client";

import { Cake, Check, Flame, HandHeart, NotebookPen, Plus, Users } from "lucide-react";
import Link from "next/link";
import { formatDay, formatLongDay, relativeDay, type Home, type Note } from "@koinonia/shared";
import { ContactList } from "@/components/contacts";
import { DailyIntentionCard } from "@/components/prayer";
import { Avatar, Button, EmptyState, ErrorState, IconButton, SectionTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useAction, useHome } from "@/lib/hooks";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function StreakChip({ icon, value, label, done }: { icon: React.ReactNode; value: number; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
      <span className={done ? "text-[#E0B458]" : "text-on-hero-muted"}>{icon}</span>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-hero-muted">{label}</p>
      </div>
    </div>
  );
}

function Hero({ home }: { home: Home }) {
  const user = useUser();
  const dueCount = home.overdue.length + home.dueToday.length;
  return (
    <section className="hero-blue rounded-2xl p-5 text-on-hero shadow-lg sm:p-7">
      <p className="text-sm font-semibold text-on-hero-muted">{formatLongDay(home.today)}</p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
        {greeting()}, {user.name.split(" ")[0]}.
      </h1>
      <p className="mt-2 text-lg text-on-hero-muted">
        {dueCount === 0
          ? home.stats.contacts === 0
            ? "Add the people you want to stay close to."
            : "You're all caught up. Nobody is waiting on you today."
          : dueCount === 1
            ? "One person would love to hear from you today."
            : `${dueCount} people would love to hear from you today.`}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StreakChip icon={<Flame className="size-6" aria-hidden />} value={home.streaks.reachOut.current} label="day reach-out streak" done={home.streaks.reachOut.doneToday} />
        <StreakChip icon={<HandHeart className="size-6" aria-hidden />} value={home.streaks.prayer.current} label="day prayer streak" done={home.streaks.prayer.doneToday} />
        <Link href="/review" aria-label={`${home.stats.reachOutsThisWeek} reach-outs this week. Open your weekly review.`} className="col-span-2 flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 hover:bg-white/20 sm:col-span-1">
          <Check className="size-6 text-on-hero-muted" aria-hidden />
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none">{home.stats.reachOutsThisWeek}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-hero-muted">reach-outs this week · review →</p>
          </div>
        </Link>
      </div>
    </section>
  );
}

function FollowUp({ note, today }: { note: Note; today: string }) {
  const done = useAction(() => api.notes.update(note.id, { followUpDone: true }));
  const overdue = note.followUpDay! < today;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <NotebookPen className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{note.body}</p>
        <p className="mt-0.5 text-sm text-muted">
          <Link href={`/people/${note.contactId}`} className="font-semibold text-primary hover:underline">
            {note.contactName}
          </Link>{" "}
          · <span className={overdue ? "font-semibold text-danger" : ""}>{relativeDay(note.followUpDay!, today)}</span>
        </p>
      </div>
      <IconButton label={`Mark follow-up with ${note.contactName} done`} disabled={done.isPending} onClick={() => done.mutate(undefined)}>
        <Check className="size-5" />
      </IconButton>
    </li>
  );
}

export default function TodayPage() {
  const { data: home, error, isPending, refetch } = useHome();
  if (isPending) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const nothingDue = home.overdue.length + home.dueToday.length === 0;

  return (
    <div className="space-y-8">
      <Hero home={home} />

      {home.stats.contacts === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="Start with three people"
          body="Think of the people you'd regret drifting from. Add them, pick how often you want to be in touch, and Koinonia keeps count for you."
          action={
            <Link href="/people/new">
              <Button>
                <Plus className="size-4" aria-hidden /> Add your first person
              </Button>
            </Link>
          }
        />
      ) : null}

      {home.overdue.length > 0 ? (
        <section>
          <SectionTitle tone="danger" count={home.overdue.length}>Overdue</SectionTitle>
          <ContactList contacts={home.overdue} today={home.today} />
        </section>
      ) : null}

      {home.dueToday.length > 0 ? (
        <section>
          <SectionTitle tone="gold" count={home.dueToday.length}>Reach out today</SectionTitle>
          <ContactList contacts={home.dueToday} today={home.today} />
        </section>
      ) : null}

      {home.followUps.length > 0 ? (
        <section>
          <SectionTitle count={home.followUps.length}>Follow-ups from your notes</SectionTitle>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {home.followUps.map((n) => (
              <FollowUp key={n.id} note={n} today={home.today} />
            ))}
          </ul>
        </section>
      ) : null}

      <DailyIntentionCard prayer={home.prayer} compact />

      {home.birthdays.length > 0 ? (
        <section>
          <SectionTitle tone="gold">Birthdays coming up</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {home.birthdays.map(({ contact, day }) => (
              <li key={contact.id}>
                <Link href={`/people/${contact.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 hover:bg-surface-alt">
                  <Avatar name={contact.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{contact.name}</span>
                    <span className="text-sm text-muted">
                      {formatDay(day, home.today)} · {relativeDay(day, home.today)}
                    </span>
                  </span>
                  <Cake className="size-5 text-gold" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {home.upcoming.length > 0 ? (
        <section>
          <SectionTitle count={home.upcoming.length}>Coming up in the next two weeks</SectionTitle>
          <ContactList contacts={home.upcoming} today={home.today} />
        </section>
      ) : home.stats.contacts > 0 && nothingDue ? (
        <p className="text-center text-muted">Nothing else scheduled for the next two weeks.</p>
      ) : null}
    </div>
  );
}
