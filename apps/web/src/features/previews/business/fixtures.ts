// Synthetic, historical design fixtures. Import only through development-gated routes.
export const fixtureNow = new Date("2026-10-22T10:00:00+07:00");
export type VehicleStatus =
  "AVAILABLE" | "RENTED" | "RESERVED" | "MAINTENANCE" | "INACTIVE";
export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  type: string;
  status: VehicleStatus;
  gps: "ONLINE" | "STALE" | "OFFLINE";
  lastSeen: string;
  x: number;
  y: number;
  color: string;
  branch: string;
};
export type Rental = {
  id: string;
  vehicleId: string;
  customer: string;
  start: string;
  end: string;
  status: "RESERVED" | "ACTIVE" | "COMPLETED";
  deposit: number;
};
export const vehicles: Vehicle[] = [
  {
    id: "v1",
    plate: "DEMO 001",
    model: "Toyota Veloz Cross",
    type: "MPV · 7 chỗ",
    status: "RENTED",
    gps: "ONLINE",
    lastSeen: "2026-10-22T09:58:00+07:00",
    x: 54,
    y: 39,
    color: "#7a8d9a",
    branch: "Trung tâm",
  },
  {
    id: "v2",
    plate: "DEMO 002",
    model: "Kia Seltos",
    type: "SUV · 5 chỗ",
    status: "AVAILABLE",
    gps: "ONLINE",
    lastSeen: "2026-10-22T09:59:00+07:00",
    x: 29,
    y: 31,
    color: "#adb5bd",
    branch: "Trung tâm",
  },
  {
    id: "v3",
    plate: "DEMO 003",
    model: "Hyundai Accent",
    type: "Sedan · 5 chỗ",
    status: "RENTED",
    gps: "STALE",
    lastSeen: "2026-10-22T08:35:00+07:00",
    x: 73,
    y: 66,
    color: "#b3a194",
    branch: "Đông thành phố",
  },
  {
    id: "v4",
    plate: "DEMO 004",
    model: "Mitsubishi Xpander",
    type: "MPV · 7 chỗ",
    status: "RESERVED",
    gps: "ONLINE",
    lastSeen: "2026-10-22T09:57:00+07:00",
    x: 41,
    y: 73,
    color: "#676d75",
    branch: "Trung tâm",
  },
  {
    id: "v5",
    plate: "DEMO 005",
    model: "Toyota Vios",
    type: "Sedan · 5 chỗ",
    status: "AVAILABLE",
    gps: "OFFLINE",
    lastSeen: "2026-10-21T16:20:00+07:00",
    x: 19,
    y: 66,
    color: "#a4aaa7",
    branch: "Đông thành phố",
  },
  {
    id: "v6",
    plate: "DEMO 006",
    model: "Ford Territory",
    type: "SUV · 5 chỗ",
    status: "MAINTENANCE",
    gps: "OFFLINE",
    lastSeen: "2026-10-21T14:00:00+07:00",
    x: 81,
    y: 29,
    color: "#89817c",
    branch: "Trung tâm",
  },
  {
    id: "v7",
    plate: "DEMO 007",
    model: "Mazda CX-5",
    type: "SUV · 5 chỗ",
    status: "RENTED",
    gps: "ONLINE",
    lastSeen: "2026-10-22T09:59:00+07:00",
    x: 62,
    y: 81,
    color: "#567381",
    branch: "Đông thành phố",
  },
  {
    id: "v8",
    plate: "DEMO 008",
    model: "Suzuki XL7",
    type: "MPV · 7 chỗ",
    status: "AVAILABLE",
    gps: "ONLINE",
    lastSeen: "2026-10-22T09:56:00+07:00",
    x: 64,
    y: 20,
    color: "#9ca6a8",
    branch: "Trung tâm",
  },
];
export const rentals: Rental[] = [
  {
    id: "HD-1024",
    vehicleId: "v1",
    customer: "Khách minh họa A",
    start: "2026-10-21T08:00:00+07:00",
    end: "2026-10-24T17:00:00+07:00",
    status: "ACTIVE",
    deposit: 5000000,
  },
  {
    id: "HD-1025",
    vehicleId: "v3",
    customer: "Khách minh họa B",
    start: "2026-10-20T08:00:00+07:00",
    end: "2026-10-22T08:00:00+07:00",
    status: "ACTIVE",
    deposit: 3000000,
  },
  {
    id: "HD-1026",
    vehicleId: "v4",
    customer: "Khách minh họa C",
    start: "2026-10-23T08:00:00+07:00",
    end: "2026-10-25T17:00:00+07:00",
    status: "RESERVED",
    deposit: 5000000,
  },
  {
    id: "HD-1027",
    vehicleId: "v7",
    customer: "Khách minh họa D",
    start: "2026-10-21T14:00:00+07:00",
    end: "2026-10-22T17:00:00+07:00",
    status: "ACTIVE",
    deposit: 5000000,
  },
  {
    id: "HD-1028",
    vehicleId: "v2",
    customer: "Khách minh họa E",
    start: "2026-10-24T08:00:00+07:00",
    end: "2026-10-26T17:00:00+07:00",
    status: "RESERVED",
    deposit: 3000000,
  },
];
export const vehicleFor = (id: string) => vehicles.find((v) => v.id === id)!;
export const isOverdue = (r: Rental) =>
  r.status === "ACTIVE" && new Date(r.end) < fixtureNow;
export const isDueSoon = (r: Rental) =>
  r.status === "ACTIVE" &&
  !isOverdue(r) &&
  new Date(r.end).getTime() - fixtureNow.getTime() <= 86400000;
export const vehicleLabels: Record<VehicleStatus, string> = {
  AVAILABLE: "Sẵn sàng",
  RENTED: "Đang thuê",
  RESERVED: "Đã đặt",
  MAINTENANCE: "Bảo dưỡng",
  INACTIVE: "Ngừng hoạt động",
};
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
