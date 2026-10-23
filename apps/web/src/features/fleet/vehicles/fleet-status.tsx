import { Badge } from "@/components/ui/primitives";
export function FleetStatus({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  return (
    <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>
      {status === "ACTIVE" ? "Hoạt động" : "Ngưng hoạt động"}
    </Badge>
  );
}
