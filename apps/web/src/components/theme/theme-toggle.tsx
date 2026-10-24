"use client";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";

const preferenceKey = "rental-fleet-theme";
const changeEvent = "rental-fleet-theme-change";
function savedTheme() {
  try {
    const value = localStorage.getItem(preferenceKey);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}
function applySystemTheme() {
  document.documentElement.dataset.theme =
    savedTheme() ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
}
function subscribe(onChange: () => void) {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const updateSystem = () => {
    applySystemTheme();
    onChange();
  };
  const updateStorage = (event: StorageEvent) => {
    if (event.key === preferenceKey || event.key === null) updateSystem();
  };
  system.addEventListener("change", updateSystem);
  window.addEventListener("storage", updateStorage);
  window.addEventListener(changeEvent, onChange);
  return () => {
    system.removeEventListener("change", updateSystem);
    window.removeEventListener("storage", updateStorage);
    window.removeEventListener(changeEvent, onChange);
  };
}
const getSnapshot = () => document.documentElement.dataset.theme === "dark";
const getServerSnapshot = () => false;

export function ThemeSync() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return null;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={dark}
      className="account-menu-item"
      aria-label="Giao diện tối"
      onClick={() => {
        const next = getSnapshot() ? "light" : "dark";
        try {
          localStorage.setItem(preferenceKey, next);
        } catch {
          /* The current document still supports the preference. */
        }
        document.documentElement.dataset.theme = next;
        window.dispatchEvent(new Event(changeEvent));
      }}
    >
      <span className="account-item-icon">
        <Icon name="moon" size={18} />
      </span>
      <span className="account-item-copy">
        <span className="account-item-label">Giao diện tối</span>
        <small>{dark ? "Đang bật" : "Đang tắt"}</small>
      </span>
      <span className="theme-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
