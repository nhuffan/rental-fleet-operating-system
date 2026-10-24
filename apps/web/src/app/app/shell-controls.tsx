"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@rental-fleet/contracts";
import { Combobox } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { WorkspaceContext } from "@/components/layout/workspace-context";
import { browserClient } from "@/lib/supabase/client";
export function Logout({
  menuItem = false,
  onPendingChange,
}: {
  menuItem?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <div>
      <button
        className={
          menuItem
            ? "account-menu-item account-menu-logout"
            : "button button-secondary logout-button"
        }
        role={menuItem ? "menuitem" : undefined}
        aria-busy={pending || undefined}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          onPendingChange?.(true);
          setError("");
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
            onPendingChange?.(false);
          }
        }}
      >
        {menuItem && (
          <span className="account-item-icon">
            <Icon name="logout" size={18} />
          </span>
        )}
        <span className={menuItem ? "account-item-label" : undefined}>
          {pending ? "Đang đăng xuất…" : "Đăng xuất"}
        </span>
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function BusinessSwitcher({
  businesses,
  selected,
}: {
  businesses: Me["businesses"];
  selected: string;
}) {
  return (
    <WorkspaceContext
      icon="business"
      label={
        businesses.find((business) => business.id === selected)?.name ||
        "Doanh nghiệp hiện tại"
      }
    >
      <Combobox
        className="business-switcher"
        id="current-business"
        label="Doanh nghiệp hiện tại"
        hideLabel
        options={businesses.map((business) => ({
          value: business.id,
          label: business.name,
        }))}
        value={selected}
        searchable={businesses.length > 6}
        onValueChange={(id) => {
          if (
            id === selected ||
            !businesses.some((business) => business.id === id)
          )
            return;
          document.cookie = `current-business=${encodeURIComponent(id)}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          // A full reload drops every previous tenant's client state. NestJS validates the membership again.
          window.location.reload();
        }}
      />
    </WorkspaceContext>
  );
}
