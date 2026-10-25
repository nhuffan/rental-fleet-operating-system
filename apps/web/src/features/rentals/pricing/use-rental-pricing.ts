"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pricingRequest, PricingError } from "./client";
import {
  PRICING_TIME_ZONE,
  quoteRequestKey,
  currentQuoteSnapshot,
  settleQuoteRequest,
  validVnd,
  type BillingMode,
} from "./policy";
import type { PricingQuote, RentalPricingSelection } from "./types";

type PricingInput = {
  businessId: string;
  vehicleId: string;
  startAt: string;
  endAt: string;
  currency: string;
  enabled?: boolean;
  initial?: RentalPricingSelection | null;
};
export function useRentalPricing({
  businessId,
  vehicleId,
  startAt,
  endAt,
  currency,
  enabled = true,
  initial,
}: PricingInput) {
  const router = useRouter();
  const [billingMode, setBillingMode] = useState<BillingMode | "AUTO">(
    initial?.billingMode ?? "AUTO",
  );
  const scope = quoteRequestKey({
    businessId,
    vehicleId,
    startAt,
    endAt,
    billingMode: billingMode === "AUTO" ? undefined : billingMode,
  });
  const [agreement, setAgreement] = useState({
    scope,
    override: initial?.overrideAmount !== undefined,
    amount: initial?.overrideAmount ?? "",
    reason: initial?.overrideReason ?? "",
  });
  const current =
    agreement.scope === scope
      ? agreement
      : { scope, override: false, amount: "", reason: "" };
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${scope}:${attempt}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    quote?: PricingQuote;
    error?: string;
  } | null>(null);
  const valid =
    enabled &&
    currency === "VND" &&
    !!vehicleId &&
    !!startAt &&
    !!endAt &&
    new Date(endAt).getTime() > new Date(startAt).getTime();
  const result = valid ? currentQuoteSnapshot(snapshot, requestKey) : null;
  const quote = result?.quote ?? null;
  const pending = valid && !result;
  const error = result?.error ?? "";
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    void settleQuoteRequest(
      controller.signal,
      () =>
        pricingRequest<PricingQuote>(
          businessId,
          "/pricing/quote",
          "POST",
          {
            vehicleId,
            startAt,
            endAt,
            timeZone: PRICING_TIME_ZONE,
            ...(billingMode !== "AUTO" ? { billingMode } : {}),
          },
          controller.signal,
        ),
      (quote) => setSnapshot({ key: requestKey, quote }),
      (cause) => {
        if (cause instanceof PricingError && cause.status === 401)
          router.replace("/login");
        setSnapshot({
          key: requestKey,
          error:
            cause instanceof PricingError
              ? cause.message
              : "Chưa thể tải báo giá. Kiểm tra kết nối và thử lại.",
        });
      },
    );
    return () => controller.abort();
  }, [
    valid,
    businessId,
    vehicleId,
    startAt,
    endAt,
    billingMode,
    requestKey,
    router,
  ]);
  const manual = current.override || (quote !== null && !quote.available);
  const agreedAmount = manual ? current.amount : (quote?.totalAmount ?? "");
  const manualValid =
    validVnd(current.amount) && current.reason.trim().length >= 3;
  const selection: RentalPricingSelection | null =
    quote && !pending && !error && (!manual || manualValid)
      ? {
          expectedQuoteHash: quote.quoteHash,
          ...(quote.billingMode
            ? { billingMode: quote.billingMode }
            : billingMode !== "AUTO"
              ? { billingMode }
              : {}),
          ...(manual
            ? {
                overrideAmount: current.amount,
                overrideReason: current.reason.trim(),
              }
            : {}),
        }
      : null;
  return {
    quote,
    pending,
    error,
    billingMode,
    setBillingMode,
    manual,
    agreedAmount,
    selection,
    override: current.override,
    amount: current.amount,
    reason: current.reason,
    changeAgreement: (
      patch: Partial<Pick<typeof current, "override" | "amount" | "reason">>,
    ) => setAgreement({ ...current, ...patch }),
    retry: () => setAttempt((value) => value + 1),
  };
}
export type RentalPricingState = ReturnType<typeof useRentalPricing>;
