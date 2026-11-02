export const PRINT_KINDS = ["contract", "handover", "return"] as const;
export type PrintKind = (typeof PRINT_KINDS)[number];
export const DOCUMENT_PLACEHOLDER = "……………………";
export function isPrintKind(value: string): value is PrintKind {
  return PRINT_KINDS.includes(value as PrintKind);
}
export function documentText(value: string | null | undefined) {
  return value?.trim() || DOCUMENT_PLACEHOLDER;
}
// Accept the stored decimal form only when its fractional part is exactly zero.
export function wholeVnd(value: string | number): bigint | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0 || value > 999999999999999)
      return null;
    return BigInt(value);
  }
  if (!/^(0|[1-9][0-9]{0,14})(?:\.0+)?$/.test(value)) return null;
  return BigInt(value.split(".")[0]);
}
export function documentMoney(value: string | number) {
  const amount = wholeVnd(value);
  return amount === null
    ? "Không hỗ trợ số tiền lẻ"
    : `${amount.toLocaleString("vi-VN")} đồng`;
}
const digits = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];
function readGroup(value: number, full: boolean) {
  const hundred = Math.floor(value / 100);
  const ten = Math.floor((value % 100) / 10);
  const unit = value % 10;
  const words: string[] = [];
  if (hundred || full) words.push(digits[hundred], "trăm");
  if (ten > 1) words.push(digits[ten], "mươi");
  else if (ten === 1) words.push("mười");
  else if (unit && (hundred || full)) words.push("lẻ");
  if (unit)
    words.push(
      unit === 1 && ten > 1
        ? "mốt"
        : unit === 5 && ten > 0
          ? "lăm"
          : digits[unit],
    );
  return words.join(" ");
}
export function vndInWords(value: string | number) {
  let amount = wholeVnd(value);
  if (amount === null) return "Không hỗ trợ số tiền lẻ";
  if (amount === BigInt(0)) return "Không đồng";
  const groups: number[] = [];
  while (amount > BigInt(0)) {
    groups.push(Number(amount % BigInt(1000)));
    amount /= BigInt(1000);
  }
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ"];
  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    if (!groups[index]) continue;
    words.push(readGroup(groups[index], index < groups.length - 1));
    if (scales[index]) words.push(scales[index]);
  }
  const result = `${words.join(" ")} đồng`;
  return result.charAt(0).toLocaleUpperCase("vi-VN") + result.slice(1);
}
export function documentDate(value: string, timeZone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return DOCUMENT_PLACEHOLDER;
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return DOCUMENT_PLACEHOLDER;
  }
}
export function printVersion(value: unknown): number | null {
  return typeof value === "string" && /^[1-9][0-9]{0,8}$/.test(value)
    ? Number(value)
    : null;
}
