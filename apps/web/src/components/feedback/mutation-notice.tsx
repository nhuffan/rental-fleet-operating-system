import { Notice } from "@/components/ui/primitives";
export function MutationNotice({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <div aria-live="polite">
      {error && <Notice tone="danger">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
    </div>
  );
}
