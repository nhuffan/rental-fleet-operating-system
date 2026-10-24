"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./primitives";
import { Icon } from "./icon";

const CloseContext = createContext<(() => void) | null>(null);
function snapshot(dialog: HTMLDialogElement) {
  return JSON.stringify(
    Array.from(
      dialog.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea"),
    )
      .filter(
        (control) =>
          control.name &&
          control.type !== "search" &&
          !control.closest("[data-dirty-ignore]"),
      )
      .map((control) => [
        control.name,
        control.type,
        control.value,
        control instanceof HTMLInputElement &&
        ["checkbox", "radio"].includes(control.type)
          ? control.checked
          : null,
      ]),
  );
}
type DialogProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  footer?: ReactNode;
  size?: "medium" | "wide";
  dirty?: boolean;
};
function DialogShell({
  title,
  description,
  children,
  onClose,
  busy = false,
  footer,
  size = "medium",
  dirty,
  confirm = false,
}: DialogProps & { confirm?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const initial = useRef<string | null>(null);
  const editorFocus = useRef<HTMLElement | null>(null);
  const [changed, setChanged] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const titleId = useId();
  const descriptionId = `${titleId}-description`;
  const requestClose = useCallback(() => {
    if (busy) return;
    if (!confirm && (dirty || changed)) {
      editorFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setDiscarding(true);
    } else onClose();
  }, [busy, confirm, dirty, changed, onClose]);
  useEffect(() => {
    const dialog = ref.current;
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!dialog) return;
    dialog.showModal();
    initial.current = snapshot(dialog);
    return () => {
      dialog.close();
      if (trigger.current?.isConnected) trigger.current.focus();
    };
  }, []);
  useEffect(() => {
    if (discarding)
      ref.current
        ?.querySelector<HTMLButtonElement>("[data-keep-editing]")
        ?.focus();
  }, [discarding]);
  useEffect(() => {
    if (confirm || !(dirty || changed)) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [confirm, dirty, changed]);
  function keepEditing() {
    setDiscarding(false);
    requestAnimationFrame(() => {
      if (editorFocus.current?.isConnected) editorFocus.current.focus();
      else
        ref.current
          ?.querySelector<HTMLElement>(
            ".form-dialog-body :is(input:not(.native-control-bridge),button,textarea)",
          )
          ?.focus();
    });
  }
  function trackChanges() {
    // Read after React's controlled value handlers have completed.
    queueMicrotask(() => {
      if (ref.current && initial.current !== null)
        setChanged(snapshot(ref.current) !== initial.current);
    });
  }
  return (
    <CloseContext.Provider value={requestClose}>
      <dialog
        ref={ref}
        className={`form-dialog ${confirm ? "confirm-dialog" : `form-dialog-${size}`}`}
        aria-labelledby={titleId}
        aria-describedby={
          description && !discarding ? descriptionId : undefined
        }
        aria-busy={busy || undefined}
        role={discarding ? "alertdialog" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          if (discarding) keepEditing();
          else requestClose();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          // An unoccupied interior area is not a backdrop click.
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            requestClose();
        }}
        onInputCapture={trackChanges}
        onChangeCapture={trackChanges}
        onResetCapture={trackChanges}
      >
        <div className="form-dialog-frame">
          <header className="form-dialog-heading">
            <div>
              <h2 id={titleId}>
                {discarding ? "Bỏ thay đổi chưa lưu?" : title}
              </h2>
              {description && !discarding && (
                <p id={descriptionId}>{description}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Đóng hộp thoại"
              disabled={busy}
              onClick={discarding ? keepEditing : requestClose}
            >
              <Icon name="close" />
            </Button>
          </header>
          <div
            className="form-dialog-body"
            inert={discarding || undefined}
            hidden={discarding}
          >
            {children}
          </div>
          {footer && (
            <footer
              className="form-dialog-footer"
              inert={discarding || undefined}
              hidden={discarding}
            >
              {footer}
            </footer>
          )}
          {discarding && (
            <>
              <div className="form-dialog-discard">
                <span className="dialog-symbol">
                  <Icon name="alert" size={24} />
                </span>
                <p>
                  Những thay đổi trong biểu mẫu này chưa được lưu. Bạn có thể
                  tiếp tục chỉnh sửa hoặc bỏ thay đổi.
                </p>
              </div>
              <footer className="form-dialog-footer">
                <Button
                  type="button"
                  variant="secondary"
                  data-keep-editing
                  onClick={keepEditing}
                >
                  Tiếp tục chỉnh sửa
                </Button>
                <Button type="button" onClick={onClose}>
                  Bỏ thay đổi
                </Button>
              </footer>
            </>
          )}
        </div>
      </dialog>
    </CloseContext.Provider>
  );
}
export function FormDialog(props: DialogProps) {
  return <DialogShell {...props} />;
}
export function ConfirmDialog(props: Omit<DialogProps, "size" | "dirty">) {
  return <DialogShell {...props} confirm />;
}
export function DialogActions({
  formId,
  busy = false,
  onCancel,
  onSubmit,
  submitLabel = "Lưu thay đổi",
  cancelLabel = "Hủy",
  submitDisabled = false,
}: {
  formId?: string;
  busy?: boolean;
  onCancel?: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
}) {
  const requestClose = useContext(CloseContext);
  return (
    <div className="dialog-actions">
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={requestClose ?? onCancel}
      >
        {cancelLabel}
      </Button>
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        loading={busy}
        disabled={submitDisabled}
        onClick={formId ? undefined : onSubmit}
      >
        {busy ? "Đang xử lý…" : submitLabel}
      </Button>
    </div>
  );
}
