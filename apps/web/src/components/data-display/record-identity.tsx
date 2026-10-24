import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
// Presentation only: callers provide labels and links from their verified data.
export function RecordIdentity({
  label,
  detail,
  icon,
  href,
}: {
  label: string;
  detail?: ReactNode;
  icon: IconName;
  href?: string;
}) {
  const body = (
    <>
      <span className="record-identity-icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="record-identity-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </>
  );
  return href ? (
    <Link className="record-identity" href={href}>
      {body}
    </Link>
  ) : (
    <span className="record-identity">{body}</span>
  );
}
