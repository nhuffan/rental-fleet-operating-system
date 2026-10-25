import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/** Shared topbar context for live workspaces and their design reference. */
export function WorkspaceContext({
  icon,
  label,
  preview = false,
  children,
  status,
}: {
  icon?: IconName;
  label: string;
  preview?: boolean;
  children?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div
      className="workspace-context"
      title={preview ? `${label} · Preview` : label}
    >
      {icon && <Icon name={icon} />}
      {children ?? <span className="workspace-context-label">{label}</span>}
      {status}
      {preview && <small className="workspace-context-preview">Preview</small>}
    </div>
  );
}
