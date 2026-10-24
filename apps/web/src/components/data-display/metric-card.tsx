import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

export type MetricTone =
  "neutral" | "success" | "warning" | "danger" | "info" | "brand";

// Presentation only: callers supply values and explain the scope of real data.
export function MetricCard({
  label,
  value,
  description,
  icon,
  tone = "neutral",
  href,
  className = "",
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon: IconName;
  tone?: MetricTone;
  href?: string;
  className?: string;
}) {
  const classes = `panel metric-card metric-tone-${tone} ${className}`;
  const content = (
    <>
      <div className="metric-card-heading">
        <span className="metric-card-label">{label}</span>
        <span className="metric-card-icon">
          <Icon name={icon} size={19} />
        </span>
      </div>
      <strong className="metric-card-value">{value}</strong>
      {description && (
        <div className="metric-card-description">
          <span className="metric-card-indicator" aria-hidden="true" />
          <span>{description}</span>
        </div>
      )}
      {href && (
        <span className="metric-card-link" aria-hidden="true">
          <Icon name="arrow" size={16} />
        </span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <article className={classes}>{content}</article>
  );
}
