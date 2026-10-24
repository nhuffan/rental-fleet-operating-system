import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/** Shared topbar context for live workspaces and their design reference. */
export function WorkspaceContext({
  icon,
  label,
  preview = false,
  children,
}: {
  icon: IconName;
  label: string;
  preview?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="workspace-context"
      title={preview ? `${label} · Preview` : label}
    >
      <Icon name={icon} />
      {children ?? <span className="workspace-context-label">{label}</span>}
      {preview && <small className="workspace-context-preview">Preview</small>}
    </div>
  );
}
