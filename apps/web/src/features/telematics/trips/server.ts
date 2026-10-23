import "server-only";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/api";
export async function tripContext() {
  const context = await currentContext();
  if (!context.permissions.includes("trip.read")) redirect("/access-denied");
  return context;
}
