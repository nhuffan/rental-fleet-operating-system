import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand-lockup";
import {
  contactAction,
  faq,
  features,
  gpsPoints,
  navLinks,
  roles,
  steps,
  stripItems,
} from "./content";
import "@/styles/landing.css";

const icons: Record<string, React.ReactNode> = {
  car: (
    <>
      <path d="M5 17h14M6 17l1.5-6h9L18 17M7.5 11l1-3h7l1 3" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="16" cy="17" r="1.5" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4M10 12h6M10 16h6" />
    </>
  ),
  check: (
    <>
      <path d="M9 11l2 2 4-4" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </>
  ),
  chart: <path d="M4 18V9M10 18V5M16 18v-7M21 18H3" />,
  pin: (
    <>
      <path d="M12 3a6 6 0 0 1 6 6c0 4-6 12-6 12S6 13 6 9a6 6 0 0 1 6-6z" />
      <circle cx="12" cy="9" r="2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
};

const mockRows = [
  ["51H-123.45", "Nguyễn Văn A", "Đang thuê", "br"],
  ["30K-678.90", "Trả xe 09/11", "Sắp đến hạn", "warn"],
  ["29A-246.80", "Chi nhánh Q.1", "Sẵn sàng", "ok"],
  ["51G-555.12", "Bảo hiểm còn 12 ngày", "Nhắc gia hạn", "info"],
] as const;

export function LandingPage({ contactEmail }: { contactEmail?: string }) {
  const contact = contactAction(contactEmail);
  return (
    <div className="landing">
      <header className="lp-nav">
        <div className="lp-wrap">
          <Link href="/" className="lp-logo" aria-label="carBase">
            <BrandLockup tone="light" />
          </Link>
          <nav aria-label="Điều hướng trang giới thiệu">
            <ul>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="lp-act">
            <Link className="lp-btn lp-btn-s lp-btn-sm" href="/login">
              Đăng nhập
            </Link>
            <a className="lp-btn lp-btn-p lp-btn-sm" href={contact.href}>
              {contact.href === "/login" ? "Bắt đầu" : contact.label}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap">
            <div>
              <span className="lp-pill">Cho doanh nghiệp cho thuê xe</span>
              <h1>
                Đặt nền móng cho <em>vận hành đội xe</em> của bạn
              </h1>
              <p className="lp-lead">
                Từ báo giá, hợp đồng, bàn giao xe đến thu chi và cảnh báo giấy
                tờ — gọn trong một hệ thống, dữ liệu của mỗi doanh nghiệp được
                tách biệt hoàn toàn.
              </p>
              <div className="lp-cta">
                <a className="lp-btn lp-btn-p" href={contact.href}>
                  {contact.href === "/login" ? "Bắt đầu" : contact.label}
                </a>
                <a className="lp-btn lp-btn-s" href="#tinh-nang">
                  Xem tính năng
                </a>
              </div>
              <p className="lp-note">
                Hợp đồng và biên bản bàn giao in A4 để ký tay.
              </p>
            </div>
            <div className="lp-mock" aria-hidden="true">
              <div className="lp-mock-bar">
                <i />
                <i />
                <i />
              </div>
              <div className="lp-mock-body">
                <div className="lp-mock-kpis">
                  <div>
                    <small>Xe đang thuê</small>
                    <b>24 / 31</b>
                  </div>
                  <div>
                    <small>Doanh thu tháng</small>
                    <b style={{ color: "var(--orange-strong)" }}>186 tr</b>
                  </div>
                  <div>
                    <small>Cảnh báo</small>
                    <b>3</b>
                  </div>
                </div>
                {mockRows.map(([plate, detail, label, tone]) => (
                  <div className="lp-mock-row" key={plate}>
                    <span>{plate}</span>
                    <span>{detail}</span>
                    <span className={`lp-badge lp-b-${tone}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="lp-strip">
          <div className="lp-wrap">
            {stripItems.map(([title, text]) => (
              <div key={title}>
                <b>{title}</b>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <section id="tinh-nang">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <span className="lp-eyebrow">Tính năng</span>
              <h2>Mọi thứ để vận hành đội xe, trong một nơi</h2>
              <p className="lp-lead">
                Thay bảng tính rời rạc và giấy tờ thủ công bằng một quy trình
                xuyên suốt.
              </p>
            </div>
            <div className="lp-feat">
              {features.map((feature) => (
                <div className="lp-card" key={feature.title}>
                  <div className="lp-ic">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {icons[feature.icon]}
                    </svg>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="quy-trinh" className="lp-alt">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <span className="lp-eyebrow">Quy trình</span>
              <h2>Từ báo giá đến đối soát, một mạch liền</h2>
            </div>
            <div className="lp-steps">
              {steps.map(([title, text]) => (
                <div className="lp-step" key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="vai-tro">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <span className="lp-eyebrow">Vai trò</span>
              <h2>Mỗi người một cổng, quyền được kiểm soát ở máy chủ</h2>
              <p className="lp-lead">
                Quyền truy cập được xác thực phía máy chủ — không dựa vào thông
                tin do người dùng tự khai.
              </p>
            </div>
            <div className="lp-roles">
              {roles.map((role) => (
                <div
                  className={`lp-role${role.highlight ? " lp-hl" : ""}`}
                  key={role.tag}
                >
                  <span className="lp-tag">{role.tag}</span>
                  <h3>{role.title}</h3>
                  <ul>
                    {role.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="gps" className="lp-alt">
          <div className="lp-wrap lp-split">
            <div>
              <span className="lp-eyebrow">GPS · Thử nghiệm</span>
              <h2>Biết xe đang ở đâu, đã đi những đâu</h2>
              <p className="lp-lead">
                Nhận vị trí qua Traccar, xem lại tuyến đường suy ra từ dữ liệu
                GPS và nhận cảnh báo khi bản tin bị trễ.
              </p>
              <ul className="lp-checks">
                {gpsPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <p className="lp-fine">
                Tính năng đang ở chế độ thử nghiệm; tích hợp thiết bị thực tế sẽ
                được bổ sung.
              </p>
            </div>
            <div className="lp-map" aria-hidden="true">
              <svg viewBox="0 0 500 340" preserveAspectRatio="none">
                <path
                  d="M40 290C120 250 130 150 220 140S330 200 380 110 450 60 470 40"
                  fill="none"
                  stroke="#ad4511"
                  strokeWidth="4"
                  strokeDasharray="2 10"
                  strokeLinecap="round"
                />
              </svg>
              <div className="lp-pin" style={{ left: "6%", top: "78%" }}>
                <i />
                Chi nhánh
              </div>
              <div className="lp-pin" style={{ left: "66%", top: "28%" }}>
                <i />
                51H-123.45
              </div>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="lp-wrap">
            <div className="lp-sec-head">
              <span className="lp-eyebrow">Câu hỏi thường gặp</span>
              <h2>Giải đáp nhanh</h2>
            </div>
            <div className="lp-faq">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="lien-he" style={{ paddingTop: 0 }}>
          <div className="lp-wrap">
            <div className="lp-cta-band lp-dark">
              <div>
                <h2>Sẵn sàng đặt nền móng cho đội xe?</h2>
                <p>The Foundation of Fleet Management</p>
              </div>
              <a className="lp-btn lp-btn-o" href={contact.href}>
                {contact.label}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="lp-wrap">
          <span className="lp-logo">
            <BrandLockup tone="light" />
          </span>
          <nav aria-label="Liên kết chân trang">
            <a href="#tinh-nang">Tính năng</a>
            <a href="#vai-tro">Vai trò</a>
            <a href="#faq">Câu hỏi</a>
            <Link href="/login">Đăng nhập</Link>
          </nav>
          <span>© 2026 carBase</span>
        </div>
      </footer>
    </div>
  );
}
