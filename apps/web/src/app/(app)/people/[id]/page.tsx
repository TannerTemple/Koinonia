"use client";

import { AlarmClockOff, ArrowLeft, Cake, CalendarClock, Check, Copy, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  CHANNEL_LABELS,
  MESSAGE_STARTERS,
  cadenceLabel,
  contactLink,
  dayInTimezone,
  dueStatus,
  fillStarter,
  formatDay,
  relativeDay,
  type ContactDetail,
  type Interaction,
  type Note,
} from "@koinonia/shared";
import { DueBadge, QuickActions, ReachOutModal } from "@/components/contacts";
import { IntentionList, IntentionModal } from "@/components/prayer";
import { Avatar, Badge, Button, Card, ErrorState, Field, FormError, IconButton, Input, SectionTitle, Spinner, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useAction, useContact } from "@/lib/hooks";

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
function NoteComposer({ contactId, today }: { contactId: string; today: string }) {
  const [body, setBody] = useState("");
  const [followUpDay, setFollowUpDay] = useState("");
  const [withFollowUp, setWithFollowUp] = useState(false);
  const create = useAction(() => api.notes.create(contactId, { body, followUpDay: withFollowUp ? followUpDay : null }));

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(undefined, {
          onSuccess: () => {
            setBody("");
            setFollowUpDay("");
            setWithFollowUp(false);
          },
        });
      }}
    >
      <Field label="Add a note">
        {(p) => (
          <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder="What do you want to remember? What should you ask about next time?" className="min-h-20" />
        )}
      </Field>
      {withFollowUp ? (
        <Field label="Remind me about this on" hint="It will appear on Today when the day comes.">
          {(p) => <Input {...p} type="date" min={today} value={followUpDay} onChange={(e) => setFollowUpDay(e.target.value)} required className="max-w-52" />}
        </Field>
      ) : null}
      <FormError error={create.error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setWithFollowUp((v) => !v)} aria-pressed={withFollowUp}>
          <CalendarClock className="size-4" aria-hidden /> {withFollowUp ? "No follow-up date" : "Add a follow-up date"}
        </Button>
        <Button type="submit" size="sm" loading={create.isPending} disabled={!body.trim()}>
          Save note
        </Button>
      </div>
    </form>
  );
}

function NoteItem({ note, today }: { note: Note; today: string }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const update = useAction((input: Parameters<typeof api.notes.update>[1]) => api.notes.update(note.id, input));
  const remove = useAction(() => api.notes.delete(note.id));
  const open = note.followUpDay && !note.followUpDone;

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ body }, { onSuccess: () => setEditing(false) });
          }}
        >
          <Textarea aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} autoFocus />
          <FormError error={update.error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setBody(note.body); setEditing(false); }}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={update.isPending} disabled={!body.trim()}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{note.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {note.pinned ? (
              <Badge tone="gold">
                <Pin className="size-3" aria-hidden /> Pinned
              </Badge>
            ) : null}
            {open ? (
              <Badge tone={note.followUpDay! <= today ? "danger" : "primary"}>
                <CalendarClock className="size-3" aria-hidden /> Follow up {relativeDay(note.followUpDay!, today)}
              </Badge>
            ) : note.followUpDay ? (
              <Badge>
                <Check className="size-3" aria-hidden /> Followed up
              </Badge>
            ) : null}
            <span className="text-xs text-muted">{formatDay(dayOf(note.createdAt))}</span>
            <span className="ml-auto flex">
              {open ? (
                <IconButton label="Mark follow-up done" onClick={() => update.mutate({ followUpDone: true })}>
                  <Check className="size-[18px]" />
                </IconButton>
              ) : null}
              <IconButton label={note.pinned ? "Unpin note" : "Pin note"} onClick={() => update.mutate({ pinned: !note.pinned })}>
                {note.pinned ? <PinOff className="size-[18px]" /> : <Pin className="size-[18px]" />}
              </IconButton>
              <IconButton label="Edit note" onClick={() => setEditing(true)}>
                <Pencil className="size-[18px]" />
              </IconButton>
              <IconButton
                label="Delete note"
                onClick={() => {
                  if (window.confirm("Delete this note?")) remove.mutate(undefined);
                }}
              >
                <Trash2 className="size-[18px]" />
              </IconButton>
            </span>
          </div>
        </>
      )}
    </li>
  );
}

