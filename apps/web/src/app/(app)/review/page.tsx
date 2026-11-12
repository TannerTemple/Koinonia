"use client";

import { ArrowDown, ArrowUp, Flame, HandHeart, Minus } from "lucide-react";
import Link from "next/link";
import { compareWeeks, formatDay, weekHeadline, weekdayName, type Streak, type WeekSummary } from "@koinonia/shared";
import { Avatar, Card, ErrorState, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { useWeeklyReview } from "@/lib/hooks";

function Compare({ label, now, before }: { label: string; now: number; before: number }) {
  const { direction, label: text } = compareWeeks(now, before);
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 font-display text-5xl font-semibold tabular-nums leading-none">{now}</p>
      <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${direction === "up" ? "text-forest" : "text-muted"}`}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {text} ({before})
      </p>
    </Card>
  );
}

/** Seven small columns: reach-outs and prayers for each day of the week. */
function DayStrip({ week, today }: { week: WeekSummary; today: string }) {
  const max = Math.max(1, ...week.days.flatMap((d) => [d.reachOuts, d.prayers]));
  return (
    <Card className="p-5">
      <ul className="grid grid-cols-7 gap-2">
        {week.days.map((d) => (
          <li key={d.day} className="flex flex-col items-center gap-2" aria-label={`${weekdayName(d.day)}, ${formatDay(d.day, today)}: ${d.reachOuts} reach-outs, ${d.prayers} prayers`}>
            <div className="flex h-24 w-full items-end justify-center gap-1" aria-hidden>
              <div className="w-3 rounded-t bg-primary" style={{ height: `${(d.reachOuts / max) * 100}%`, minHeight: d.reachOuts ? 6 : 0 }} />
              <div className="w-3 rounded-t bg-forest" style={{ height: `${(d.prayers / max) * 100}%`, minHeight: d.prayers ? 6 : 0 }} />
            </div>
            <span className={`text-xs font-semibold ${d.day === today ? "text-primary" : "text-muted"}`} aria-hidden>
              {d.day === today ? "Today" : weekdayName(d.day).slice(0, 3)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-primary" aria-hidden /> Reach-outs · {week.daysReachedOut} of 7 days</span>
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-forest" aria-hidden /> Prayers · {week.daysPrayed} of 7 days</span>
      </p>
    </Card>
  );
}

function StreakCard({ icon, label, streak }: { icon: React.ReactNode; label: string; streak: Streak }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="text-gold">{icon}</span>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">
          {streak.current} <span className="text-base font-semibold text-muted">day{streak.current === 1 ? "" : "s"}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {label} · best {streak.longest}
          {streak.current > 0 && !streak.doneToday ? " · keep it going today" : ""}
        </p>
      </div>
    </Card>
  );
}

export default function WeeklyReviewPage() {
  const { data, error, isPending, refetch } = useWeeklyReview();
  if (isPending) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { thisWeek, lastWeek, streaks, today } = data;

  return (
    <>
      <PageHeader title="Your week" subtitle={`${formatDay(thisWeek.startDay, today)} to ${formatDay(thisWeek.endDay, today)}, next to the seven days before`} />
      <p className="mb-6 font-display text-2xl leading-snug">{weekHeadline(thisWeek.peopleReached, thisWeek.prayers)}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Compare label="People reached" now={thisWeek.peopleReached} before={lastWeek.peopleReached} />
        <Compare label="Reach-outs" now={thisWeek.reachOuts} before={lastWeek.reachOuts} />
        <Compare label="Prayers said" now={thisWeek.prayers} before={lastWeek.prayers} />
      </div>

      <section className="mt-8">
        <SectionTitle>Day by day</SectionTitle>
        <DayStrip week={thisWeek} today={today} />
      </section>

      <section className="mt-8">
        <SectionTitle tone="gold">Streaks</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <StreakCard icon={<Flame className="size-8" aria-hidden />} label="Reach-out streak" streak={streaks.reachOut} />
          <StreakCard icon={<HandHeart className="size-8" aria-hidden />} label="Prayer streak" streak={streaks.prayer} />
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle count={thisWeek.people.length}>Who you reached</SectionTitle>
        {thisWeek.people.length ? (
          <Card className="divide-y divide-border">
            {thisWeek.people.map((p) => (
              <Link key={p.id} href={`/people/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-alt">
                <Avatar name={p.name} size={36} />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <span className="text-sm tabular-nums text-muted">{p.reachOuts === 1 ? "once" : `${p.reachOuts} times`}</span>
              </Link>
            ))}
          </Card>
        ) : (
          <p className="text-muted">
            Nobody yet this week. <Link href="/" className="font-semibold text-primary underline-offset-2 hover:underline">See who&rsquo;s due</Link>.
          </p>
        )}
      </section>
    </>
  );
}
