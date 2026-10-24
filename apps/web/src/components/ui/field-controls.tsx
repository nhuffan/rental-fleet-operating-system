"use client";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
import { useControlPopover } from "./control-popover";
import {
  calendarDays,
  dateOnly,
  dateTimeChoice,
  dayString,
  dayWithinBounds,
  parseDay,
} from "./date-control-utils";

type Option = { value: string; label: string; disabled: boolean };
function optionText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? optionText(child.props.children)
        : String(child ?? ""),
    )
    .join("");
}
function readOptions(children: ReactNode, disabled = false): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === "option")
      return [
        {
          value: String(child.props.value ?? optionText(child.props.children)),
          label: optionText(child.props.children),
          disabled: disabled || !!child.props.disabled,
        },
      ];
    return readOptions(
      child.props.children,
      disabled || !!child.props.disabled,
    );
  });
}
function setNativeValue(
  node: HTMLInputElement | HTMLSelectElement,
  value: string,
) {
  const prototype =
    node instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(node, value);
  node.dispatchEvent(
    new Event(node instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
}

function controlValidationMessage(
  node: HTMLInputElement | HTMLSelectElement,
  kind: "select" | "date" | "datetime-local",
) {
  if (node.validity.valueMissing)
    return kind === "select"
      ? "Vui lòng chọn một mục."
      : kind === "date"
        ? "Vui lòng chọn ngày."
        : "Vui lòng chọn ngày và giờ.";
  if (
    node instanceof HTMLInputElement &&
    (node.validity.rangeUnderflow || node.validity.rangeOverflow)
  ) {
    const boundary = node.validity.rangeUnderflow ? node.min : node.max;
    const day = parseDay(boundary);
    const display = day
      ? `${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(day)}${kind === "datetime-local" ? ` · ${boundary.slice(11, 16)}` : ""}`
      : boundary;
    return `Vui lòng chọn ${kind === "date" ? "ngày" : "thời điểm"} ${node.validity.rangeUnderflow ? "từ" : "không muộn hơn"} ${display}.`;
  }
  if (node.validity.stepMismatch)
    return "Thời điểm đã chọn chưa đúng bước thời gian cho phép.";
  return node.validationMessage;
}
function focusFirstInvalid(
  node: HTMLInputElement | HTMLSelectElement,
  trigger: HTMLButtonElement | null,
) {
  const first = node.form?.querySelector(
    "input:invalid,select:invalid,textarea:invalid",
  );
  if (!first || first === node) trigger?.focus();
}

export function SelectControl({
  className = "",
  children,
  value: controlled,
  defaultValue,
  onChange,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId();
  const controlId = id ?? generated;
  const native = useRef<HTMLSelectElement>(null);
  const [invalid, setInvalid] = useState("");
  const listId = `${controlId}-options`;
  const options = useMemo(() => readOptions(children), [children]);
  const initial =
    defaultValue === undefined
      ? (options.find((option) => !option.disabled)?.value ?? "")
      : String(defaultValue);
  const [internal, setInternal] = useState(initial);
  const value = controlled === undefined ? internal : String(controlled);
  const [active, setActive] = useState(0);
  const enabled = options.filter((option) => !option.disabled);
  const selected = options.find((option) => option.value === value);
  const {
    root: rootRef,
    trigger: triggerRef,
    popup: popupRef,
    open,
    host,
    position,
    show: showPopover,
    close,
  } = useControlPopover(220);
  const activeOption =
    enabled[Math.max(0, Math.min(active, enabled.length - 1))];
  const typeAhead = useRef("");
  const lastKey = useRef(0);
  useEffect(() => {
    const form = native.current?.form;
    const reset = () => {
      setInvalid("");
      setInternal(initial);
      close();
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial, close]);
  useEffect(() => {
    if (open && activeOption)
      document
        .getElementById(`${listId}-${options.indexOf(activeOption)}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, activeOption, listId, options]);
  function show(last = false) {
    if (native.current?.matches(":disabled")) return;
    const index = enabled.findIndex((option) => option.value === value);
    setActive(last ? enabled.length - 1 : Math.max(0, index));
    showPopover();
  }
  function choose(next: string) {
    if (!native.current || native.current.matches(":disabled")) return;
    setInvalid("");
    setInternal(next);
    setNativeValue(native.current, next);
    close(true);
  }
  function keyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") close();
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
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
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      if (activeOption) choose(activeOption.value);
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : enabled.length - 1);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      const now = event.timeStamp;
      typeAhead.current =
        `${now - lastKey.current < 700 ? typeAhead.current : ""}${event.key}`.toLocaleLowerCase(
          "vi",
        );
      lastKey.current = now;
      const index = enabled.findIndex((option) =>
        option.label.toLocaleLowerCase("vi").startsWith(typeAhead.current),
      );
      if (index >= 0) {
        event.preventDefault();
        if (!open) show();
        setActive(index);
      }
    }
  }
  if (props.multiple)
    return (
      <select
        className={`form-control ${className}`}
        value={controlled}
        defaultValue={defaultValue}
        onChange={onChange}
        id={id}
        {...props}
      >
        {children}
      </select>
    );
  return (
    <span
      className={`select-control ${className}`}
      ref={rootRef}
      onKeyDown={keyDown}
    >
      <button
        type="button"
        ref={triggerRef}
        id={controlId}
        role="combobox"
        className="form-control select-trigger"
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={
          [
            props["aria-describedby"],
            invalid ? `${controlId}-validation` : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-invalid={props["aria-invalid"] || !!invalid || undefined}
        aria-required={props.required || undefined}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-activedescendant={
          open && activeOption
            ? `${listId}-${options.indexOf(activeOption)}`
            : undefined
        }
        onClick={() => (open ? close() : show())}
      >
        <span className={!selected?.value ? "control-placeholder" : undefined}>
          {selected?.label ?? "Chọn một mục…"}
        </span>
        <Icon name="chevron" size={16} />
      </button>
      <select
        {...props}
        ref={native}
        id={`${controlId}-native`}
        className="native-control-bridge"
        tabIndex={-1}
        aria-hidden="true"
        value={controlled}
        defaultValue={controlled === undefined ? defaultValue : undefined}
        onInvalid={(event) => {
          props.onInvalid?.(event);
          event.preventDefault();
          setInvalid(controlValidationMessage(event.currentTarget, "select"));
          focusFirstInvalid(event.currentTarget, triggerRef.current);
        }}
        onChange={(event) => {
          setInvalid("");
          setInternal(event.currentTarget.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
      {invalid && (
        <span
          id={`${controlId}-validation`}
          className="field-error control-validation"
          role="alert"
        >
          {invalid}
        </span>
      )}
      {open &&
        host &&
        createPortal(
          <div
            ref={popupRef}
            className="combobox-popover select-popover"
            style={position}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div
              id={listId}
              role="listbox"
              aria-label={props["aria-label"] ?? "Các lựa chọn"}
              className="combobox-options"
            >
              {options.map((option, index) => (
                <div
                  key={`${option.value}-${index}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  className={`combobox-option ${option === activeOption ? "is-active" : ""}`}
                  onPointerMove={() => {
                    const index = enabled.indexOf(option);
                    if (index >= 0) setActive(index);
                  }}
                  onClick={() => {
                    if (!option.disabled) choose(option.value);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Icon name="check" size={16} />}
                </div>
              ))}
            </div>
          </div>,
          host,
        )}
    </span>
  );
}

export function DateControl({
  type = "date",
  className = "",
  value: controlled,
  defaultValue,
  onChange,
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "date" | "datetime-local";
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const native = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState("");
  const [internal, setInternal] = useState(String(defaultValue ?? ""));
  const value = String(controlled ?? internal);
  const currentDay = parseDay(value);
  const [month, setMonth] = useState(() => currentDay ?? new Date());
  const [focusDay, setFocusDay] = useState(
    () => dateOnly(value) || dayString(new Date()),
  );
  const {
    root: rootRef,
    trigger: triggerRef,
    popup: popupRef,
    open,
    host,
    position,
    show: showPopover,
    close,
  } = useControlPopover(320);
  const min = props.min === undefined ? undefined : String(props.min);
  const max = props.max === undefined ? undefined : String(props.max);
  const time = value.includes("T") ? value.slice(11, 16) : "00:00";
  const calendarId = `${controlId}-calendar`;
  const days = calendarDays(month);
  useEffect(() => {
    if (open)
      popupRef.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
        ?.focus();
  }, [open, focusDay, popupRef]);
  useEffect(() => {
    const form = native.current?.form;
    const reset = () => {
      setInvalid("");
      setInternal(String(defaultValue ?? ""));
      close();
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, close]);
  function choose(next: string, shouldClose = type === "date") {
    if (
      !native.current ||
      native.current.matches(":disabled") ||
      props.readOnly
    )
      return;
    setInvalid("");
    setInternal(next);
    setNativeValue(native.current, next);
    if (shouldClose) close(true);
  }
  function chooseDay(day: string) {
    choose(type === "date" ? day : dateTimeChoice(day, time, min, max));
  }
  function show() {
    if (native.current?.matches(":disabled") || props.readOnly) return;
    let candidate = currentDay ?? parseDay(min ?? "") ?? new Date();
    if (min && dayString(candidate) < dateOnly(min))
      candidate = parseDay(min) ?? candidate;
    if (max && dayString(candidate) > dateOnly(max))
      candidate = parseDay(max) ?? candidate;
    const candidateDay = dayString(candidate);
    setMonth(candidate);
    setFocusDay(candidateDay);
    showPopover();
  }
  function focusDate(next: Date) {
    const nextDay = dayString(next);
    if (!dayWithinBounds(nextDay, min, max)) return;
    setMonth(next);
    setFocusDay(nextDay);
  }
  function calendarKey(event: KeyboardEvent, day: Date) {
    const movement = (
      { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<
        string,
        number
      >
    )[event.key];
    if (movement) {
      event.preventDefault();
      const next = new Date(day);
      next.setDate(day.getDate() + movement);
      focusDate(next);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = new Date(day);
      const weekDay = (day.getDay() + 6) % 7;
      next.setDate(
        day.getDate() + (event.key === "Home" ? -weekDay : 6 - weekDay),
      );
      focusDate(next);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const next = new Date(day);
      next.setMonth(day.getMonth() + (event.key === "PageUp" ? -1 : 1));
      focusDate(next);
    }
  }
  function navigateMonth(direction: number) {
    const next = new Date(
      month.getFullYear(),
      month.getMonth() + direction,
      1,
      12,
    );
    setMonth(next);
    setFocusDay(dayString(next));
  }
  const display = currentDay
    ? `${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(currentDay)}${type === "datetime-local" ? ` · ${time}` : ""}`
    : "";
  const [today] = useState(() => dayString(new Date()));
  return (
    <span
      className={`date-control ${className}`}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
        if (event.key === "ArrowDown" && !open) {
          event.preventDefault();
          show();
        }
      }}
    >
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        className="form-control date-trigger"
        role="combobox"
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={
          [
            props["aria-describedby"],
            invalid ? `${controlId}-validation` : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-invalid={props["aria-invalid"] || !!invalid || undefined}
        aria-required={props.required || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? calendarId : undefined}
        onClick={() => (open ? close() : show())}
      >
        <span className={!display ? "control-placeholder" : undefined}>
          {display ||
            props.placeholder ||
            (type === "date" ? "Chọn ngày" : "Chọn ngày và giờ")}
        </span>
        <Icon name="calendar" size={18} />
      </button>
      <input
        {...props}
        ref={native}
        id={`${controlId}-native`}
        type={type}
        className="native-control-bridge"
        tabIndex={-1}
        aria-hidden="true"
        value={controlled}
        defaultValue={controlled === undefined ? defaultValue : undefined}
        onChange={(event) => {
          setInvalid("");
          setInternal(event.currentTarget.value);
          onChange?.(event);
        }}
        onInvalid={(event) => {
          props.onInvalid?.(event);
          event.preventDefault();
          setInvalid(controlValidationMessage(event.currentTarget, type));
          focusFirstInvalid(event.currentTarget, triggerRef.current);
        }}
      />
      {invalid && (
        <span
          id={`${controlId}-validation`}
          className="field-error control-validation"
          role="alert"
        >
          {invalid}
        </span>
      )}
      {open &&
        host &&
        createPortal(
          <div
            ref={popupRef}
            id={calendarId}
            role="dialog"
            aria-label="Chọn ngày"
            className="date-popover"
            style={position}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                ) &&
                !rootRef.current?.contains(event.relatedTarget as Node | null)
              )
                close();
            }}
          >
            <div className="calendar-heading">
              <button
                type="button"
                className="calendar-nav"
                aria-label="Tháng trước"
                onClick={() => navigateMonth(-1)}
              >
                <Icon name="chevron" size={18} />
              </button>
              <strong aria-live="polite">
                {new Intl.DateTimeFormat("vi-VN", {
                  month: "long",
                  year: "numeric",
                }).format(month)}
              </strong>
              <button
                type="button"
                className="calendar-nav"
                aria-label="Tháng sau"
                onClick={() => navigateMonth(1)}
              >
                <Icon name="chevron" size={18} />
              </button>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div
              className="calendar-grid"
              role="group"
              aria-label="Ngày trong tháng"
            >
              {days.map((day) => {
                const key = dayString(day);
                return (
                  <button
                    key={key}
                    data-day={key}
                    type="button"
                    tabIndex={key === focusDay ? 0 : -1}
                    disabled={!dayWithinBounds(key, min, max)}
                    aria-label={new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "full",
                    }).format(day)}
                    aria-pressed={key === dateOnly(value)}
                    aria-current={key === today ? "date" : undefined}
                    className={
                      day.getMonth() !== month.getMonth()
                        ? "is-outside"
                        : undefined
                    }
                    onKeyDown={(event) => calendarKey(event, day)}
                    onClick={() => chooseDay(key)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            {type === "datetime-local" && (
              <div className="calendar-time">
                <Icon name="clock" size={17} />
                <span>Giờ</span>
                <input
                  aria-label="Giờ (0–23)"
                  type="number"
                  min={0}
                  max={23}
                  value={Number(time.slice(0, 2))}
                  onChange={(event) => {
                    const hour = Math.min(
                      23,
                      Math.max(0, Number(event.target.value) || 0),
                    );
                    choose(
                      dateTimeChoice(
                        dateOnly(value) || focusDay,
                        `${String(hour).padStart(2, "0")}:${time.slice(3, 5)}`,
                        min,
                        max,
                      ),
                      false,
                    );
                  }}
                />
                <span>:</span>
                <input
                  aria-label="Phút (0–59)"
                  type="number"
                  min={0}
                  max={59}
                  value={Number(time.slice(3, 5))}
                  onChange={(event) => {
                    const minute = Math.min(
                      59,
                      Math.max(0, Number(event.target.value) || 0),
                    );
                    choose(
                      dateTimeChoice(
                        dateOnly(value) || focusDay,
                        `${time.slice(0, 2)}:${String(minute).padStart(2, "0")}`,
                        min,
                        max,
                      ),
                      false,
                    );
                  }}
                />
              </div>
            )}
            <div className="calendar-actions">
              <button
                type="button"
                disabled={!dayWithinBounds(today, min, max)}
                onClick={() => chooseDay(today)}
              >
                Hôm nay
              </button>
              <button type="button" onClick={() => choose("", true)}>
                Xoá
              </button>
              {type === "datetime-local" && (
                <button
                  type="button"
                  className="calendar-done"
                  onClick={() => close(true)}
                >
                  Xong
                </button>
              )}
            </div>
          </div>,
          host,
        )}
    </span>
  );
}
export function InputControl({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type === "date" || props.type === "datetime-local")
    return (
      <DateControl
        {...props}
        className={className}
        type={props.type === "date" ? "date" : "datetime-local"}
      />
    );
  return (
    <input
      className={`${props.type === "checkbox" || props.type === "radio" ? "choice-control" : "form-control"} ${className}`}
      {...props}
    />
  );
}
