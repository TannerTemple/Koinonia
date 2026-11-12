"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { ApiError, avatarColor, initials } from "@koinonia/shared";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type ButtonVariant = "primary" | "forest" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-strong shadow-sm",
  forest: "bg-forest text-on-primary hover:bg-forest-strong shadow-sm",
  secondary: "bg-surface text-text border border-border hover:bg-surface-alt",
  ghost: "text-muted hover:bg-surface-alt hover:text-text",
  danger: "bg-danger-soft text-danger hover:brightness-95",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-[15px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-alt hover:text-text disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(22,32,58,0.06)]", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, count, tone = "default" }: { children: React.ReactNode; count?: number; tone?: "default" | "danger" | "gold" | "forest" }) {
  const dot = { default: "bg-primary", danger: "bg-danger", gold: "bg-gold", forest: "bg-forest" }[tone];
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted" style={{ fontFamily: "var(--font-sans)" }}>
      <span className={cn("size-2 rounded-full", dot)} aria-hidden />
      {children}
      {count !== undefined ? <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[11px] tabular-nums">{count}</span> : null}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(INPUT_CLASS, "h-11", className)} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(INPUT_CLASS, "min-h-24 py-2.5", className)} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(INPUT_CLASS, "h-11", className)}>
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
type BadgeTone = "neutral" | "primary" | "danger" | "gold" | "forest";
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-alt text-muted",
  primary: "bg-primary-soft text-primary-strong",
  danger: "bg-danger-soft text-danger",
  gold: "bg-gold-soft text-gold",
  forest: "bg-forest-soft text-forest-strong",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon ? <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</div> : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft px-6 py-8 text-center">
      <p className="font-semibold text-danger">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
      {errorMessage(error)}
    </p>
  );
}

/** Field-level messages from an API validation error. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? (error.fields ?? {}) : {};
}

// ---------------------------------------------------------------------------
// Modal (native <dialog>: focus trap, Escape and backdrop for free)
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/50 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      {open ? (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-5" />
            </IconButton>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
