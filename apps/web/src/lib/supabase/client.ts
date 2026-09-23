"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "../env";
export function browserClient() {
  const c = publicEnv();
  return createBrowserClient(c.url, c.key);
}
