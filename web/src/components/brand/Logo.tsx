export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={className}>
      <rect width="512" height="512" rx="120" fill="#5B4BFF" />
      <path d="M146 236 A110 110 0 0 0 366 236" fill="none" stroke="#FFFFFF" strokeWidth="62" strokeLinecap="round" />
      <circle cx="256" cy="148" r="40" fill="#C6F432" />
    </svg>
  );
}
