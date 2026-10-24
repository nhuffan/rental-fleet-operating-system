import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/primitives";
import type { PlatformGps } from "./types";

export function PlatformIdentity({
  name,
  subtitle,
  href,
  kind = "business",
}: {
  name: string;
  subtitle?: string;
  href?: string;
  kind?: "business" | "users";
}) {
  const content = (
    <>
      <span className="platform-record-avatar" aria-hidden="true">
        <Icon name={kind} size={18} />
      </span>
      <span className="platform-record-copy">
        <strong>{name}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="platform-record-identity">
      {content}
    </Link>
  ) : (
    <div className="platform-record-identity">{content}</div>
  );
}

export function PlatformGpsHealth({
  gps,
  compact = false,
}: {
  gps: PlatformGps;
  compact?: boolean;
}) {
  const assigned = gps.FRESH + gps.STALE + gps.OFFLINE + gps.NO_DATA;
  const total = assigned + gps.UNASSIGNED;
  const segments = [
    ["fresh", gps.FRESH],
    ["stale", gps.STALE],
    ["offline", gps.OFFLINE],
    ["no-data", gps.NO_DATA],
    ["unassigned", gps.UNASSIGNED],
  ] as const;
  return (
    <div className={`platform-gps-health${compact ? " is-compact" : ""}`}>
      <div className="platform-gps-heading">
        <strong>
          {gps.FRESH.toLocaleString("vi-VN")}
          <span> / {assigned.toLocaleString("vi-VN")} đã gắn</span>
        </strong>
        <Badge tone={gps.STALE + gps.OFFLINE > 0 ? "warning" : "neutral"}>
          TEST
        </Badge>
      </div>
      <div className="platform-health-track" aria-hidden="true">
        {segments.map(
          ([state, count]) =>
            count > 0 && (
              <span
                key={state}
                className={`health-${state}`}
                style={{ width: `${(count / total) * 100}%` }}
              />
            ),
        )}
      </div>
      <p className="platform-gps-caption">
        {assigned
          ? "Bản tin mới / xe đã gắn thiết bị"
          : "Chưa có xe gắn thiết bị"}
      </p>
      <div className="platform-gps-legend">
        <span>
          <i className="health-fresh" />
          {gps.FRESH} mới
        </span>
        <span>
          <i className="health-stale" />
          {gps.STALE} trễ
        </span>
        <span>
          <i className="health-offline" />
          {gps.OFFLINE} quá 10 phút
        </span>
        <span>
          <i className="health-no-data" />
          {gps.NO_DATA} chưa có bản tin
        </span>
        <span>
          <i className="health-unassigned" />
          {gps.UNASSIGNED} chưa gắn
        </span>
      </div>
    </div>
  );
}
