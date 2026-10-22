import type { Vehicle, Rental } from "./fixtures";
import { Badge } from "@/components/ui/primitives";
import { vehicleLabels, isOverdue } from "./fixtures";
export function VehicleBadge({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Badge
      tone={
        vehicle.status === "AVAILABLE"
          ? "success"
          : vehicle.status === "RENTED"
            ? "info"
            : vehicle.status === "RESERVED"
              ? "brand"
              : "neutral"
      }
    >
      {vehicleLabels[vehicle.status]}
    </Badge>
  );
}
export function GPSBadge({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Badge
      tone={
        vehicle.gps === "ONLINE"
          ? "success"
          : vehicle.gps === "STALE"
            ? "warning"
            : "neutral"
      }
    >
      {vehicle.gps === "ONLINE"
        ? "GPS có tín hiệu*"
        : vehicle.gps === "STALE"
          ? "GPS trễ"
          : "GPS mất kết nối"}
    </Badge>
  );
}
export function RentalBadge({ rental }: { rental: Rental }) {
  return (
    <Badge
      tone={
        isOverdue(rental)
          ? "danger"
          : rental.status === "ACTIVE"
            ? "success"
            : rental.status === "RESERVED"
              ? "brand"
              : "neutral"
      }
    >
      {isOverdue(rental)
        ? "Quá hạn"
        : rental.status === "ACTIVE"
          ? "Đang thuê"
          : rental.status === "RESERVED"
            ? "Đã đặt"
            : "Hoàn tất"}
    </Badge>
  );
}
export function CarIllustration({
  vehicle,
  large = false,
}: {
  vehicle: Vehicle;
  large?: boolean;
}) {
  return (
    <svg
      className={large ? "car-art car-art-large" : "car-art"}
      viewBox="0 0 220 100"
      role="img"
      aria-label={`Hình minh họa xe ${vehicle.model}`}
    >
      <ellipse cx="112" cy="80" rx="86" ry="7" fill="#d8dedf" opacity=".55" />
      <path
        d="M28 52 43 44 68 24h76l31 22 22 8 7 18H20z"
        fill={vehicle.color}
      />
      <path d="m74 29-19 18h48V29zm35 0v18h54l-25-18z" fill="#dce5e6" />
      <path d="M25 59h174v11H23" fill="white" opacity=".18" />
      <rect x="20" y="57" width="18" height="7" rx="2" fill="#e6eddf" />
      <rect x="186" y="56" width="13" height="7" rx="2" fill="#ed9e7d" />
      <circle cx="58" cy="73" r="16" fill="#343b43" />
      <circle cx="58" cy="73" r="9" fill="#c7ccd0" />
      <circle cx="168" cy="73" r="16" fill="#343b43" />
      <circle cx="168" cy="73" r="9" fill="#c7ccd0" />
      <path
        d="M113 53h10"
        stroke="#e7ebee"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
