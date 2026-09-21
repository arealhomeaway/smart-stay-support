/**
 * The guided-action shape shared by every workspace in Resolve.
 *
 * One step at a time: what to do now, why it is next, what has to be written
 * down before it counts, and what happens the moment it is finished. Tickets
 * (ticket-current-action.ts) and onboarding tasks (onboarding-task-action.ts)
 * both describe their step with this vocabulary, so the same card, the same
 * required-input rules and the same Complete & Advance behaviour apply
 * everywhere. Pure — it grants no authority and stores nothing.
 */

export type ActionFieldType = "text" | "longtext" | "choice" | "datetime" | "date";

export type ActionField = {
  name: string;
  label: string;
  type: ActionFieldType;
  required: boolean;
  help?: string;
  /** Only for "choice". */
  options?: { value: string; label: string }[];
  /** Only shown when this other field holds one of these values. */
  showWhen?: { field: string; equals: string[] };
  /** Minimum characters for text answers. */
  minLength?: number;
};

export type GuidedAction<Id extends string = string, Target extends string = string> = {
  id: Id;
  /** Short imperative — what to do now. */
  title: string;
  /** Why this is next, in one plain sentence. */
  because: string;
  /** What comes after, when it is knowable. */
  then?: string;
  /** What has to be written down before this can be completed. */
  fields: ActionField[];
  /** Label on the finish button. */
  completeLabel: string;
  /**
   * When set, this step is finished somewhere else on the page — the card
   * points there instead of offering a finish button.
   */
  handoff?: { label: string; target: Target };
};

export type ActionValues = Record<string, string>;

/** True when this field applies, given what has been answered so far. */
export function fieldApplies(field: ActionField, values: ActionValues) {
  if (!field.showWhen) return true;
  return field.showWhen.equals.includes(values[field.showWhen.field] ?? "");
}

/**
 * The same check the browser and the server run — one rule, one message.
 * Returns the first problem, or null when the action is ready to complete.
 */
export function validateAction(
  action: { fields: ActionField[] },
  values: ActionValues,
): string | null {
  for (const field of action.fields) {
    if (!fieldApplies(field, values)) continue;
    const raw = (values[field.name] ?? "").trim();
    if (!field.required) continue;
    if (!raw) return `${field.label} is required.`;
    if (field.type === "choice" && !(field.options ?? []).some((o) => o.value === raw))
      return `Choose one: ${field.label}.`;
    if ((field.type === "text" || field.type === "longtext") && raw.length < (field.minLength ?? 1))
      return `${field.label} — a little more detail, please.`;
    if (field.type === "datetime" || field.type === "date") {
      const when = new Date(raw);
      if (Number.isNaN(when.getTime())) return `${field.label} isn't a real date.`;
      if (field.type === "datetime" && when.getTime() <= Date.now())
        return `${field.label} has to be in the future — that's when it comes back to you.`;
    }
  }
  return null;
}
