import { Badge } from "@/components/ui/primitives";
const labels: Record<string, string> = {
  DRAFT: "Bản nháp",
  RESERVED: "Đã đặt xe",
  ACTIVE: "Đang thuê",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  AVAILABLE: "Sẵn sàng",
  INACTIVE: "Ngưng hoạt động",
  RENTED: "Đang thuê",
  OVERDUE: "Quá hạn",
};
export function RentalStatus({
  status,
  overdue = false,
}: {
  status: string;
  overdue?: boolean;
}) {
  const value = overdue ? "OVERDUE" : status;
  const tone =
    value === "OVERDUE"
      ? "danger"
      : ["ACTIVE", "RENTED", "AVAILABLE", "COMPLETED"].includes(value)
        ? "success"
        : value === "RESERVED"
          ? "brand"
          : "neutral";
  return <Badge tone={tone}>{labels[value] ?? value}</Badge>;
}
