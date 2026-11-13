import type { Env } from "../env";
import { ResendEmailProvider } from "./resend";

/**
 * Outside services live behind these interfaces. Each has a mock that records what it
 * would have sent (and logs it in development), and a real adapter that is switched on
 * from the environment: email by EMAIL_PROVIDER=resend, SMS and push by their keys.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export interface SmsMessage {
  to: string;
  body: string;
}
export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

export interface PushMessage {
  /** Expo push tokens */
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}
export interface PushProvider {
  send(message: PushMessage): Promise<void>;
}

export interface Providers {
  email: EmailProvider;
  sms: SmsProvider;
  push: PushProvider;
}

type Logger = (line: string) => void;

export class MockEmailProvider implements EmailProvider {
  sent: EmailMessage[] = [];
  constructor(private log?: Logger) {}
  async send(message: EmailMessage) {
    this.sent.push(message);
    this.log?.(`[mock email] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}

export class MockSmsProvider implements SmsProvider {
  sent: SmsMessage[] = [];
  constructor(private log?: Logger) {}
  async send(message: SmsMessage) {
    this.sent.push(message);
    this.log?.(`[mock sms] to=${message.to} ${message.body}`);
  }
}

export class MockPushProvider implements PushProvider {
  sent: PushMessage[] = [];
  constructor(private log?: Logger) {}
  async send(message: PushMessage) {
    this.sent.push(message);
    this.log?.(`[mock push] devices=${message.tokens.length} ${message.title}: ${message.body}`);
  }
}

async function postOrThrow(url: string, init: RequestInit, service: string) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${service} responded ${res.status}: ${await res.text()}`);
}

export { EmailDeliveryError, ResendEmailProvider } from "./resend";

/** Twilio SMS. Used when the three TWILIO_* variables are set. Not exercised by tests. */
export class TwilioSmsProvider implements SmsProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private from: string,
  ) {}
  async send(message: SmsMessage) {
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    await postOrThrow(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: message.to, From: this.from, Body: message.body }),
      },
      "Twilio",
    );
  }
}

/** Expo push service. Used when PUSH_ENABLED=true. Not exercised by tests. */
export class ExpoPushProvider implements PushProvider {
  constructor(private accessToken?: string) {}
  async send(message: PushMessage) {
    if (message.tokens.length === 0) return;
    await postOrThrow(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(
          message.tokens.map((to) => ({ to, title: message.title, body: message.body, data: message.data, sound: "default" })),
        ),
      },
      "Expo push",
    );
  }
}

export function createProviders(env: Env, log?: Logger): Providers {
  return {
    // Real email is opt-in: EMAIL_PROVIDER=resend (the environment check guarantees the key).
    email:
      env.EMAIL_PROVIDER === "resend"
        ? new ResendEmailProvider({ apiKey: env.RESEND_API_KEY!, from: env.EMAIL_FROM, replyTo: env.EMAIL_REPLY_TO })
        : new MockEmailProvider(log),
    sms:
      env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER
        ? new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM_NUMBER)
        : new MockSmsProvider(log),
    push: env.PUSH_ENABLED ? new ExpoPushProvider(env.EXPO_ACCESS_TOKEN) : new MockPushProvider(log),
  };
}

export function createMockProviders() {
  return { email: new MockEmailProvider(), sms: new MockSmsProvider(), push: new MockPushProvider() };
}
