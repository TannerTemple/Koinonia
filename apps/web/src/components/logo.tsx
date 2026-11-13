/** Three interlocking rings: communion. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1B2F66" />
      <circle cx="16" cy="12" r="5.5" stroke="#fff" strokeWidth="1.8" />
      <circle cx="11.5" cy="19.5" r="5.5" stroke="#E0B458" strokeWidth="1.8" />
      <circle cx="20.5" cy="19.5" r="5.5" stroke="#8AD3B1" strokeWidth="1.8" />
    </svg>
  );
}
