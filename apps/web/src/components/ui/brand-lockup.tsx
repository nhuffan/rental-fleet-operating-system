import Image from "next/image";
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup ${compact ? "brand-lockup-compact" : ""}`}>
      <Image
        src="/brand/mark.png"
        width={199}
        height={172}
        alt={compact ? "Rental Fleet OS" : ""}
        priority
        className="brand-logo"
      />
      {!compact && <strong>Rental Fleet OS</strong>}
    </span>
  );
}
