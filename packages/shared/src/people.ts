import { dueStatus } from "./cadence";
import { GROUP_PRESETS, type Contact } from "./schemas";

/** "all", "due" (late or due today), "favorites", "archived", or one group as "group:Family". */
export type PeopleFilter = "all" | "due" | "favorites" | "archived" | `group:${string}`;

/** How many people a list shows before "Show more". */
export const PEOPLE_PAGE = 50;

/** Every group in use, presets first in their usual order, then the rest alphabetically. */
export function groupsInUse(contacts: Pick<Contact, "groups">[]): string[] {
  const seen = new Map<string, string>();
  for (const c of contacts) for (const g of c.groups) if (!seen.has(g.toLowerCase())) seen.set(g.toLowerCase(), g);
  const presets = GROUP_PRESETS.filter((p) => seen.has(p.toLowerCase()));
  const others = [...seen.entries()]
    .filter(([key]) => !GROUP_PRESETS.some((p) => p.toLowerCase() === key))
    .map(([, label]) => label)
    .sort((a, b) => a.localeCompare(b));
  return [...presets, ...others];
}

/**
 * The people list after search and filter. Search looks at the name, how you know them,
 * their groups, email, and phone (digits only, so "555 0102" finds "(555) 010-2000").
 * Favorites come first, then by name.
 */
export function filterPeople(contacts: Contact[], options: { q?: string; filter?: PeopleFilter; today: string }): Contact[] {
  const needle = (options.q ?? "").trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const filter = options.filter ?? "all";
  const group = filter.startsWith("group:") ? filter.slice(6).toLowerCase() : null;

  return contacts
    .filter((c) => {
      if (needle) {
        const text = `${c.name} ${c.relationship ?? ""} ${c.groups.join(" ")} ${c.email ?? ""}`.toLowerCase();
        const phone = (c.phone ?? "").replace(/\D/g, "");
        if (!text.includes(needle) && !(digits.length >= 3 && phone.includes(digits))) return false;
      }
      if (filter === "due") {
        const status = dueStatus(c.dueDay, options.today);
        return status === "overdue" || status === "today";
      }
      if (filter === "favorites") return c.favorite;
      if (group !== null) return c.groups.some((g) => g.toLowerCase() === group);
      return true;
    })
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
}
