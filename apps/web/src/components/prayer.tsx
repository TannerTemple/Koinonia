"use client";

import { Check, HandHeart, MoreHorizontal, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  INTENTION_KINDS,
  INTENTION_KIND_LABELS,
  relativeDay,
  type Contact,
  type Intention,
  type IntentionKind,
  type PrayerToday,
} from "@koinonia/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAction, useContacts } from "@/lib/hooks";
import { Badge, Button, Field, FormError, IconButton, Input, Modal, Select, Textarea, fieldErrors } from "./ui";

// ---------------------------------------------------------------------------
// The intention of the day (forest hero panel)
// ---------------------------------------------------------------------------
export function DailyIntentionCard({ prayer, onChoose, compact }: { prayer: PrayerToday; onChoose?: () => void; compact?: boolean }) {
  const intention = prayer.intention;
  const pray = useAction((id: string) => api.intentions.pray(id));

  return (
    <section aria-label="Today's intention" className="hero-forest overflow-hidden rounded-2xl p-5 text-on-hero shadow-lg sm:p-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-on-hero-muted">
        <Sparkles className="size-4" aria-hidden /> Today&rsquo;s intention
      </p>
      {intention ? (
        <>
          <h2 className={cn("mt-3 font-semibold leading-tight", compact ? "text-2xl" : "text-3xl")}>{intention.title}</h2>
          {intention.contactName ? (
            <p className="mt-1.5 text-on-hero-muted">
              for{" "}
              <Link href={`/people/${intention.contactId}`} className="font-semibold text-on-hero underline decoration-white/40 underline-offset-2">
                {intention.contactName}
              </Link>
            </p>
          ) : null}
          {intention.details && !compact ? <p className="mt-3 max-w-prose text-on-hero-muted">{intention.details}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {intention.prayedToday ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-white/15 px-4 font-semibold">
                <Check className="size-4" aria-hidden /> Prayed today
              </span>
            ) : (
              <button
                type="button"
                disabled={pray.isPending}
                onClick={() => pray.mutate(intention.id)}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 font-semibold text-[#143B2B] transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                <HandHeart className="size-4" aria-hidden /> I prayed for this
              </button>
            )}
            {onChoose ? (
              <button type="button" onClick={onChoose} className="h-11 rounded-lg px-3 font-semibold text-on-hero-muted hover:bg-white/10 hover:text-on-hero">
                Choose another
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-on-hero-muted">
            {prayer.chosenByUser ? "You chose this for today." : "Suggested because it has waited the longest."}
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-2xl font-semibold">Nothing on your heart yet</h2>
          <p className="mt-1.5 text-on-hero-muted">Add someone you said you&rsquo;d pray for, and one intention will be set apart each day.</p>
          <Link href="/prayer" className="mt-4 inline-flex h-11 items-center rounded-lg bg-white px-4 font-semibold text-[#143B2B]">
            Add an intention
          </Link>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// One intention in a list
// ---------------------------------------------------------------------------
export function IntentionCard({ intention, today, isToday, showContact = true }: { intention: Intention; today: string; isToday?: boolean; showContact?: boolean }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const pray = useAction(() => (intention.prayedToday ? api.intentions.unpray(intention.id) : api.intentions.pray(intention.id)));
  const setToday = useAction(() => api.prayer.setToday(intention.id));
  const update = useAction((status: Intention["status"]) => api.intentions.update(intention.id, { status }));
  const remove = useAction(() => api.intentions.delete(intention.id));
  const active = intention.status === "ACTIVE";

  return (
    <li className="flex gap-3 px-4 py-3.5">
      <button
        type="button"
        disabled={!active || pray.isPending}
        onClick={() => pray.mutate(undefined)}
        aria-pressed={intention.prayedToday}
        aria-label={intention.prayedToday ? `Undo prayed for ${intention.title}` : `Mark ${intention.title} as prayed today`}
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-40",
          intention.prayedToday ? "border-forest bg-forest text-on-primary" : "border-border text-muted hover:border-forest hover:text-forest",
        )}
      >
        {intention.prayedToday ? <Check className="size-4" /> : <HandHeart className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold", !active && "text-muted")}>{intention.title}</p>
        {intention.details ? <p className="mt-0.5 text-sm text-muted">{intention.details}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {isToday ? (
            <Badge tone="forest">
              <Star className="size-3" aria-hidden /> Today&rsquo;s intention
            </Badge>
          ) : null}
          {showContact && intention.contactName ? (
            <Link href={`/people/${intention.contactId}`}>
              <Badge tone="primary">{intention.contactName}</Badge>
            </Link>
          ) : null}
          <Badge>{INTENTION_KIND_LABELS[intention.kind]}</Badge>
          {intention.status === "ANSWERED" ? <Badge tone="gold">Answered</Badge> : null}
          {intention.status === "ARCHIVED" ? <Badge>Archived</Badge> : null}
          <span className="text-xs text-muted">
            {intention.prayedCount === 0
              ? "Not prayed yet"
              : `Prayed ${intention.prayedCount}× · last ${relativeDay(intention.lastPrayedDay!, today)}`}
          </span>
        </div>
        {menu ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {active && !isToday ? (
              <Button size="sm" variant="secondary" loading={setToday.isPending} onClick={() => setToday.mutate(undefined, { onSuccess: () => setMenu(false) })}>
                Make today&rsquo;s intention
              </Button>
            ) : null}
            {active ? (
              <Button size="sm" variant="secondary" onClick={() => update.mutate("ANSWERED")}>
                Mark answered
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => update.mutate("ACTIVE")}>
                Pray again
              </Button>
            )}
            {active ? (
              <Button size="sm" variant="secondary" onClick={() => update.mutate("ARCHIVED")}>
                Archive
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete "${intention.title}"? This can't be undone.`)) remove.mutate(undefined);
              }}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
      <IconButton label={`More options for ${intention.title}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        <MoreHorizontal className="size-5" />
      </IconButton>
      <IntentionModal open={editing} onClose={() => setEditing(false)} intention={intention} />
    </li>
  );
}

export function IntentionList({ intentions, today, todayId, showContact }: { intentions: Intention[]; today: string; todayId?: string | null; showContact?: boolean }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {intentions.map((i) => (
        <IntentionCard key={i.id} intention={i} today={today} isToday={i.id === todayId} showContact={showContact} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Add / edit an intention
// ---------------------------------------------------------------------------
interface IntentionModalProps {
  open: boolean;
  onClose: () => void;
  intention?: Intention;
  /** Pre-link to a person (from their page). */
  contact?: Pick<Contact, "id" | "name">;
}

export function IntentionModal({ open, onClose, intention, contact }: IntentionModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={intention ? "Edit intention" : contact ? `Pray for ${contact.name.split(" ")[0]}` : "New intention"}>
      <IntentionForm onClose={onClose} intention={intention} contact={contact} />
    </Modal>
  );
}

function IntentionForm({ onClose, intention, contact }: Omit<IntentionModalProps, "open">) {
  const { data: contacts } = useContacts();
  const [title, setTitle] = useState(intention?.title ?? "");
  const [details, setDetails] = useState(intention?.details ?? "");
  const [contactId, setContactId] = useState(intention?.contactId ?? contact?.id ?? "");
  const [kind, setKind] = useState<IntentionKind>(intention?.kind ?? (contact ? "PROMISED" : "PERSONAL"));
  const save = useAction(() => {
    const input = { title, details, kind, contactId: contactId || null };
    return intention ? api.intentions.update(intention.id, input) : api.intentions.create(input);
  });
  const errors = fieldErrors(save.error);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, { onSuccess: onClose });
      }}
    >
      <Field label="What are you praying for?" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={140} autoFocus placeholder="Maria's surgery on Friday" />}
      </Field>
      <Field label="Details" hint="Optional.">
        {(p) => <Textarea {...p} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="For someone?">
          {(p) => (
            <Select
              {...p}
              value={contactId}
              onChange={(e) => {
                setContactId(e.target.value);
                if (!intention) setKind(e.target.value ? "PROMISED" : "PERSONAL");
              }}
            >
              <option value="">No one in particular</option>
              {(contacts ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Kind">
          {(p) => (
            <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as IntentionKind)}>
              {INTENTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {INTENTION_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="forest" loading={save.isPending}>
          {intention ? "Save" : "Add intention"}
        </Button>
      </div>
    </form>
  );
}
