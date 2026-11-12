import type {
  Contact as ContactRow,
  Interaction as InteractionRow,
  Note as NoteRow,
  PrayerIntention as IntentionRow,
  User as UserRow,
} from "@prisma/client";
import {
  effectiveDueDay,
  type Contact,
  type Intention,
  type Interaction,
  type Note,
  type User,
} from "@koinonia/shared";

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    timezone: row.timezone,
    discoverable: row.discoverable,
    digestEnabled: row.digestEnabled,
    createdAt: row.createdAt.toISOString(),
  };
}

export type ContactWithCounts = ContactRow & {
  _count?: { notes: number; intentions: number };
};

/** Prisma include that yields the counts `toContact` expects. */
export const contactCounts = {
  _count: { select: { notes: true, intentions: { where: { status: "ACTIVE" as const } } } },
};

export function toContact(row: ContactWithCounts): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    birthday: row.birthday,
    cadenceDays: row.cadenceDays,
    preferredChannel: row.preferredChannel,
    lastContactedDay: row.lastContactedDay,
    nextDueDay: row.nextDueDay,
    snoozedUntilDay: row.snoozedUntilDay,
    dueDay: effectiveDueDay(row.nextDueDay, row.snoozedUntilDay),
    linkedUserId: row.linkedUserId,
    archived: row.archivedAt !== null,
    noteCount: row._count?.notes ?? 0,
    activeIntentionCount: row._count?.intentions ?? 0,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toInteraction(row: InteractionRow): Interaction {
  return {
    id: row.id,
    contactId: row.contactId,
    channel: row.channel,
    summary: row.summary,
    day: row.day,
    occurredAt: row.occurredAt.toISOString(),
  };
}

export function toNote(row: NoteRow & { contact: { name: string } }): Note {
  return {
    id: row.id,
    contactId: row.contactId,
    contactName: row.contact.name,
    body: row.body,
    pinned: row.pinned,
    followUpDay: row.followUpDay,
    followUpDone: row.followUpDone,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toIntention(
  row: IntentionRow & { contact: { name: string } | null },
  today: string,
): Intention {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    kind: row.kind,
    status: row.status,
    contactId: row.contactId,
    contactName: row.contact?.name ?? null,
    prayedCount: row.prayedCount,
    lastPrayedDay: row.lastPrayedDay,
    prayedToday: row.lastPrayedDay === today,
    answeredAt: row.answeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
