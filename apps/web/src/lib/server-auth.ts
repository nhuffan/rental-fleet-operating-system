import "server-only";
import { cache } from "react";
import { serverClient } from "./supabase/server";

// React shares this snapshot only within one server render, never across requests.
// Keep verification before reading the session used to forward the raw bearer.
export const verifiedServerAuth = cache(async () => {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null;
  return { email: user.email, accessToken: session.access_token };
});
