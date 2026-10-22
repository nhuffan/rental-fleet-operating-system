import "server-only";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/api";
export async function rentalContext(
  permission: "customer.read" | "rental.read" | "rental.manage",
) {
  const context = await currentContext();
  if (!context.permissions.includes(permission)) redirect("/access-denied");
  return context;
}
