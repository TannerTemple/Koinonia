import type { ImportCandidate } from "@koinonia/shared";

/** The parts of an address-book entry (expo-contacts) that the import uses. */
export interface DeviceContact {
  id?: string;
  name?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  company?: string;
  phoneNumbers?: { number?: string; isPrimary?: boolean; label?: string }[];
  emails?: { email?: string; isPrimary?: boolean }[];
  /** expo-contacts months start at 0, like JavaScript dates. */
  birthday?: { day?: number; month?: number; year?: number };
}

export type Importable = ImportCandidate & { key: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** One address-book entry as something Koinonia can import, or null if it has no usable name. */
export function toImportable(contact: DeviceContact, index: number): Importable | null {
  const name =
    contact.name?.trim() ||
    [contact.firstName, contact.middleName, contact.lastName].map((part) => part?.trim()).filter(Boolean).join(" ") ||
    contact.company?.trim() ||
    "";
  if (!name) return null;

  const phones = (contact.phoneNumbers ?? []).filter((p) => p.number?.trim());
  const phone = (phones.find((p) => p.isPrimary) ?? phones.find((p) => /mobile|iphone|cell/i.test(p.label ?? "")) ?? phones[0])?.number?.trim() ?? null;
  const emails = (contact.emails ?? []).filter((e) => e.email?.trim());
  const email = (emails.find((e) => e.isPrimary) ?? emails[0])?.email?.trim() ?? null;

  const b = contact.birthday;
  const valid = b && b.day != null && b.month != null && b.day >= 1 && b.day <= 31 && b.month >= 0 && b.month <= 11;
  // Year 1 or 1604 is how address books store "no year".
  const year = b?.year && b.year > 1604 ? `${b.year}-` : "";
  const birthday = valid ? `${year}${pad(b.month! + 1)}-${pad(b.day!)}` : null;

  return { key: contact.id ?? `row-${index}`, name: name.slice(0, 80), phone, email, birthday };
}

/** Everything importable in an address book, sorted by name. */
export function toImportables(contacts: DeviceContact[]): Importable[] {
  return contacts
    .map(toImportable)
    .filter((c): c is Importable => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
