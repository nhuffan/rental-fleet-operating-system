"use client";
import { Button, Select } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import type { MovementKind } from "./types";
export function MovementActions({
  onSelect,
  rentalOnly = false,
  disabled = false,
}: {
  onSelect: (kind: MovementKind) => void;
  rentalOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="commercial-actions">
      <Button disabled={disabled} onClick={() => onSelect("RENTAL_PAYMENT")}>
        <Icon name="plus" size={16} /> Thu tiền thuê
      </Button>
      {!rentalOnly && (
        <>
          <Button
            disabled={disabled}
            variant="secondary"
            onClick={() => onSelect("MISC_INCOME")}
          >
            Thêm khoản thu
          </Button>
          <Button
            disabled={disabled}
            variant="secondary"
            onClick={() => onSelect("EXPENSE")}
          >
            Thêm chi phí
          </Button>
        </>
      )}
      <Select
        aria-label="Thao tác tiền cọc"
        value=""
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value) onSelect(event.target.value as MovementKind);
        }}
      >
        <option value="" disabled>
          Tiền cọc…
        </option>
        <option value="DEPOSIT_RECEIPT">Nhận cọc</option>
        <option value="DEPOSIT_REFUND">Hoàn cọc</option>
        <option value="DEPOSIT_RETAIN">Giữ lại cọc</option>
      </Select>
    </div>
  );
}
