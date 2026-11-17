"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatDay, ratio, type UsageRow, type WeekMetrics } from "@koinonia/shared";
import { Card, ErrorState, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/** A number with a quiet bar behind it, so a column can be read at a glance. */
function Bar({ value, max, label }: { value: number; max: number; label?: string }) {
  return (
    <div className="relative min-w-24">
      <div className="absolute inset-y-0 left-0 rounded bg-primary/15" style={{ width: `${max === 0 ? 0 : Math.max(2, (value / max) * 100)}%` }} aria-hidden />
      <span className="relative px-1.5 tabular-nums">{label ?? value}</span>
    </div>
  );
}

function Weeks({ weeks }: { weeks: WeekMetrics[] }) {
  const maxSignups = Math.max(1, ...weeks.map((w) => w.signups));
  const maxActive = Math.max(1, ...weeks.map((w) => w.activeUsers));
  const cell = "px-3 py-2.5 align-top";
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead className="text-sm text-muted">
          <tr>
            <th className={cell}>Week of</th>
            <th className={cell}>Signed up</th>
            <th className={cell}>Added 3 people in week 1</th>
            <th className={cell}>Came back in week 1</th>
            <th className={cell}>Came back in week 4</th>
            <th className={cell}>Active that week</th>
          </tr>
        </thead>
        <tbody>
          {[...weeks].reverse().map((w) => (
            <tr key={w.weekStart} className="border-t border-border">
              <td className={`${cell} whitespace-nowrap font-semibold`}>{formatDay(w.weekStart, w.weekStart)}</td>
              <td className={cell}>
                <Bar value={w.signups} max={maxSignups} />
              </td>
              <td className={cell}>{ratio(w.activated, w.signups)}</td>
              <td className={cell}>{w.signups === 0 ? "–" : w.week1Known ? ratio(w.week1Retained, w.signups) : <span className="text-muted">too early{w.week1Retained ? ` (${w.week1Retained} so far)` : ""}</span>}</td>
              <td className={cell}>{w.signups === 0 ? "–" : w.week4Known ? ratio(w.week4Retained, w.signups) : <span className="text-muted">too early{w.week4Retained ? ` (${w.week4Retained} so far)` : ""}</span>}</td>
              <td className={cell}>
                <Bar value={w.activeUsers} max={maxActive} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Usage({ rows, empty }: { rows: UsageRow[]; empty: string }) {
  if (rows.length === 0) return <Card className="p-5 text-muted">{empty}</Card>;
  // One line per name, with web and app side by side.
  const names = [...new Set(rows.map((r) => r.name))];
  const total = (name: string) => rows.filter((r) => r.name === name).reduce((n, r) => n + r.count, 0);
  const on = (name: string, platform: string) => rows.find((r) => r.name === name && r.platform === platform)?.count ?? 0;
  names.sort((a, b) => total(b) - total(a));
  const max = Math.max(1, ...names.map(total));
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left">
        <thead className="text-sm text-muted">
          <tr>
            <th className="px-3 py-2.5"> </th>
            <th className="px-3 py-2.5">Times</th>
            <th className="px-3 py-2.5">Web</th>
            <th className="px-3 py-2.5">Phone app</th>
          </tr>
        </thead>
        <tbody>
          {names.map((name) => (
            <tr key={name} className="border-t border-border">
              <td className="px-3 py-2.5 font-semibold">{name}</td>
              <td className="px-3 py-2.5">
                <Bar value={total(name)} max={max} />
              </td>
              <td className="px-3 py-2.5 tabular-nums">{on(name, "web")}</td>
              <td className="px-3 py-2.5 tabular-nums">{on(name, "app")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Beta metrics: counts only. How to read them is in docs/METRICS.md. */
export default function MetricsPage() {
  const me = useUser();
  const isAdmin = me.role === "ADMIN";
  const { data, error, isPending, refetch } = useQuery({ queryKey: ["admin", "metrics"], queryFn: api.admin.metrics, enabled: isAdmin });

  if (!isAdmin) return <ErrorState error={new Error("This page is for admins.")} />;
  if (isPending) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const known4 = data.weeks.filter((w) => w.week4Known && w.signups > 0);
  const known1 = data.weeks.filter((w) => w.week1Known && w.signups > 0);
  const sum = (rows: WeekMetrics[], key: "signups" | "week1Retained" | "week4Retained") => rows.reduce((n, w) => n + w[key], 0);
  const tiles = [
    { label: "Accounts", value: String(data.totals.accounts), hint: "everyone who has signed up" },
    { label: "Activated", value: `${pct(data.totals.activated, data.totals.accounts)}%`, hint: `${data.totals.activated} added 3 people in their first week` },
    { label: "Back in week 1", value: known1.length ? `${pct(sum(known1, "week1Retained"), sum(known1, "signups"))}%` : "–", hint: known1.length ? `${sum(known1, "week1Retained")} of ${sum(known1, "signups")} who have had the chance` : "nobody has been here two weeks yet" },
    { label: "Back in week 4", value: known4.length ? `${pct(sum(known4, "week4Retained"), sum(known4, "signups"))}%` : "–", hint: known4.length ? `${sum(known4, "week4Retained")} of ${sum(known4, "signups")} who have had the chance` : "nobody has been here five weeks yet" },
    { label: "Active this week", value: String(data.weeks.at(-1)?.activeUsers ?? 0), hint: "logged a reach-out or a prayer" },
  ];

  return (
    <div className="space-y-10">
      <PageHeader title="Beta metrics" subtitle="Counts only: no names, notes or prayers are read to make this page." action={<Link href="/admin" className="font-semibold text-primary underline underline-offset-2">Back to Admin</Link>} />

      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <Card key={t.label} className="p-4">
              <p className="text-sm font-semibold text-muted">{t.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{t.value}</p>
              <p className="mt-1 text-sm text-muted">{t.hint}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Week by week</SectionTitle>
        <p className="mb-3 text-muted">Each row is the people who signed up that week, newest first. &ldquo;Came back&rdquo; means they logged a reach-out or a prayer.</p>
        <Weeks weeks={data.weeks} />
      </section>

      <section>
        <SectionTitle>What people do (last 30 days)</SectionTitle>
        <Usage rows={data.usage.filter((u) => u.kind === "action")} empty="Nothing yet. Actions are counted from now on." />
      </section>

      <section>
        <SectionTitle>Screens opened (last 30 days)</SectionTitle>
        <p className="mb-3 text-muted">&ldquo;:id&rdquo; stands for any person, note or prayer: the count never says which.</p>
        <Usage rows={data.usage.filter((u) => u.kind === "screen")} empty="Nothing yet. Screens are counted from now on." />
      </section>
    </div>
  );
}
