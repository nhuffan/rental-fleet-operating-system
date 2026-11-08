import { useId } from "react";

// carBase identity (design/brand-identity.html): a navy "C" joined with an orange "B".
// The horizontal gap through the B is a mask, so the mark works on any surface and theme.
export function BrandMark({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={id}>
          <rect width="64" height="64" fill="#fff" />
          <rect x="29" y="30.4" width="30" height="3.2" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <path
          d="M30 14.5A19 19 0 1 0 30 49.5"
          fill="none"
          stroke="var(--brand-c)"
          strokeWidth="10"
        />
        <g
          fill="none"
          stroke="var(--brand-b)"
          strokeWidth="10"
          strokeLinejoin="round"
        >
          <path d="M33 11v42" />
          <path d="M33 16h9a8.5 8.5 0 0 1 0 17h-9" />
          <path d="M33 33h11a9 9 0 0 1 0 18h-11" />
        </g>
      </g>
    </svg>
  );
}

export function BrandLockup({
  compact = false,
  tagline = false,
  tone = "auto",
}: {
  /** Mark only. */
  compact?: boolean;
  /** Adds "The Foundation of Fleet Management" under the wordmark. */
  tagline?: boolean;
  /** "light"/"dark" force a palette for always-light/always-dark surfaces. */
  tone?: "auto" | "light" | "dark";
}) {
  return (
    <span
      className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}
      data-tone={tone}
      role="img"
      aria-label="carBase"
    >
      <span className="brand-line">
        <BrandMark />
        {!compact && (
          <span className="brand-wordmark" aria-hidden="true">
            <span className="brand-c">car</span>
            <span className="brand-b">Base</span>
          </span>
        )}
      </span>
      {tagline && !compact && (
        <span className="brand-tagline" aria-hidden="true">
          The Foundation of Fleet Management
        </span>
      )}
    </span>
  );
}
