import type { Channel } from "./schemas";

/** Conversation starters so "what do I even say?" never blocks a reach-out. */
export const MESSAGE_STARTERS = [
  "Hey {name}, you crossed my mind today. How are you doing?",
  "Hi {name}! It's been a little while — how's life lately?",
  "{name}, thinking of you. Anything I can be praying for?",
  "Hey {name}, want to catch up this week? Coffee or a call?",
] as const;

export function fillStarter(template: string, name: string): string {
  return template.replace("{name}", name.trim().split(/\s+/)[0] ?? name);
}

/** Deep link that opens the phone, messages or mail app for a contact. */
export function contactLink(
  channel: Channel,
  contact: { phone: string | null; email: string | null },
  message?: string,
): string | null {
  const body = message ? encodeURIComponent(message) : "";
  switch (channel) {
    case "CALL":
      return contact.phone ? `tel:${contact.phone}` : null;
    case "TEXT":
      return contact.phone ? `sms:${contact.phone}${body ? `?&body=${body}` : ""}` : null;
    case "EMAIL":
      return contact.email ? `mailto:${contact.email}${body ? `?body=${body}` : ""}` : null;
    default:
      return null;
  }
}
