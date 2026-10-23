import "server-only";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/api";
export async function commercialContext() {
  const context = await currentContext();
  if (!context.permissions.includes("commercial.read"))
    redirect("/access-denied");
  return context;
}
