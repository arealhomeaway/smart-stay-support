export function validCalendarMonth(value: string | undefined) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return new Date().toISOString().slice(0, 7);
  return value;
}

export function shiftCalendarMonth(month: string, amount: number) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, index! - 1 + amount, 1)).toISOString().slice(0, 7);
}

export function calendarDays(month: string) {
  const [year, index] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year!, index! - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86400000);
  return Array.from({ length: 42 }, (_, day) => new Date(start.getTime() + day * 86400000).toISOString().slice(0, 10));
}
