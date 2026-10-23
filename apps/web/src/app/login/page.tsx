import { safeReturnPath } from "@/lib/auth-navigation";
import { LoginForm } from "./login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const destination = safeReturnPath((await searchParams).next);
  return <LoginForm destination={destination} />;
}
