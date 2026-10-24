import type {
  ButtonHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { Icon, type IconName } from "./icon";
export {
  InputControl as Input,
  SelectControl as Select,
} from "./field-controls";
export function Button({
  variant = "primary",
  className = "",
  size = "medium",
  loading = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "small" | "medium" | "large";
  loading?: boolean;
}) {
  return (
    <button
      className={`button button-${variant} button-${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    />
  );
}
export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
  className?: string;
}) {
  return (
    <span className={`status-badge tone-${tone} ${className}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <Badge tone={active ? "success" : "neutral"}>
      {active ? "Hoạt động" : "Đã vô hiệu hóa"}
    </Badge>
  );
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div className="panel-heading-copy">
        <span className="panel-icon">
          <Icon name={icon} />
        </span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action && <div className="panel-heading-action">{action}</div>}
    </div>
  );
}
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}
export function EmptyState({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ xuất hiện tại đây khi được bổ sung.",
  icon = "search",
  action,
}: {
  title?: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`form-control ${className}`} {...props} />;
}
// Callers connect control aria-describedby/aria-invalid to these stable IDs.
export function FormField({
  id,
  label,
  helper,
  error,
  children,
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {helper && (
        <span id={`${id}-helper`} className="field-helper">
          {helper}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "success" | "danger" | "info" | "warning";
  children: ReactNode;
}) {
  return (
    <p
      className={`notice notice-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
export function LoadingState({
  label = "Đang tải dữ liệu…",
  variant = "list",
  statCount = 3,
}: {
  label?: string;
  variant?: "dashboard" | "list" | "detail" | "map";
  statCount?: 3 | 4;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`loading-state loading-${variant}`}
    >
      <span className="sr-only">{label}</span>
      <div className="loading-heading" aria-hidden="true">
        <Skeleton className="loading-title" />
        <Skeleton className="loading-description" />
      </div>
      {(variant === "dashboard" || variant === "detail") && (
        <div
          className={`loading-stat-grid loading-stats-${statCount}`}
          aria-hidden="true"
        >
          {Array.from({ length: statCount }, (_, item) => (
            <div className="panel loading-stat" key={item}>
              <Skeleton className="loading-short" />
              <Skeleton className="loading-value" />
              <Skeleton className="loading-line" />
            </div>
          ))}
        </div>
      )}
      <div className="panel loading-panel" aria-hidden="true">
        <div className="loading-toolbar">
          <Skeleton className="loading-control" />
          <Skeleton className="loading-control" />
          <Skeleton className="loading-short" />
        </div>
        {variant === "map" ? (
          <div className="loading-map-grid">
            <Skeleton className="loading-map" />
            <div className="loading-map-list">
              {[0, 1, 2].map((item) => (
                <Skeleton className="loading-map-row" key={item} />
              ))}
            </div>
          </div>
        ) : variant === "detail" ? (
          <div className="loading-detail-grid">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <Skeleton className="loading-detail-row" key={item} />
            ))}
          </div>
        ) : (
          <div className="loading-table">
            <Skeleton className="loading-table-heading" />
            {[0, 1, 2, 3, 4].map((item) => (
              <div className="loading-table-row" key={item}>
                <Skeleton />
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// Keep one reserved status line so pending feedback never shifts retained rows.
export function RefreshStatus({
  pending,
  label = "Đang cập nhật kết quả…",
}: {
  pending: boolean;
  label?: string;
}) {
  return (
    <p className="refresh-status" role="status" aria-live="polite">
      {pending ? label : ""}
    </p>
  );
}
export function ErrorState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-body">
      <Notice tone="danger">{message}</Notice>
      {action}
    </div>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ui-tabs" role="group" aria-label="Chọn chế độ xem">
      {items.map((item) => (
        <Button
          key={item.value}
          type="button"
          variant="ghost"
          aria-pressed={value === item.value}
          disabled={item.disabled}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
