import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Download,
  HardDrive,
  Star,
  Image as ImageIcon,
  Maximize,
  Video,
  CarFront,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Globe,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Route,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  Signal,
  Sun,
  TriangleAlert,
  UserRound,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

// Named imports keep the shared aliases typed and the production bundle tree-shakable.
const icons = {
  grid: LayoutDashboard,
  car: CarFront,
  rental: ClipboardList,
  camera: Camera,
  download: Download,
  storage: HardDrive,
  important: Star,
  image: ImageIcon,
  video: Video,
  expand: Maximize,
  users: UsersRound,
  user: UserRound,
  map: Map,
  pin: MapPin,
  trip: Route,
  wallet: Wallet,
  business: Building2,
  settings: Settings2,
  audit: ScrollText,
  chevron: ChevronRight,
  arrow: ArrowRight,
  plus: Plus,
  retry: RotateCcw,
  search: Search,
  close: X,
  menu: Menu,
  clock: Clock3,
  shield: ShieldCheck,
  signal: Signal,
  calendar: CalendarDays,
  check: Check,
  alert: TriangleAlert,
  globe: Globe,
  moon: Moon,
  sun: Sun,
  logout: LogOut,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 18,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      size={size}
      strokeWidth={2}
      aria-hidden="true"
      focusable="false"
      className="ui-icon"
      style={style}
    />
  );
}
