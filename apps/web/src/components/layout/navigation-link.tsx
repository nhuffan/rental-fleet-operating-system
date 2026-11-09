"use client";

import Link, { useLinkStatus } from "next/link";
import { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/ui/icon";
import { LoadingState } from "@/components/ui/primitives";

export const NavigationLoadingTarget = createContext<HTMLElement | null>(null);

type NavigationLinkProps = {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  preview?: boolean;
  unavailable?: boolean;
  onNavigate: () => void;
};

function PageNavigationFeedback({
  href,
  label,
}: Pick<NavigationLinkProps, "href" | "label">) {
  const { pending } = useLinkStatus();
  const target = useContext(NavigationLoadingTarget);
  if (!pending || !target) return null;

  const variant =
    href === "/app" ||
    href === "/superadmin" ||
    /\/(commercial|alerts)$/.test(href)
      ? "dashboard"
      : href.endsWith("/fleet-map")
        ? "map"
        : href.endsWith("/business") || href.endsWith("/settings")
          ? "detail"
          : "list";

  return createPortal(
    <div
      className="workspace-navigation-pending"
      onClick={(event) => event.stopPropagation()}
    >
      <LoadingState
        variant={variant}
        statCount={variant === "dashboard" && !href.endsWith("/alerts") ? 4 : 3}
        label={`Đang mở ${label}…`}
      />
    </div>,
    target,
  );
}

// Next owns pending/cancellation; feedback renders only inside the page, never in the menu.
export function NavigationLink({
  active,
  onNavigate,
  href,
  label,
  icon,
  preview,
  unavailable,
}: NavigationLinkProps) {
  return (
    <Link
      href={href}
      className={`nav-link ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={label}
      onNavigate={onNavigate}
    >
      <Icon name={icon} />
      <span>{label}</span>
      {preview && <small>Preview</small>}
      {unavailable && <small>Chưa có</small>}
      <PageNavigationFeedback href={href} label={label} />
    </Link>
  );
}
