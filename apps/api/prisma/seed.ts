/**
 * Demo data so every screen has something to show.
 *   demo@koinonia.app  / koinonia-demo   (regular user with a full address book)
 *   admin@koinonia.app / koinonia-admin  (admin)
 * Everything is dated relative to today, so the demo always looks current.
 */
import { PrismaClient, type Channel, type IntentionKind } from "@prisma/client";
import { addDays, computeNextDue, dayInTimezone } from "@koinonia/shared";
import { hashPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();
const TZ = "America/Chicago";
const today = dayInTimezone(new Date(), TZ);
const ago = (n: number) => addDays(today, -n);
const ahead = (n: number) => addDays(today, n);

interface SeedPerson {
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  birthday?: string;
  cadenceDays?: number;
  channel?: Channel;
  /** Days ago of each logged reach-out, with what happened. */
  reachOuts?: [number, Channel, string?][];
  notes?: { body: string; pinned?: boolean; followUpIn?: number }[];
  intentions?: { title: string; details?: string; kind?: IntentionKind; prayedDaysAgo?: number[]; answered?: boolean }[];
  snoozeDays?: number;
}

const people: SeedPerson[] = [
  {
    name: "Mom", relationship: "Family", phone: "+13125550101", cadenceDays: 3, channel: "CALL", birthday: "1962-03-19",
    reachOuts: [[4, "CALL", "Talked about Thanksgiving plans"], [7, "CALL"], [10, "TEXT"], [13, "CALL", "She had her checkup — all clear"]],
    notes: [{ body: "Loves when I call on Sunday afternoons after Mass.", pinned: true }, { body: "Ask what to bring for Thanksgiving", followUpIn: 0 }],
    intentions: [{ title: "Mom's knee recovery", details: "Physical therapy twice a week through December.", prayedDaysAgo: [1, 2, 3, 5] }],
  },
  {
    name: "Daniel Okafor", relationship: "Best friend", phone: "+13125550102", email: "daniel.okafor@example.com", cadenceDays: 7, channel: "TEXT",
    birthday: `1991-${ahead(5).slice(5)}`,
    reachOuts: [[7, "TEXT", "Sent him the podcast episode"], [15, "IN_PERSON", "Coffee at Dark Matter"], [22, "CALL"]],
    notes: [{ body: "Started a new job at the architecture firm in September. Boss is named Priya.", pinned: true }, { body: "Wife: Chioma. Kids: Emeka (6) and Ada (3)." }, { body: "Birthday coming up — he mentioned wanting the new Ken Follett book", followUpIn: 3 }],
    intentions: [{ title: "Daniel's new job", details: "That he finds his footing and good friends at work.", prayedDaysAgo: [2, 6] }],
  },
  {
    name: "Fr. Michael Brennan", relationship: "Pastor", email: "frmichael@example.com", cadenceDays: 28, channel: "EMAIL",
    reachOuts: [[35, "IN_PERSON", "Talked after the 10:30"]],
    notes: [{ body: "Offered to meet for spiritual direction — first Fridays work best for him." }],
    intentions: [{ title: "Fr. Michael and the parish capital campaign", kind: "PROMISED", prayedDaysAgo: [4] }],
  },
  {
    name: "Sarah Whitfield", relationship: "College roommate", phone: "+16175550104", email: "sarah.whitfield@example.com", cadenceDays: 14, channel: "CALL",
    reachOuts: [[16, "CALL", "She's nervous about the move to Denver"], [33, "TEXT"]],
    notes: [{ body: "Moving to Denver on the 1st. New address TBD.", pinned: true }, { body: "Ask how the move went", followUpIn: 2 }],
    intentions: [{ title: "Sarah's move to Denver", details: "Safe travel and that she finds community quickly.", prayedDaysAgo: [1, 3] }],
  },
  {
    name: "Grandpa Joe", relationship: "Family", phone: "+13125550105", cadenceDays: 7, channel: "CALL", birthday: "1938-07-04",
    reachOuts: [[2, "CALL", "Told the story about the '68 Cubs again"], [9, "CALL"], [16, "IN_PERSON", "Sunday dinner"]],
    notes: [{ body: "Hard of hearing on the phone — call the landline, speak up, mornings are best.", pinned: true }],
    intentions: [{ title: "Grandpa Joe's health", prayedDaysAgo: [1, 2, 3, 4, 5, 6] }],
  },
  {
    name: "Priya Raman", relationship: "Coworker", email: "priya.raman@example.com", phone: "+13125550106", cadenceDays: 28, channel: "TEXT",
    reachOuts: [[20, "IN_PERSON", "Lunch — she's training for the Chicago marathon"]],
    notes: [{ body: "Marathon is in the spring. Vegetarian. Loves Thai food." }],
  },
  {
    name: "Luke & Hannah Meyer", relationship: "Small group", phone: "+13125550107", cadenceDays: 14, channel: "TEXT",
    reachOuts: [[11, "TEXT", "Sent a meal train link"]],
    notes: [{ body: "Baby due in January! Registry is at Target." }, { body: "Drop off dinner", followUpIn: 6 }],
    intentions: [{ title: "Safe delivery for Hannah and the baby", details: "Due mid-January.", prayedDaysAgo: [1, 4, 8] }],
  },
  {
    name: "Tom Becker", relationship: "Neighbor", phone: "+13125550108", cadenceDays: 60, channel: "IN_PERSON",
    reachOuts: [[41, "IN_PERSON", "Helped him move the couch"]],
    notes: [{ body: "Wife Linda passed last spring. He appreciates being invited to things." }],
    intentions: [{ title: "Tom, grieving Linda", kind: "PROMISED", prayedDaysAgo: [9] }],
  },
  {
    name: "Elena Vasquez", relationship: "Goddaughter's mom", phone: "+17735550109", email: "elena.v@example.com", cadenceDays: 28, channel: "TEXT",
    birthday: "1988-12-02",
    reachOuts: [[30, "TEXT", "Sent photos from the baptism anniversary"]],
    notes: [{ body: "Goddaughter Sofia turns 5 in February. Baptism anniversary is Oct 12." }],
    snoozeDays: 4,
  },
  {
    name: "Marcus Lee", relationship: "High school friend", phone: "+14155550110", cadenceDays: 90, channel: "CALL",
    reachOuts: [[70, "CALL", "He's thinking about proposing to Jess"]],
    notes: [{ body: "Lives in San Francisco now. Two hours behind — call after 7pm." }],
    intentions: [{ title: "Marcus and Jess discerning marriage", prayedDaysAgo: [12], kind: "PROMISED" }],
  },
  {
    name: "Aunt Carol", relationship: "Family", phone: "+13125550111", cadenceDays: 28, channel: "CALL",
    reachOuts: [[12, "CALL"]],
    notes: [{ body: "Sends a card every Christmas — get hers out early this year." }],
    intentions: [{ title: "Aunt Carol's biopsy results", details: "Came back benign. Deo gratias.", prayedDaysAgo: [14, 15, 16, 18], answered: true }],
  },
  { name: "Ben Castellano", relationship: "Gym buddy", phone: "+13125550112",
    reachOuts: [[1, "IN_PERSON", "Leg day"], [3, "IN_PERSON"]], notes: [{ body: "No reminder set — we see each other Tuesdays anyway." }] },
];

const personalIntentions = [
  { title: "Patience with the kids at bedtime", kind: "PERSONAL" as const, prayedDaysAgo: [1, 2] },
  { title: "Wisdom about the job offer", kind: "PERSONAL" as const, details: "Decision due by end of month.", prayedDaysAgo: [3] },
  { title: "Thanksgiving for ten years of marriage", kind: "THANKSGIVING" as const, prayedDaysAgo: [5] },
  { title: "For the souls in purgatory", kind: "PERSONAL" as const, prayedDaysAgo: [] },
];

async function main() {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@koinonia.app" } } });

  await prisma.user.create({
    data: { email: "admin@koinonia.app", name: "Koinonia Admin", role: "ADMIN", timezone: TZ, passwordHash: await hashPassword("koinonia-admin") },
  });
  // A few other members, so "Find people" and the admin screen have something to show.
  for (const [name, email, phone] of [
    ["Daniel Okafor", "daniel@koinonia.app", "+13125550102"],
    ["Sarah Whitfield", "sarah@koinonia.app", "+16175550104"],
    ["Maria Lopez", "maria@koinonia.app", "+13125550150"],
  ] as const) {
    await prisma.user.create({ data: { email, name, phone, timezone: TZ, passwordHash: await hashPassword("koinonia-demo") } });
  }

  const user = await prisma.user.create({
    data: { email: "demo@koinonia.app", name: "Tanner Temple", phone: "+13125550100", timezone: TZ, passwordHash: await hashPassword("koinonia-demo"), lastSeenAt: new Date() },
  });

  const logPrayers = async (intentionId: string, daysAgo: number[]) => {
    if (!daysAgo.length) return;
    await prisma.prayerLog.createMany({ data: daysAgo.map((n) => ({ userId: user.id, intentionId, day: ago(n) })) });
  };

  for (const p of people) {
    const last = p.reachOuts?.length ? ago(Math.min(...p.reachOuts.map((r) => r[0]))) : null;
    const contact = await prisma.contact.create({
      data: {
        userId: user.id,
        name: p.name,
        relationship: p.relationship,
        phone: p.phone,
        email: p.email,
        birthday: p.birthday,
        cadenceDays: p.cadenceDays,
        preferredChannel: p.channel ?? "TEXT",
        lastContactedDay: last,
        nextDueDay: computeNextDue(last ?? today, p.cadenceDays),
        snoozedUntilDay: p.snoozeDays ? ahead(p.snoozeDays) : null,
      },
    });
    for (const [n, channel, summary] of p.reachOuts ?? []) {
      await prisma.interaction.create({
        data: { userId: user.id, contactId: contact.id, channel, summary, day: ago(n), occurredAt: new Date(Date.now() - n * 86_400_000) },
      });
    }
    for (const n of p.notes ?? []) {
      await prisma.note.create({
        data: { userId: user.id, contactId: contact.id, body: n.body, pinned: n.pinned ?? false, followUpDay: n.followUpIn === undefined ? null : ahead(n.followUpIn) },
      });
    }
    for (const i of p.intentions ?? []) {
      const days = i.prayedDaysAgo ?? [];
      const intention = await prisma.prayerIntention.create({
        data: {
          userId: user.id, contactId: contact.id, title: i.title, details: i.details, kind: i.kind ?? "PROMISED",
          status: i.answered ? "ANSWERED" : "ACTIVE", answeredAt: i.answered ? new Date(Date.now() - 13 * 86_400_000) : null,
          prayedCount: days.length, lastPrayedDay: days.length ? ago(Math.min(...days)) : null,
        },
      });
      await logPrayers(intention.id, days);
    }
  }

  for (const i of personalIntentions) {
    const intention = await prisma.prayerIntention.create({
      data: {
        userId: user.id, title: i.title, details: "details" in i ? i.details : null, kind: i.kind,
        prayedCount: i.prayedDaysAgo.length, lastPrayedDay: i.prayedDaysAgo.length ? ago(Math.min(...i.prayedDaysAgo)) : null,
      },
    });
    await logPrayers(intention.id, i.prayedDaysAgo);
  }

  const [contacts, intentions] = await Promise.all([
    prisma.contact.count({ where: { userId: user.id } }),
    prisma.prayerIntention.count({ where: { userId: user.id } }),
  ]);
  console.log(`Seeded ${contacts} people and ${intentions} intentions for demo@koinonia.app (password: koinonia-demo).`);
  console.log("Admin: admin@koinonia.app (password: koinonia-admin).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