const dayOf = (iso: string) => iso.slice(0, 10);

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function HistoryItem({ interaction, today }: { interaction: Interaction; today: string }) {
  const remove = useAction(() => api.contacts.deleteInteraction(interaction.id));
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {CHANNEL_LABELS[interaction.channel]} · <span className="text-muted">{formatDay(interaction.day, today)} ({relativeDay(interaction.day, today)})</span>
        </p>
        {interaction.summary ? <p className="mt-0.5 text-muted">{interaction.summary}</p> : null}
      </div>
      <IconButton
        label="Remove this reach-out"
        disabled={remove.isPending}
        onClick={() => {
          if (window.confirm("Remove this reach-out from the history? The reminder will be recalculated.")) remove.mutate(undefined);
        }}
      >
        <Trash2 className="size-[18px]" />
      </IconButton>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Conversation starters
// ---------------------------------------------------------------------------
function Starters({ contact }: { contact: ContactDetail }) {
  const [copied, setCopied] = useState<number | null>(null);
  const channel = contact.phone ? "TEXT" : contact.email ? "EMAIL" : null;
  return (
    <ul className="space-y-2">
      {MESSAGE_STARTERS.map((template, i) => {
        const text = fillStarter(template, contact.name);
        const href = channel ? contactLink(channel, contact, text) : null;
        return (
          <li key={template} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <p className="min-w-0 flex-1 text-sm">{text}</p>
            <IconButton
              label="Copy message"
              onClick={() => {
                void navigator.clipboard?.writeText(text);
                setCopied(i);
              }}
            >
              {copied === i ? <Check className="size-[18px] text-forest" /> : <Copy className="size-[18px]" />}
            </IconButton>
            {href ? (
              <a href={href} className="inline-flex h-9 items-center rounded-lg bg-primary-soft px-3 text-sm font-semibold text-primary-strong">
                Send
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const today = dayInTimezone(new Date(), user.timezone);
  const { data: contact, error, isPending, refetch } = useContact(id);
  const [logging, setLogging] = useState(false);
  const [praying, setPraying] = useState(false);
  const snooze = useAction((input: Parameters<typeof api.contacts.snooze>[1]) => api.contacts.snooze(id, input));

  if (isPending) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const status = dueStatus(contact.dueDay, today);
  const snoozed = contact.snoozedUntilDay && contact.snoozedUntilDay > today && contact.dueDay === contact.snoozedUntilDay;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/people" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
          <ArrowLeft className="size-4" aria-hidden /> People
        </Link>
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Avatar name={contact.name} size={64} />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold leading-tight">{contact.name}</h1>
              <p className="mt-0.5 text-muted">{[contact.relationship, contact.archived ? "Archived" : null].filter(Boolean).join(" · ") || "No relationship set"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <DueBadge contact={contact} today={today} />
                <Badge>{cadenceLabel(contact.cadenceDays)}</Badge>
                {contact.birthday ? (
                  <Badge tone="gold">
                    <Cake className="size-3" aria-hidden /> {formatDay(contact.birthday.length === 5 ? `2000-${contact.birthday}` : contact.birthday, contact.birthday.slice(0, 4))}
                  </Badge>
                ) : null}
                {contact.linkedUserId ? <Badge tone="forest">On Koinonia</Badge> : null}
              </div>
            </div>
            <Link href={`/people/${id}/edit`} aria-label={`Edit ${contact.name}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-alt hover:text-text">
              <Pencil className="size-[18px]" />
            </Link>
          </div>

          <p className="mt-4 text-sm text-muted">
            {contact.lastContactedDay ? `You last reached out ${relativeDay(contact.lastContactedDay, today)} (${formatDay(contact.lastContactedDay, today)}).` : "No reach-outs logged yet."}
            {snoozed ? ` Snoozed until ${formatDay(contact.snoozedUntilDay!, today)}.` : ""}
          </p>

          <div className="mt-4 space-y-2">
            <QuickActions contact={contact} />
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={() => setLogging(true)}>
                <Check className="size-4" aria-hidden /> I reached out
              </Button>
              {snoozed ? (
                <Button variant="secondary" loading={snooze.isPending} onClick={() => snooze.mutate({ clear: true })}>
                  Unsnooze
                </Button>
              ) : status === "overdue" || status === "today" ? (
                <>
                  <Button variant="secondary" loading={snooze.isPending} onClick={() => snooze.mutate({ days: 1 })}>
                    <AlarmClockOff className="size-4" aria-hidden /> Tomorrow
                  </Button>
                  <Button variant="secondary" disabled={snooze.isPending} onClick={() => snooze.mutate({ days: 7 })}>
                    Next week
                  </Button>
                </>
              ) : null}
            </div>
            <FormError error={snooze.error} />
          </div>
        </Card>
      </div>

      <section>
        <SectionTitle count={contact.notes.length}>Notes</SectionTitle>
        <div className="space-y-3">
          <NoteComposer contactId={id} today={today} />
          <ul className="space-y-3">
            {contact.notes.map((n) => (
              <NoteItem key={n.id} note={n} today={today} />
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="flex items-start justify-between gap-3">
          <SectionTitle tone="forest" count={contact.intentions.length}>Praying for {contact.name.split(" ")[0]}</SectionTitle>
          <Button size="sm" variant="secondary" onClick={() => setPraying(true)}>
            <Plus className="size-4" aria-hidden /> Add intention
          </Button>
        </div>
        {contact.intentions.length ? (
          <IntentionList intentions={contact.intentions} today={today} showContact={false} />
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-muted">
            Did you tell {contact.name.split(" ")[0]} you&rsquo;d pray for something? Add it so you don&rsquo;t forget.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Not sure what to say?</SectionTitle>
        <Starters contact={contact} />
      </section>

      <section>
        <SectionTitle count={contact.interactions.length}>History</SectionTitle>
        {contact.interactions.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {contact.interactions.map((i) => (
              <HistoryItem key={i.id} interaction={i} today={today} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-muted">Each time you reach out, it lands here.</p>
        )}
      </section>

      <ReachOutModal contact={contact} today={today} open={logging} onClose={() => setLogging(false)} />
      <IntentionModal open={praying} onClose={() => setPraying(false)} contact={contact} />
    </div>
  );
}
