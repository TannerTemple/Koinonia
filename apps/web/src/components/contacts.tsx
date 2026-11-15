"use client";

import { Check, ChevronRight, Mail, MessageSquare, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CADENCE_PRESETS,
  CHANNELS,
  CHANNEL_LABELS,
  MAX_CADENCE_DAYS,
  cadenceLabel,
  computeNextDue,
  contactLink,
  dueLabel,
  dueStatus,
  formatLongDay,
  joinBirthday,
  relativeDay,
  splitBirthday,
  type BirthdayParts,
  type Channel,
  type Contact,
  type CreateContactInput,
} from "@koinonia/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/hooks";
import { Avatar, Badge, Button, Disclosure, Field, FormError, Input, Modal, Select, Textarea, fieldErrors } from "./ui";

// ---------------------------------------------------------------------------
// Due badge
// ---------------------------------------------------------------------------
export function DueBadge({ contact, today }: { contact: Contact; today: string }) {
  const status = dueStatus(contact.dueDay, today);
  if (status === "none") return <Badge>No reminder</Badge>;
  const tone = ({ overdue: "danger", today: "gold", soon: "primary", later: "neutral" } as const)[status];
  return <Badge tone={tone}>{dueLabel(contact.dueDay, today)}</Badge>;
}

// ---------------------------------------------------------------------------
// A person in a list
// ---------------------------------------------------------------------------
export function ContactRow({ contact, today }: { contact: Contact; today: string }) {
  return (
    <li>
      <Link href={`/people/${contact.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-surface-alt">
        <Avatar name={contact.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">{contact.name}</span>
          <span className="block truncate text-sm text-muted">
            {cadenceLabel(contact.cadenceDays)}
            {contact.lastContactedDay ? ` · last ${relativeDay(contact.lastContactedDay, today)}` : ""}
          </span>
        </span>
        <DueBadge contact={contact} today={today} />
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export function ContactList({ contacts, today }: { contacts: Contact[]; today: string; actions?: boolean }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {contacts.map((c) => (
        <ContactRow key={c.id} contact={c} today={today} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Someone who is due: who, how late, and the two things you can do, in words
// ---------------------------------------------------------------------------
export function ReachOutCard({ contact, today }: { contact: Contact; today: string }) {
  const [logging, setLogging] = useState(false);
  const notToday = useAction(() => api.contacts.snooze(contact.id, { days: 1 }));
  const late = dueStatus(contact.dueDay, today) === "overdue";
  const first = contact.name.split(" ")[0];
  const call = contactLink("CALL", contact);
  const text = contactLink("TEXT", contact);

  return (
    <li className={cn("rounded-2xl border bg-surface p-4", late ? "border-danger" : "border-border")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link href={`/people/${contact.id}`} className="flex min-w-0 flex-1 basis-56 items-center gap-3 rounded-lg">
          <Avatar name={contact.name} size={48} />
          <span className="min-w-0">
            <span className="block truncate text-xl font-semibold">{contact.name}</span>
            <span className={cn("block text-sm font-semibold", late ? "text-danger" : "text-muted")}>
              {dueLabel(contact.dueDay, today)}
              {contact.lastContactedDay ? ` · last talked ${relativeDay(contact.lastContactedDay, today)}` : ""}
            </span>
          </span>
        </Link>
        {/* Same order on every card and every width: the main action first. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button onClick={() => setLogging(true)} aria-label={`I reached out to ${contact.name}`}>
            <Check className="size-4" aria-hidden /> I reached out
          </Button>
          <Button variant="secondary" loading={notToday.isPending} onClick={() => notToday.mutate(undefined)} aria-label={`Not today: remind me about ${first} tomorrow`}>
            Not today
          </Button>
          {call ? (
            <a href={call} className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 font-semibold text-primary hover:bg-primary-soft" aria-label={`Call ${contact.name}`}>
              <Phone className="size-4" aria-hidden /> Call
            </a>
          ) : null}
          {text ? (
            <a href={text} className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 font-semibold text-primary hover:bg-primary-soft" aria-label={`Text ${contact.name}`}>
              <MessageSquare className="size-4" aria-hidden /> Text
            </a>
          ) : null}
        </div>
      </div>
      <FormError error={notToday.error} />
      <ReachOutModal contact={contact} today={today} open={logging} onClose={() => setLogging(false)} />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Log a reach-out
// ---------------------------------------------------------------------------
export function ReachOutModal({ contact, today, open, onClose }: { contact: Contact; today: string; open: boolean; onClose: () => void }) {
  const [channel, setChannel] = useState<Channel>(contact.preferredChannel);
  const [summary, setSummary] = useState("");
  const [day, setDay] = useState(today);
  const log = useAction(() => api.contacts.reachOut(contact.id, { channel, summary, day }));
  // The clock restarts from the day they actually talked, not from today.
  const nextDay = computeNextDue(day || today, contact.cadenceDays);

  return (
    <Modal open={open} onClose={onClose} title={`You reached out to ${contact.name.split(" ")[0]}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          log.mutate(undefined, {
            onSuccess: () => {
              setSummary("");
              onClose();
            },
          });
        }}
      >
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">How?</legend>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => setChannel(c)}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm font-semibold transition-colors",
                  channel === c ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-surface-alt",
                )}
              >
                {CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="When" error={fieldErrors(log.error).day}>
          {(p) => <Input {...p} type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} required />}
        </Field>
        <Field label="Anything to remember?" hint="Optional. Shows up in their history.">
          {(p) => <Textarea {...p} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} placeholder="She got the job! Starts in January." />}
        </Field>
        <p className="text-sm text-muted" role="status">
          {nextDay ? `Koinonia will remind you again on ${formatLongDay(nextDay)}.` : "No reminder is set for them."}
        </p>
        <FormError error={log.error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={log.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Call / text / email shortcuts
// ---------------------------------------------------------------------------
export function QuickActions({ contact }: { contact: Contact }) {
  const items = [
    { channel: "CALL" as const, label: "Call", icon: Phone },
    { channel: "TEXT" as const, label: "Text", icon: MessageSquare },
    { channel: "EMAIL" as const, label: "Email", icon: Mail },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ channel, label, icon: Icon }) => {
        const href = contactLink(channel, contact);
        const className = "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-surface text-sm font-semibold";
        return href ? (
          <a key={channel} href={href} className={cn(className, "text-primary hover:bg-primary-soft")}>
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </a>
        ) : (
          <span key={channel} className={cn(className, "text-muted opacity-50")} title={`No ${channel === "EMAIL" ? "email" : "phone number"} saved`}>
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cadence picker
// ---------------------------------------------------------------------------
export function CadencePicker({ value, onChange }: { value: number | null; onChange: (days: number | null) => void }) {
  const isPreset = value === null || CADENCE_PRESETS.some((p) => p.days === value);
  const [custom, setCustom] = useState(!isPreset);
  const chip = (active: boolean) =>
    cn(
      "h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors",
      active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-surface-alt",
    );

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">How often do you want to reach out?</legend>
      <div className="flex flex-wrap gap-2">
        {CADENCE_PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            aria-pressed={!custom && value === p.days}
            className={chip(!custom && value === p.days)}
            onClick={() => {
              setCustom(false);
              onChange(p.days);
            }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" aria-pressed={custom} className={chip(custom)} onClick={() => { setCustom(true); onChange(value ?? 10); }}>
          Custom
        </button>
        <button type="button" aria-pressed={!custom && value === null} className={chip(!custom && value === null)} onClick={() => { setCustom(false); onChange(null); }}>
          No reminder
        </button>
      </div>
      {custom ? (
        <label className="mt-3 flex items-center gap-2 text-sm">
          Every
          <Input
            type="number"
            min={1}
            max={MAX_CADENCE_DAYS}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value ? Math.max(1, Math.min(MAX_CADENCE_DAYS, Number(e.target.value))) : null)}
            className="w-24"
            aria-label="Number of days between reminders"
          />
          days
        </label>
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Birthday: month, day, and a year only if you know it
// ---------------------------------------------------------------------------
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function BirthdayInput({ value, onChange, error }: { value: BirthdayParts; onChange: (next: BirthdayParts) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">Birthday</legend>
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Birthday month" value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })} className="w-40">
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </Select>
        <Select aria-label="Birthday day" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })} className="w-24">
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Birthday year (optional)"
          inputMode="numeric"
          placeholder="Year (optional)"
          value={value.year}
          onChange={(e) => onChange({ ...value, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          className="w-40"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Add / edit form
// ---------------------------------------------------------------------------
export interface ContactFormValues {
  name: string;
  phone: string;
  email: string;
  relationship: string;
  birthday: BirthdayParts;
  cadenceDays: number | null;
  preferredChannel: Channel;
  lastContactedDay: string;
}

export const EMPTY_CONTACT: ContactFormValues = {
  name: "",
  phone: "",
  email: "",
  relationship: "",
  birthday: { month: "", day: "", year: "" },
  cadenceDays: 14,
  preferredChannel: "TEXT",
  lastContactedDay: "",
};

export function contactToForm(c: Contact): ContactFormValues {
  return {
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    relationship: c.relationship ?? "",
    birthday: splitBirthday(c.birthday),
    cadenceDays: c.cadenceDays,
    preferredChannel: c.preferredChannel,
    lastContactedDay: c.lastContactedDay ?? "",
  };
}

interface ContactFormProps {
  initial: ContactFormValues;
  today: string;
  submitLabel: string;
  /** Hide "last talked" when editing: the history owns that. */
  showLastContacted?: boolean;
  onSubmit: (input: CreateContactInput) => Promise<unknown>;
  onCancel: () => void;
}

export function ContactForm({ initial, today, submitLabel, showLastContacted = true, onSubmit, onCancel }: ContactFormProps) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const errors = fieldErrors(error);
  // Open when there is already something inside, and whenever a problem is inside.
  const hasDetails = Boolean(initial.phone || initial.email || initial.relationship || initial.birthday.month || initial.lastContactedDay);
  const hiddenError = ["phone", "email", "relationship", "birthday", "lastContactedDay"].some((key) => errors[key]);
  const [more, setMore] = useState(hasDetails);
  useEffect(() => {
    if (hiddenError) setMore(true);
  }, [hiddenError]);
  const set = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          const { lastContactedDay, birthday, ...fields } = v;
          const rest = { ...fields, birthday: joinBirthday(birthday) };
          await onSubmit(showLastContacted ? { ...rest, lastContactedDay } : rest);
        } catch (err) {
          setError(err);
          setSaving(false);
        }
      }}
    >
      <Field label="Name" error={errors.name}>
        {(p) => <Input {...p} value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} autoFocus placeholder="Maria Lopez" />}
      </Field>

      <CadencePicker value={v.cadenceDays} onChange={(d) => set("cadenceDays", d)} />

      <Disclosure label={more ? "Fewer details" : "More details (optional): phone, email, birthday"} open={more} onToggle={() => setMore((m) => !m)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone" error={errors.phone}>
            {(p) => <Input {...p} type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="off" placeholder="(555) 010-2000" />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(p) => <Input {...p} type="email" value={v.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" placeholder="maria@example.com" />}
          </Field>
          <Field label="Who are they to you?" error={errors.relationship}>
            {(p) => <Input {...p} value={v.relationship} onChange={(e) => set("relationship", e.target.value)} maxLength={40} placeholder="College friend, Family, Small group…" />}
          </Field>
          <Field label="Usual way to reach them">
            {(p) => (
              <Select {...p} value={v.preferredChannel} onChange={(e) => set("preferredChannel", e.target.value as Channel)}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <BirthdayInput value={v.birthday} onChange={(b) => set("birthday", b)} error={errors.birthday} />
        {showLastContacted ? (
          <Field label="Last time you talked" hint="The first reminder counts from here." error={errors.lastContactedDay}>
            {(p) => <Input {...p} type="date" max={today} value={v.lastContactedDay} onChange={(e) => set("lastContactedDay", e.target.value)} className="sm:w-60" />}
          </Field>
        ) : null}
      </Disclosure>

      <FormError error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
