export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const api = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url || !key || !api)
    throw new Error("Missing public Supabase/API configuration");
  new URL(url);
  new URL(api);
  return { url, key, api };
}
