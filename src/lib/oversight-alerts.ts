/**
 * Configurable oversight alerts.
 *
 * Supervisors decide when a homeowner's program deserves a nudge: how far
 * behind the program's own pace benchmark counts as behind, how long a
 * 30/60/90 check-in may sit past its window, and how long something may wait
 * with the homeowner. Nothing here suggests hours to a homeowner or says
 * anything about tax treatment — it only flags program follow-up for staff.
 */

import { MILESTONE_WINDOW_DAYS } from "./owner-milestones";
import { daysSinceContact, type OversightRow } from "./owner-oversight";

export type OversightAlertConfig = {
  /** Hours behind the pace benchmark before a homeowner is flagged. */
  behindHours: number;
  /** Days past a checkpoint window before the check-in counts as overdue. */
  checkinOverdueDays: number;
  /** Days an item may sit with the homeowner before it is flagged. */
  ownerItemDays: number;
  behindEnabled: boolean;
  checkinEnabled: boolean;
  ownerItemsEnabled: boolean;
};

export const DEFAULT_ALERT_CONFIG: OversightAlertConfig = {
  behindHours: 10,
  checkinOverdueDays: 3,
  ownerItemDays: 7,
  behindEnabled: true,
  checkinEnabled: true,
  ownerItemsEnabled: true,
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Read a stored settings blob into a complete, sane config. */
export function readAlertConfig(value: unknown): OversightAlertConfig {
  const raw = (value ?? {}) as Partial<Record<keyof OversightAlertConfig, unknown>>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    behindHours: clamp(raw.behindHours, 1, 100, DEFAULT_ALERT_CONFIG.behindHours),
    checkinOverdueDays: clamp(raw.checkinOverdueDays, 0, 30, DEFAULT_ALERT_CONFIG.checkinOverdueDays),
    ownerItemDays: clamp(raw.ownerItemDays, 1, 90, DEFAULT_ALERT_CONFIG.ownerItemDays),
    behindEnabled: bool(raw.behindEnabled, true),
    checkinEnabled: bool(raw.checkinEnabled, true),
    ownerItemsEnabled: bool(raw.ownerItemsEnabled, true),
  };
}

export type OversightAlertKind = "behind_pace" | "checkin_overdue" | "owner_items";

export type OversightAlert = {
  programId: string;
  ownerName: string;
  properties: string;
  kind: OversightAlertKind;
  severity: "attention" | "urgent";
  title: string;
  detail: string;
};

/** Every alert this row triggers under the current configuration. */
export function alertsForRow(
  row: OversightRow,
  config: OversightAlertConfig,
  now: Date = new Date(),
): OversightAlert[] {
  const base = {
    programId: row.id,
    ownerName: row.ownerName ?? "Unnamed homeowner",
    properties: row.properties.map((p) => p.name).join(" · ") || "No home linked yet",
  };
  const out: OversightAlert[] = [];

  if (config.behindEnabled && row.health.behindHours >= config.behindHours) {
    out.push({
      ...base,
      kind: "behind_pace",
      severity: row.health.behindHours >= config.behindHours * 2 ? "urgent" : "attention",
      title: "Behind the program pace",
      detail: `${row.health.behindHours} hrs behind the day ${row.day} benchmark of ${row.benchmark} hrs.`,
    });
  }

  if (config.checkinEnabled) {
    // A checkpoint is overdue once it has been open longer than the allowed grace.
    const open = row.openCheckpoint;
    const daysOpen = open ? Math.abs(Math.min(0, open.daysAway)) : 0;
    const overdue = Boolean(open) && daysOpen > config.checkinOverdueDays;
    const past = row.checkpoints.filter(
      (c) => c.daysAway < -MILESTONE_WINDOW_DAYS && c.state === "behind",
    );
    if (overdue) {
      out.push({
        ...base,
        kind: "checkin_overdue",
        severity: daysOpen > config.checkinOverdueDays * 2 ? "urgent" : "attention",
        title: `Day ${open!.day} check-in overdue`,
        detail: `The check-in window opened ${daysOpen} days ago and has not been closed out.`,
      });
    } else if (past.length) {
      const last = past[past.length - 1]!;
      out.push({
        ...base,
        kind: "checkin_overdue",
        severity: "attention",
        title: `Day ${last.day} checkpoint passed behind pace`,
        detail: `Day ${last.day} came and went with ${row.reportedHours} hrs reported.`,
      });
    }
  }

  if (config.ownerItemsEnabled && row.openTasks > 0) {
    const days = daysSinceContact(row, now);
    if (days === null || days >= config.ownerItemDays) {
      out.push({
        ...base,
        kind: "owner_items",
        severity: days === null || days >= config.ownerItemDays * 2 ? "urgent" : "attention",
        title: `${row.openTasks} item${row.openTasks === 1 ? "" : "s"} waiting on the homeowner`,
        detail:
          days === null
            ? "No contact has been recorded with this homeowner yet."
            : `Last contact was ${days} days ago.`,
      });
    }
  }

  return out;
}

const SEVERITY_ORDER = { urgent: 0, attention: 1 } as const;

/** Every alert across the program, most serious first. */
export function oversightAlerts(
  rows: OversightRow[],
  config: OversightAlertConfig,
  now: Date = new Date(),
): OversightAlert[] {
  return rows
    .flatMap((r) => alertsForRow(r, config, now))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
