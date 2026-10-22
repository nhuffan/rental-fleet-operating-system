import type { CSSProperties } from "react";
const paths = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  car: "M5 17H3v-6l2-6h14l2 6v6h-2M5 17h14M5 11h14M6 17v3M18 17v3M6 14h1M17 14h1",
  rental: "M8 3h8v4H8zM6 5H4v16h16V5h-2M8 12h8M8 16h5",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  trip: "M4 4h5v5H4zM15 15h5v5h-5zM9 6h7a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h7",
  wallet: "M20 8V5H4v14h16V8H4M16 11h6v5h-6z",
  business: "M4 21V7h10v14M14 11h6v10M8 11h2M8 15h2M8 19h2M3 21h18M8 7V3h6v4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 2h4l1 4 4-1 2 4-3 3 3 3-2 4-4-1-1 4h-4l-1-4-4 1-2-4 3-3-3-3 2-4 4 1z",
  audit: "M4 3h16v18H4zM8 7h8M8 11h8M8 15h4",
  chevron: "m9 5 7 7-7 7",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16m6-2 5 5",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6zM8 12l3 3 5-6",
  signal: "M3 20v-3M9 20v-7M15 20V9M21 20V4",
  calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 11h16",
  check: "m5 12 4 4L19 6",
  alert: "m12 3 10 18H2zM12 9v5M12 17v1",
  globe:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2c-6 6-6 14 0 20 6-6 6-14 0-20",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
