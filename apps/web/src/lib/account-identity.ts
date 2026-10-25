import "server-only";
import { verifiedServerAuth } from "./server-auth";

export async function verifiedAccountEmail() {
  return (await verifiedServerAuth())?.email;
}
