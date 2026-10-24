export function dateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}
export function dayString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDay(value: string) {
  const day = dateOnly(value);
  if (!day) return null;
  const [year, month, date] = day.split("-").map(Number);
  const result = new Date(year, month - 1, date, 12);
  return dayString(result) === day ? result : null;
}
export function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}
export function dayWithinBounds(day: string, min?: string, max?: string) {
  return (!min || day >= dateOnly(min)) && (!max || day <= dateOnly(max));
}
export function dateTimeChoice(
  day: string,
  time: string,
  min?: string,
  max?: string,
) {
  const value = `${day}T${time || "00:00"}`;
  if (min && value < min && day === dateOnly(min)) return min;
  if (max && value > max && day === dateOnly(max)) return max;
  return value;
}
