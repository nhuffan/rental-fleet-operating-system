"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
export { DateControl as DateInput } from "./field-controls";

export function FilterBar({
  className = "",
  busy = false,
  children,
  onReset,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { busy?: boolean }) {
  const [resetVersion, setResetVersion] = useState(0);
  return (
    <form
      key={resetVersion}
      className={`filter-bar ${className}`}
      aria-busy={busy || undefined}
      onReset={(event) => {
        onReset?.(event);
        // Remount custom and native controls together, including unapplied drafts.
        if (!event.defaultPrevented) setResetVersion((version) => version + 1);
      }}
      {...props}
    >
      {children}
    </form>
  );
}

export function SearchField({
  label = "Tìm kiếm",
  hideLabel = false,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hideLabel?: boolean;
}) {
  return (
    <label className={`form-field search-field ${className}`}>
      <span className={hideLabel ? "sr-only" : "control-label"}>{label}</span>
      <span className="search-input">
        <Icon name="search" />
        <input type="search" {...props} />
      </span>
    </label>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };
export function Combobox({
  id,
  name,
  label,
  options,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  searchable = false,
  hideLabel = false,
  disabled = false,
  loading = false,
  placeholder = "Chọn một mục…",
  className = "",
  popoverWidth = "default",
}: {
  id?: string;
  name?: string;
  label: string;
  options: SelectOption[];
  defaultValue?: string | number;
  value?: string;
  onValueChange?: (value: string) => void;
  searchable?: boolean;
  hideLabel?: boolean;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  popoverWidth?: "default" | "content";
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const listId = `${controlId}-options`;
  const labelId = `${controlId}-label`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 220,
    triggerWidth: 0,
    maxHeight: 260,
  });
  const updatePosition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(
      popoverWidth === "content"
        ? (popover.current?.getBoundingClientRect().width ?? rect.width)
        : Math.min(Math.max(rect.width, 220), 360),
      window.innerWidth - 32,
    );
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const height = Math.min(320, Math.max(below, above));
    const placeAbove = below < 200 && above > below;
    setPosition({
      left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
      top: placeAbove ? Math.max(16, rect.top - height - 6) : rect.bottom + 6,
      width,
      triggerWidth: Math.min(rect.width, window.innerWidth - 32),
      maxHeight: placeAbove ? height : Math.max(120, below),
    });
  }, [popoverWidth]);
  const search = useRef<HTMLInputElement>(null);
  const [internalValue, setValue] = useState(String(defaultValue));
  const value = controlledValue ?? internalValue;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matching = options.filter((option) =>
    option.label
      .toLocaleLowerCase("vi")
      .includes(query.trim().toLocaleLowerCase("vi")),
  );
  const enabled = matching.filter((option) => !option.disabled);
  const activeOption = enabled[Math.min(active, enabled.length - 1)];
  const selected = options.find((option) => option.value === value);

  // Content-sized menus need their rendered width for viewport collision checks.
  useLayoutEffect(() => {
    if (open && popoverWidth === "content") updatePosition();
  }, [open, popoverWidth, updatePosition]);

  useEffect(() => {
    if (!open) return;
    if (searchable) search.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popover.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, searchable, updatePosition]);
  useEffect(() => {
    if (open && activeOption) {
      document
        .getElementById(`${listId}-${options.indexOf(activeOption)}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeOption, listId, options]);

  function show(last = false) {
    if (disabled || loading) return;
    updatePosition();
    setPortalHost(root.current?.closest("dialog") ?? document.body);
    setQuery("");
    const available = options.filter((option) => !option.disabled);
    const selectedIndex = available.findIndex(
      (option) => option.value === value,
    );
    setActive(
      last ? Math.max(0, available.length - 1) : Math.max(0, selectedIndex),
    );
    setOpen(true);
  }
  function choose(next: string) {
    if (disabled || loading) return;
    setValue(next);
    onValueChange?.(next);
    setOpen(false);
    trigger.current?.focus();
  }
  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") {
      if (searchable && open) trigger.current?.focus();
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) show(event.key === "ArrowUp");
      else
        setActive((current) =>
          enabled.length
            ? (current +
                (event.key === "ArrowDown" ? 1 : -1) +
                enabled.length) %
              enabled.length
            : 0,
        );
    } else if (
      (event.key === "Enter" || (event.key === " " && !searchable)) &&
      open
    ) {
      event.preventDefault();
      if (activeOption) choose(activeOption.value);
    } else if (
      open &&
      !searchable &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const index = enabled.findIndex((option) =>
        option.label
          .toLocaleLowerCase("vi")
          .startsWith(event.key.toLocaleLowerCase("vi")),
      );
      if (index >= 0) setActive(index);
    }
  }
  const activeId = activeOption
    ? `${listId}-${options.indexOf(activeOption)}`
    : undefined;
  return (
    <div
      className={`form-field control-combobox ${className}`}
      ref={root}
      onKeyDown={handleKey}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null) &&
          !popover.current?.contains(event.relatedTarget as Node | null)
        )
          setOpen(false);
      }}
    >
      <label
        id={labelId}
        htmlFor={controlId}
        className={hideLabel ? "sr-only" : "control-label"}
      >
        {label}
      </label>
      {name && (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
      <button
        ref={trigger}
        id={controlId}
        type="button"
        className="combobox-trigger form-control"
        role={searchable ? undefined : "combobox"}
        aria-labelledby={`${labelId} ${controlId}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable ? activeId : undefined}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span id={`${controlId}-value`} title={selected?.label}>
          {loading ? "Đang tải…" : selected?.label || placeholder}
        </span>
        <Icon name="chevron" size={15} />
      </button>
      {open &&
        portalHost &&
        createPortal(
          <div
            ref={popover}
            className="combobox-popover"
            data-width={popoverWidth}
            style={{
              left: position.left,
              top: position.top,
              width:
                popoverWidth === "content" ? "max-content" : position.width,
              minWidth:
                popoverWidth === "content" ? position.triggerWidth : undefined,
              maxHeight: position.maxHeight,
            }}
            onBlur={(event) => {
              if (
                !root.current?.contains(event.relatedTarget as Node | null) &&
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setOpen(false);
            }}
          >
            {searchable && (
              <div className="combobox-search">
                <Icon name="search" size={16} />
                <input
                  ref={search}
                  type="search"
                  role="combobox"
                  aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
                  aria-autocomplete="list"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  placeholder="Tìm trong danh sách…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                />
              </div>
            )}
            <div
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              className="combobox-options"
            >
              {matching.map((option) => (
                <div
                  key={option.value}
                  id={`${listId}-${options.indexOf(option)}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  className={`combobox-option ${activeOption === option ? "is-active" : ""}`}
                  onPointerMove={() => {
                    const index = enabled.indexOf(option);
                    if (index >= 0) setActive(index);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!option.disabled) choose(option.value);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Icon name="check" size={16} />}
                </div>
              ))}
            </div>
            {!matching.length && (
              <p className="combobox-empty" role="status">
                Không có kết quả phù hợp.
              </p>
            )}
          </div>,
          portalHost,
        )}
    </div>
  );
}
