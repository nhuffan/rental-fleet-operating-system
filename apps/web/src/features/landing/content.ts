// Pure content (no JSX, no aliases) so structure can be tested without rendering.
export const navLinks = [
  { href: "#tinh-nang", label: "Tính năng" },
  { href: "#quy-trinh", label: "Quy trình" },
  { href: "#vai-tro", label: "Vai trò" },
  { href: "#gps", label: "GPS" },
  { href: "#faq", label: "Câu hỏi" },
] as const;

export const stripItems = [
  ["Nhiều doanh nghiệp", "Dữ liệu tách biệt theo từng doanh nghiệp"],
  ["Nhiều chi nhánh", "Quản lý xe theo từng điểm"],
  ["Hợp đồng in A4", "Kèm biên bản kiểm tra xe"],
  ["Nhật ký thay đổi", "Mọi thao tác quản trị đều được ghi lại"],
] as const;

export const features = [
  {
    icon: "car",
    title: "Hồ sơ xe & đội xe",
    text: "Quản lý xe theo chi nhánh, thiết bị GPS và lịch sử gắn thiết bị trên từng xe.",
  },
  {
    icon: "doc",
    title: "Báo giá & hợp đồng",
    text: "Bảng giá theo xe, báo giá hợp đồng, phát hành và in hợp đồng A4 để ký tay.",
  },
  {
    icon: "check",
    title: "Bàn giao & nhận trả",
    text: "Lịch bàn giao, nhận trả xe kèm biên bản kiểm tra tình trạng xe.",
  },
  {
    icon: "chart",
    title: "Thu chi & lợi nhuận",
    text: "Thu chi thực nhận, tiền cọc, phí đường bộ và lợi nhuận ước tính theo xe, theo hợp đồng.",
  },
  {
    icon: "pin",
    title: "Theo dõi GPS",
    text: "Vị trí, lịch sử hành trình và cảnh báo mất tín hiệu qua Traccar (đang ở chế độ thử nghiệm).",
  },
  {
    icon: "alert",
    title: "Cảnh báo & giấy tờ",
    text: "Theo dõi đăng kiểm, bảo hiểm, bảo dưỡng và cảnh báo xe sắp đến hạn trả.",
  },
] as const;

export const steps = [
  ["Báo giá", "Chọn xe, áp bảng giá và gửi báo giá cho khách."],
  ["Hợp đồng", "Phát hành hợp đồng, in A4 và ký tay."],
  ["Bàn giao & nhận trả", "Kiểm tra xe, lập biên bản và theo dõi hành trình."],
  ["Thu chi & báo cáo", "Ghi nhận thu chi, đối soát phí và xem lợi nhuận."],
] as const;

export const roles = [
  {
    tag: "Owner",
    title: "Chủ doanh nghiệp",
    highlight: true,
    items: [
      "Quản lý xe, khách hàng, hợp đồng",
      "Thu chi, báo cáo, xuất CSV",
      "Cài đặt và nhật ký thay đổi",
    ],
  },
  {
    tag: "Customer",
    title: "Khách thuê xe",
    highlight: false,
    items: [
      "Cổng riêng chỉ để xem",
      "Xem và in hợp đồng của chính mình",
      "Không vào được màn hình quản trị",
    ],
  },
  {
    tag: "Superadmin",
    title: "Quản trị nền tảng",
    highlight: false,
    items: [
      "Tạo doanh nghiệp và cấp Owner",
      "Quản lý trạng thái doanh nghiệp",
      "Nhật ký nền tảng tách biệt",
    ],
  },
] as const;

export const gpsPoints = [
  "Vị trí gần nhất của từng xe",
  "Lịch sử hành trình và xem lại tuyến đường",
  "Cảnh báo khi thiết bị ngừng gửi bản tin",
] as const;

export const faq = [
  [
    "Dữ liệu của doanh nghiệp tôi có bị lẫn với doanh nghiệp khác không?",
    "Không. Dữ liệu được phân tách theo doanh nghiệp ở cả API và cơ sở dữ liệu.",
  ],
  [
    "Khách thuê xe có vào được phần quản trị không?",
    "Không. Khách thuê dùng cổng riêng, chỉ xem và in hợp đồng của chính mình.",
  ],
  [
    "Có in được hợp đồng để ký tay không?",
    "Có. Hợp đồng và biên bản bàn giao được tạo ở khổ A4 để in và ký tay.",
  ],
  [
    "GPS đã dùng được với thiết bị thực chưa?",
    "GPS hiện ở chế độ thử nghiệm qua Traccar. Tích hợp thiết bị thực tế sẽ được phát triển tiếp.",
  ],
] as const;

// The contact address is deployment configuration. Without it the call to action falls back to
// the login page rather than inventing an address.
export function contactAction(email: string | undefined) {
  const address = (email ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
    ? { href: `mailto:${address}`, label: "Liên hệ dùng thử" }
    : { href: "/login", label: "Đăng nhập" };
}
