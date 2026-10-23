import "server-only";
import { cache } from "react";
import { serverClient } from "./supabase/server";

export const verifiedAccountEmail = cache(async () => {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.email;
});
