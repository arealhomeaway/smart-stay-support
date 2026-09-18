/** One URL contract for List, Kanban, Map and Calendar. */
export const OPERATIONS_SEARCH_KEYS = [
  "view", "lens", "sort", "month", "pin", "lat", "lng", "zoom", "assignee", "homeTeam", "priority",
  "status", "property", "market", "city", "state", "workType", "kind", "vendor", "dispatch",
  "acceptance", "completion", "dateFrom", "dateTo", "due", "age", "flags", "q",
] as const;

export type OperationsView = "list" | "kanban" | "map" | "calendar";
export type OperationsSearch = Partial<Record<(typeof OPERATIONS_SEARCH_KEYS)[number], string>>;

export function parseOperationsSearch(raw: Record<string, unknown>): OperationsSearch {
  const out: OperationsSearch = {};
  for (const key of OPERATIONS_SEARCH_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

export function operationsView(search: OperationsSearch): OperationsView {
  return search.view === "kanban" || search.view === "map" || search.view === "calendar"
    ? search.view : "list";
}

export function withOperationsView(search: OperationsSearch, view: OperationsView): OperationsSearch {
  const next = { ...search };
  if (view === "list") delete next.view;
  else next.view = view;
  return next;
}

export function operationsCalendarMonth(value: string | undefined, today = new Date()): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftOperationsMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return operationsCalendarMonth(undefined, new Date(year!, monthNumber! - 1 + offset, 1));
}

export function operationsCalendarDays(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year!, monthNumber! - 1, 1);
  first.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
}
