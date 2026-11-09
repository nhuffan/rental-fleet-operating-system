import { Icon, type IconName } from "@/components/ui/icon";

type Tone = "sky" | "peach" | "sand";
const vehicles: { name: string; plate: string; km: string; tone: Tone }[] = [
  { name: "VinFast VF8", plate: "51K-482.19", km: "12.540 km", tone: "sky" },
  { name: "Toyota Camry", plate: "30H-915.62", km: "28.310 km", tone: "peach" },
  { name: "Mazda CX-5", plate: "29A-337.08", km: "9.870 km", tone: "sand" },
];
const rail: IconName[] = ["grid", "car", "rental", "users", "map"];
const bookings = [
  ["Nguyễn Minh An", "VinFast VF8", "Đang thuê"],
  ["Trần Bảo Ngọc", "Toyota Camry", "Đã đặt"],
  ["Lê Quốc Huy", "Mazda CX-5", "Đang thuê"],
];

function CarArt() {
  return (
    <svg viewBox="0 0 120 52" className="as-car" aria-hidden="true">
      <path
        d="M6 38c0-5 3-8 9-9l10-9c3-3 7-4 12-4h24c6 0 10 1 14 5l7 7 18 3c5 1 9 4 9 8v3H6z"
        fill="currentColor"
      />
      <path
        d="M29 29l7-8c2-2 4-3 8-3h15v11zM64 18h6c3 0 5 1 7 3l6 8H64z"
        fill="#fff"
        opacity=".72"
      />
      <circle cx="30" cy="40" r="8" fill="#2e3540" />
      <circle cx="92" cy="40" r="8" fill="#2e3540" />
      <circle cx="30" cy="40" r="3" fill="#fff" />
      <circle cx="92" cy="40" r="3" fill="#fff" />
    </svg>
  );
}

/** Decorative, non-interactive preview of the workspace; carries no real data. */
export function AuthShowcase() {
  return (
    <div className="auth-showcase" aria-hidden="true">
      <div className="as-window">
        <div className="as-rail">
          {rail.map((name, index) => (
            <span key={name} className={index === 1 ? "is-on" : undefined}>
              <Icon name={name} size={15} />
            </span>
          ))}
        </div>
        <div className="as-main">
          <div className="as-head">
            <strong>Tổng quan vận hành</strong>
            <span className="as-search">
              <Icon name="search" size={12} /> Tìm kiếm…
            </span>
          </div>
          <div className="as-cars">
            {vehicles.map((car) => (
              <div className={`as-car-card tone-${car.tone}`} key={car.plate}>
                <small>{car.km}</small>
                <CarArt />
                <strong>{car.name}</strong>
                <small>{car.plate}</small>
              </div>
            ))}
          </div>
          <div className="as-list">
            {bookings.map(([customer, car, status]) => (
              <div className="as-row" key={customer}>
                <span className="as-avatar">{customer.slice(0, 1)}</span>
                <b>{customer}</b>
                <span>{car}</span>
                <em data-state={status === "Đang thuê" ? "on" : "wait"}>
                  {status}
                </em>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="as-float">
        <span className="as-float-kicker">
          <Icon name="signal" size={13} /> GPS trực tiếp
        </span>
        <strong>Nguyễn Minh An</strong>
        <div className="as-float-stats">
          <span>
            <small>Quãng đường</small>
            <b>25,6 km</b>
          </span>
          <span>
            <small>Còn lại</small>
            <b>2 ngày</b>
          </span>
        </div>
        <div className="as-float-bar">
          <i />
        </div>
      </div>
    </div>
  );
}
