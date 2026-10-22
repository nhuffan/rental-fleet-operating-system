"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./primitives";
import { Icon } from "./icon";
export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [title]);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-inner">
        <div className="drawer-heading">
          <h2 id={titleId}>{title}</h2>
          <Button
            variant="ghost"
            type="button"
            aria-label="Đóng bảng chi tiết"
            onClick={onClose}
          >
            <Icon name="close" />
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
