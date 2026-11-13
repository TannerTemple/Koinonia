import { isDay } from "./dates";

/** A person read from an address book or a contacts file, before it is sent to the API. */
export interface ImportCandidate {
  name: string;
  phone: string | null;
  email: string | null;
  /** "YYYY-MM-DD", or "MM-DD" when the year is unknown. */
  birthday: string | null;
}

const unescape = (value: string) => value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const hex = value.slice(i + 1, i + 3);
    if (value[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(value[i]!));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** vCard birthdays come as 1990-04-12, 19900412, --0412, --04-12, or 1604-04-12 (Apple's "no year"). */
export function parseVCardBirthday(raw: string): string | null {
  const value = raw.trim().split("T")[0]!;
  const noYear = /^--(\d{2})-?(\d{2})$/.exec(value);
  if (noYear) return isDay(`2000-${noYear[1]}-${noYear[2]}`) ? `${noYear[1]}-${noYear[2]}` : null;
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value);
  if (!full) return null;
  const [, y, m, d] = full;
  if (!isDay(`${y === "1604" ? "2000" : y}-${m}-${d}`)) return null;
  return y === "1604" ? `${m}-${d}` : `${y}-${m}-${d}`;
}

/**
 * Reads the people out of a vCard (.vcf) file, the format every address book exports
 * (iCloud, Google Contacts, Outlook, Android). Cards without any usable name are skipped.
 */
export function parseVCards(text: string): ImportCandidate[] {
  // Unfold: a line that starts with a space or tab continues the previous one;
  // quoted-printable lines continue after a trailing "=".
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/=\n(?=\S)/g, "")
    .replace(/\n[ \t]/g, "")
    .split("\n");

  const people: ImportCandidate[] = [];
  let card: { fn?: string; n?: string; org?: string; phones: { value: string; rank: number }[]; email?: string; birthday?: string | null } | null = null;

  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const [rawName, ...params] = line.slice(0, colon).split(";");
    // "item1.TEL" → "TEL"
    const name = rawName!.split(".").pop()!.toUpperCase();
    const paramText = params.join(";").toUpperCase();
    let value = line.slice(colon + 1);
    if (paramText.includes("QUOTED-PRINTABLE")) value = decodeQuotedPrintable(value);

    if (name === "BEGIN" && value.trim().toUpperCase() === "VCARD") {
      card = { phones: [] };
    } else if (!card) {
      continue;
    } else if (name === "END") {
      const [family = "", given = "", middle = ""] = (card.n ?? "").split(";").map(unescape);
      const fullName = (card.fn ?? "") || [given, middle, family].filter(Boolean).join(" ") || (card.org ?? "");
      if (fullName.trim()) {
        const phone = [...card.phones].sort((a, b) => a.rank - b.rank)[0]?.value ?? null;
        people.push({ name: fullName.trim().slice(0, 80), phone, email: card.email ?? null, birthday: card.birthday ?? null });
      }
      card = null;
    } else if (name === "FN") {
      card.fn = unescape(value);
    } else if (name === "N") {
      card.n = value;
    } else if (name === "ORG") {
      card.org = unescape(value.split(";")[0] ?? "");
    } else if (name === "TEL" && value.trim()) {
      // Prefer the preferred number, then a mobile, then whatever came first.
      const rank = paramText.includes("PREF") ? 0 : /CELL|MOBILE|IPHONE/.test(paramText) ? 1 : 2;
      card.phones.push({ value: value.trim().replace(/^tel:/i, ""), rank });
    } else if (name === "EMAIL" && !card.email && value.trim()) {
      card.email = value.trim().replace(/^mailto:/i, "");
    } else if (name === "BDAY") {
      card.birthday = parseVCardBirthday(value);
    }
  }
  return people;
}

/** Splits a long import into requests the API accepts (500 people at most each). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
