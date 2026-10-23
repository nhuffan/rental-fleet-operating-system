import Image from "next/image";

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}
      role="img"
      aria-label="Rental Fleet OS"
    >
      <Image
        src="/brand/mark.png"
        width={199}
        height={172}
        alt=""
        priority
        className="brand-logo"
      />
      {!compact && (
        <span className="brand-wordmark" aria-hidden="true">
          <strong>Rental Fleet</strong>
          <span>Operating System</span>
        </span>
      )}
    </span>
  );
}
