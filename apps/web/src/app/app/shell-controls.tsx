"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import { browserClient } from "@/lib/supabase/client";
export function Logout() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <div>
      <button
        className="button button-secondary logout-button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const { error } = await browserClient().auth.signOut();
            if (error) throw error;
            document.cookie =
              "current-business=; Path=/; Max-Age=0; SameSite=Lax";
            router.replace("/login");
            router.refresh();
          } catch {
            setError("Đăng xuất chưa thành công. Vui lòng thử lại.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function BusinessPicker({
  businesses,
  selected,
}: {
  businesses: Me["businesses"];
  selected: string;
}) {
  return (
    <label className="business-picker">
      Doanh nghiệp
      <select
        aria-label="Doanh nghiệp hiện tại"
        value={selected}
        onChange={(e) => {
          document.cookie = `current-business=${encodeURIComponent(e.target.value)}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          // A full reload drops all client state from the previous verified tenant.
          window.location.reload();
        }}
      >
        {businesses.map((b) => (
          <option value={b.id} key={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
