"use client";

import { HandHeart, Plus } from "lucide-react";
import { useState } from "react";
import { type Intention } from "@koinonia/shared";
import { DailyIntentionCard, IntentionList, IntentionModal } from "@/components/prayer";
import { Button, EmptyState, ErrorState, Modal, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAction, useIntentions, usePrayerToday } from "@/lib/hooks";

type Tab = "ACTIVE" | "ANSWERED" | "ARCHIVED";
const TABS: { key: Tab; label: string }[] = [
  { key: "ACTIVE", label: "Praying" },
  { key: "ANSWERED", label: "Answered" },
  { key: "ARCHIVED", label: "Archived" },
];

function ChooseModal({ open, onClose, intentions, currentId }: { open: boolean; onClose: () => void; intentions: Intention[]; currentId?: string }) {
  const choose = useAction((id: string) => api.prayer.setToday(id));
  return (
    <Modal open={open} onClose={onClose} title="Which one do you want to pray for today?">
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
        {intentions.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              disabled={choose.isPending}
              aria-pressed={i.id === currentId}
              onClick={() => choose.mutate(i.id, { onSuccess: onClose })}
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                i.id === currentId ? "border-forest bg-forest-soft" : "border-border hover:bg-surface-alt",
              )}
            >
              <span className="block font-semibold">{i.title}</span>
              {i.contactName ? <span className="text-sm text-muted">for {i.contactName}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default function PrayerPage() {
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const today = usePrayerToday();
  const intentions = useIntentions();

  const error = today.error ?? intentions.error;
  if (error) return <ErrorState error={error} onRetry={() => { void today.refetch(); void intentions.refetch(); }} />;
  if (!today.data || !intentions.data) return <Spinner />;

  const all = intentions.data;
  const active = all.filter((i) => i.status === "ACTIVE");
  const shown = all.filter((i) => i.status === tab);
  // Grouped by whether the prayer is for a person, which is how people think of their list.
  const promised = shown.filter((i) => i.contactId !== null);
  const others = shown.filter((i) => i.contactId === null);
  const prayedToday = active.filter((i) => i.prayedToday).length;
  const day = today.data.day;
  const todayId = today.data.intention?.id;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Prayer list"
        subtitle={active.length ? `${prayedToday} of ${active.length} prayed for today` : "The people and things you want to pray for"}
        action={
          <Button variant="forest" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add to prayer list
          </Button>
        }
      />

      {/* With nothing on the list, the empty state below says it once. */}
      {active.length > 0 ? <DailyIntentionCard prayer={today.data} onChoose={active.length > 1 ? () => setChoosing(true) : undefined} /> : null}

      <div>
        <div className="mb-5 flex gap-2" role="group" aria-label="Filter the prayer list">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                tab === t.key ? "border-forest bg-forest text-on-primary" : "border-border bg-surface hover:bg-surface-alt",
              )}
            >
              {t.label} <span className="tabular-nums opacity-75">{all.filter((i) => i.status === t.key).length}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          tab === "ACTIVE" ? (
            <EmptyState
              icon={<HandHeart className="size-6" />}
              title="“I'll pray for you.”"
              body="Easy to say, easy to forget. Write down who and what you want to pray for, and it will be waiting here."
              action={
                <Button variant="forest" onClick={() => setAdding(true)}>
                  Add to prayer list
                </Button>
              }
            />
          ) : (
            <EmptyState title={tab === "ANSWERED" ? "No answered prayers yet" : "Nothing archived"} body={tab === "ANSWERED" ? "When a prayer is answered, mark it and it will be kept here to look back on with gratitude." : "Archived intentions rest here."} />
          )
        ) : (
          <div className="space-y-6">
            {promised.length ? (
              <section>
                <SectionTitle tone="forest" count={promised.length}>For people</SectionTitle>
                <IntentionList intentions={promised} today={day} todayId={todayId} />
              </section>
            ) : null}
            {others.length ? (
              <section>
                <SectionTitle tone="forest" count={others.length}>Other prayers</SectionTitle>
                <IntentionList intentions={others} today={day} todayId={todayId} />
              </section>
            ) : null}
          </div>
        )}
      </div>

      <IntentionModal open={adding} onClose={() => setAdding(false)} />
      <ChooseModal open={choosing} onClose={() => setChoosing(false)} intentions={active} currentId={todayId} />
    </div>
  );
}
