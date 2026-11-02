"use client";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
export function PrintButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <Button type="button" disabled={disabled} onClick={() => window.print()}>
      <Icon name="rental" /> In / Lưu PDF
    </Button>
  );
}
