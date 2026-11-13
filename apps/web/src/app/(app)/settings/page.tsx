"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Flame, HandHeart } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Field, FormError, Input, Modal, PageHeader, SectionTitle, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useAction, useHome } from "@/lib/hooks";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "@/lib/theme";

function Toggle({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted">{description}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={cn("mt-1 flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary", checked ? "bg-primary" : "bg-border")}>
        <span className={cn("size-6 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
    </label>
  );
}

function Streaks() {
  const { data: home } = useHome();
  if (!home) return null;
  const items = [
    { icon: Flame, label: "Reach-out streak", streak: home.streaks.reachOut, hint: "Days in a row you reached out to someone" },
    { icon: HandHeart, label: "Prayer streak", streak: home.streaks.prayer, hint: "Days in a row you prayed for an intention" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({ icon: Icon, label, streak, hint }) => (
        <Card key={label} className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-3xl font-bold tabular-nums leading-none">
                {streak.current} <span className="text-base font-semibold text-muted">{streak.current === 1 ? "day" : "days"}</span>
              </p>
              <p className="mt-1 text-sm font-semibold">{label}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            {hint}. Best: {streak.longest}. {streak.doneToday ? "Done for today." : streak.current > 0 ? "Keep it alive today." : "Start today."}
          </p>
        </Card>
      ))}
    </div>
  );
}

function ProfileForm() {
  const user = useUser();
  const { setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const save = useAction(() => api.me.update({ name, phone }));
  const errors = fieldErrors(save.error);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined, { onSuccess: setUser });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />}
        </Field>
        <Field label="Phone" error={errors.phone}>
          {(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
      </div>
      <p className="text-sm text-muted">
        Signed in as {user.email} · Timezone {user.timezone}
      </p>
      <FormError error={save.error} />
      <Button type="submit" loading={save.isPending}>
        {save.isSuccess ? "Saved" : "Save profile"}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const change = useAction(() => api.me.changePassword({ currentPassword, newPassword }));
  const errors = fieldErrors(change.error);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        change.mutate(undefined, { onSuccess: () => { setCurrent(""); setNew(""); } });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current password" error={errors.currentPassword}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />}
        </Field>
        <Field label="New password" error={errors.newPassword} hint="At least 8 characters.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} required minLength={8} />}
        </Field>
      </div>
      <FormError error={change.error} />
      <Button type="submit" variant="secondary" loading={change.isPending}>
        {change.isSuccess ? "Password changed" : "Change password"}
      </Button>
    </form>
  );
}

function CalendarFeed() {
  const feed = useQuery({ queryKey: ["calendarFeed"], queryFn: api.me.calendarFeed });
  const create = useAction(api.me.createCalendarFeed);
  const remove = useAction(api.me.removeCalendarFeed);
  const [copied, setCopied] = useState(false);
  const url = create.data?.url ?? null;
  const active = feed.data?.active ?? false;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Subscribe from Apple Calendar (File → New Calendar Subscription) or Google Calendar (Other calendars → From URL) to see upcoming reach-outs, follow-ups and birthdays next to
        everything else. Keep the link private.
      </p>
      {url ? (
        <>
          <div className="flex gap-2">
            <Input readOnly aria-label="Calendar feed URL" value={url} onFocus={(e) => e.target.select()} className="font-mono text-sm" />
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p role="status" className="text-sm font-semibold">Copy it now. For your safety it is shown only this once.</p>
        </>
      ) : (
        <p className="text-sm">{active ? "You have a calendar link. It can't be shown again; make a new one if you've lost it." : "You don't have a calendar link yet."}</p>
      )}
      <FormError error={create.error ?? remove.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={create.isPending}
          onClick={() => {
            if (!active || window.confirm("Make a new link? The old one will stop working in any calendar that uses it.")) create.mutate(undefined, { onSuccess: () => setCopied(false) });
          }}
        >
          {active ? "Make a new link" : "Create calendar link"}
        </Button>
        {active ? (
          <Button
            variant="ghost"
            size="sm"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm("Turn off the calendar link? Calendars using it will stop updating.")) remove.mutate(undefined, { onSuccess: () => create.reset() });
            }}
          >
            Turn off
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const remove = useAction(() => api.me.delete({ password }));
  const errors = fieldErrors(remove.error);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            remove.mutate(undefined, { onSuccess: onDeleted });
          }}
        >
          <p className="text-muted">Everything in it will be removed: your people, notes, history and prayer list. This can&rsquo;t be undone.</p>
          <Field label="Your password" error={errors.password}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
          </Field>
          <FormError error={remove.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" loading={remove.isPending} disabled={!password}>
              Delete everything
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function SettingsPage() {
  const user = useUser();
  const { signOut, setUser } = useAuth();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  useEffect(() => setTheme(getThemeChoice()), []);
  const prefs = useAction((input: { discoverable?: boolean; digestEnabled?: boolean }) => api.me.update(input));
  const updatePref = (input: { discoverable?: boolean; digestEnabled?: boolean }) => prefs.mutate(input, { onSuccess: setUser });

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" />

      <section>
        <SectionTitle tone="gold">Your streaks</SectionTitle>
        <Streaks />
      </section>

      <section>
        <SectionTitle>Profile</SectionTitle>
        <Card className="p-5">
          <ProfileForm />
        </Card>
      </section>

      <section>
        <SectionTitle>Reminders &amp; privacy</SectionTitle>
        <Card className="divide-y divide-border px-5 py-2">
          <Toggle
            label="Daily reminder"
            description="A morning summary of who to reach out to, by email (and push on the iOS app)."
            checked={user.digestEnabled}
            disabled={prefs.isPending}
            onChange={(v) => updatePref({ digestEnabled: v })}
          />
          <Toggle
            label="Let friends find me"
            description="Other members can find you by name, email or phone to add you to their people."
            checked={user.discoverable}
            disabled={prefs.isPending}
            onChange={(v) => updatePref({ discoverable: v })}
          />
        </Card>
      </section>

      <section>
        <SectionTitle>Calendar</SectionTitle>
        <Card className="p-5">
          <CalendarFeed />
        </Card>
      </section>

      <section>
        <SectionTitle>Appearance</SectionTitle>
        <Card className="p-5">
          <div className="flex gap-2" role="group" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={theme === choice}
                onClick={() => {
                  setThemeChoice(choice);
                  setTheme(choice);
                }}
                className={cn(
                  "h-10 flex-1 rounded-lg border text-sm font-semibold capitalize transition-colors",
                  theme === choice ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-surface-alt",
                )}
              >
                {choice === "system" ? "Match device" : choice}
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Password</SectionTitle>
        <Card className="p-5">
          <PasswordForm />
        </Card>
      </section>

      <section>
        <SectionTitle tone="danger">Account</SectionTitle>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
          <DeleteAccount onDeleted={() => void signOut()} />
        </Card>
      </section>
    </div>
  );
}
