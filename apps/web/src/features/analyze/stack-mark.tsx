export function StackMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="size-10 shrink-0" fill="none">
      <rect width="40" height="40" rx="10" className="fill-brand-surface" />
      <path
        d="m9 15 11-6 11 6-11 6-11-6Z"
        className="stroke-brand-accent"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9 21 11 6 11-6M9 27l11 6 11-6"
        className="stroke-brand-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
