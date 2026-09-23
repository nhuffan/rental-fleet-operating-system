import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "../env";
export async function serverClient() {
  const store = await cookies();
  const c = publicEnv();
  return createServerClient(c.url, c.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write cookies; proxy performs refresh before render. */
        }
      },
    },
  });
}
