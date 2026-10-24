"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Logout } from "@/app/app/shell-controls";
import { Icon } from "@/components/ui/icon";

export function UserAccountMenu({
  email,
  role,
  settingsHref,
  settingsLabel = "Cài đặt doanh nghiệp",
  preview = false,
}: {
  email?: string;
  role: string;
  settingsHref?: string;
  settingsLabel?: string;
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  const id = useId();
  const [position, setPosition] = useState({
    left: 12,
    top: 72,
    maxHeight: 300,
  });
  const updatePosition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, window.innerWidth - 24);
    const height = Math.min(
      menu.current?.scrollHeight || 316,
      window.innerHeight - 24,
    );
    const top = Math.max(
      12,
      Math.min(rect.bottom + 8, window.innerHeight - height - 12),
    );
    setPosition({
      left: Math.max(
        12,
        Math.min(rect.right - width, window.innerWidth - width - 12),
      ),
      top,
      maxHeight: Math.max(0, window.innerHeight - top - 12),
    });
  }, []);
  function show(last = false) {
    initialFocus.current = last ? "last" : "first";
    updatePosition();
    setOpen(true);
  }
  const title = email || (preview ? "Design workspace" : "Tài khoản");
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const items = menu.current?.querySelectorAll<HTMLElement>(
      ':is([role="menuitem"],[role="menuitemcheckbox"]):not(:disabled)',
    );
    const focus =
      initialFocus.current === "last" ? items?.[items.length - 1] : items?.[0];
    focus?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(
        menu.current?.querySelectorAll<HTMLElement>(
          ':is([role="menuitem"],[role="menuitemcheckbox"]):not(:disabled)',
        ) ?? [],
      );
      const current = items.indexOf(document.activeElement as HTMLElement);
      const index =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[index]?.focus();
    }
  }
  const content = (
    <>
      <span className="avatar account-avatar" aria-hidden="true">
        <Icon name="user" size={22} />
      </span>
      <span className="account-trigger-copy">
        <strong title={title}>{title}</strong>
        <span>{role}</span>
      </span>
    </>
  );
  if (preview)
    return (
      <div className="account-preview" aria-label="Tài khoản minh họa">
        {content}
      </div>
    );
  return (
    <div
      className="account-menu"
      ref={root}
      onBlur={(event) => {
        if (
          !busy &&
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="account-trigger"
        aria-label={`Tài khoản ${email || title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (open) close();
          else show();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(event.key === "ArrowUp");
          } else if (event.key === "Escape" && open) close();
        }}
      >
        {content}
        <span className="account-chevron">
          <Icon name="chevron" size={14} />
        </span>
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          className="account-popover"
          style={position}
          role="menu"
          aria-label="Menu tài khoản"
          aria-busy={busy}
          onKeyDown={navigate}
        >
          <div className="account-menu-summary" role="presentation">
            <span className="avatar account-avatar" aria-hidden="true">
              <Icon name="user" size={24} />
            </span>
            <div className="account-menu-identity">
              <strong title={title}>{title}</strong>
              <span className="account-role-badge">{role}</span>
            </div>
          </div>
          {settingsHref && (
            <div
              className="account-menu-section"
              role="group"
              aria-label="Không gian làm việc"
            >
              <div className="account-menu-section-label" role="presentation">
                Không gian làm việc
              </div>
              <Link
                role="menuitem"
                className="account-menu-item"
                href={settingsHref}
                onClick={close}
              >
                <span className="account-item-icon">
                  <Icon name="settings" size={18} />
                </span>
                <span className="account-item-copy">
                  <span className="account-item-label">{settingsLabel}</span>
                  <small>Cấu hình hoạt động doanh nghiệp</small>
                </span>
                <span className="account-item-arrow">
                  <Icon name="chevron" size={16} />
                </span>
              </Link>
            </div>
          )}
          <div
            className="account-menu-section"
            role="group"
            aria-label="Giao diện"
          >
            <div className="account-menu-section-label" role="presentation">
              Giao diện
            </div>
            <ThemeToggle />
          </div>
          <div role="separator" className="account-menu-separator" />
          <Logout menuItem onPendingChange={setBusy} />
        </div>
      )}
    </div>
  );
}
