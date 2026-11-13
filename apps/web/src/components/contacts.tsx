"use client";

import { AlarmClockOff, Check, ChevronRight, Mail, MessageSquare, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  CADENCE_PRESETS,
  CHANNELS,
  CHANNEL_LABELS,
  MAX_CADENCE_DAYS,
  cadenceLabel,
  contactLink,
  dueLabel,
  dueStatus,
  relativeDay,
  type Channel,
  type Contact,
  type CreateContactInput,
} from "@koinonia/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/hooks";
import { Avatar, Badge, Button, Field, FormError, IconButton, Input, Modal, Select, Textarea, fieldErrors } from "./ui";

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
// Row used on Today and People
// ---------------------------------------------------------------------------
export function ContactRow({ contact, today, actions = true }: { contact: Contact; today: string; actions?: boolean }) {
  const [logging, setLogging] = useState(false);
  const snooze = useAction((days: number) => api.contacts.snooze(contact.id, { days }));
  const status = dueStatus(contact.dueDay, today);
  const actionable = actions && (status === "overdue" || status === "today");

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link href={`/people/${contact.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
        <Avatar name={contact.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{contact.name}</span>
          <span className="block truncate text-sm text-muted">
            {cadenceLabel(contact.cadenceDays)}
            {contact.lastContactedDay ? ` · last ${relativeDay(contact.lastContactedDay, today)}` : ""}
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={cn(actionable && "max-sm:hidden")}>
          <DueBadge contact={contact} today={today} />
        </span>
        {actionable ? (
          <>
            <IconButton label={`Snooze ${contact.name} for 3 days`} disabled={snooze.isPending} onClick={() => snooze.mutate(3)}>
              <AlarmClockOff className="size-[18px]" />
            </IconButton>
            <Button size="sm" onClick={() => setLogging(true)} aria-label={`Log a reach-out to ${contact.name}`}>
              <Check className="size-4" aria-hidden /> Reached out
            </Button>
          </>
        ) : (
          <ChevronRight className="size-4 text-muted" aria-hidden />
        )}
      </div>
      <ReachOutModal contact={contact} today={today} open={logging} onClose={() => setLogging(false)} />
    </li>
  );
}

export function ContactList({ contacts, today, actions }: { contacts: Contact[]; today: string; actions?: boolean }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {contacts.map((c) => (
        <ContactRow key={c.id} contact={c} today={today} actions={actions} />
      ))}
    </ul>
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
        <FormError error={log.error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={log.isPending}>
            Log it{contact.cadenceDays ? ` · next in ${contact.cadenceDays} days` : ""}
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
      <legend className="mb-1.5 text-sm font-semibold">Remind me to reach out</legend>
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
// Add / edit form
// ---------------------------------------------------------------------------
export interface ContactFormValues {
  name: string;
  phone: string;
  email: string;
  relationship: string;
  birthday: string;
  cadenceDays: number | null;
  preferredChannel: Channel;
  lastContactedDay: string;
}

export const EMPTY_CONTACT: ContactFormValues = {
  name: "",
  phone: "",
  email: "",
  relationship: "",
  birthday: "",
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
    birthday: c.birthday ?? "",
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
  const set = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          const { lastContactedDay, ...rest } = v;
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
        <Field label="Birthday" error={errors.birthday}>
          {(p) => <Input {...p} type="date" value={v.birthday.length === 5 ? "" : v.birthday} onChange={(e) => set("birthday", e.target.value)} />}
        </Field>
      </div>

      <CadencePicker value={v.cadenceDays} onChange={(d) => set("cadenceDays", d)} />

      <div className="grid gap-5 sm:grid-cols-2">
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
        {showLastContacted ? (
          <Field label="Last time you talked" hint="Optional. The first reminder counts from here." error={errors.lastContactedDay}>
            {(p) => <Input {...p} type="date" max={today} value={v.lastContactedDay} onChange={(e) => set("lastContactedDay", e.target.value)} />}
          </Field>
        ) : null}
      </div>

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
