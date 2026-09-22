import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALERT_CONFIG,
  alertsForRow,
  oversightAlerts,
  readAlertConfig,
} from "../oversight-alerts";
import { oversightRow, type OversightInput } from "../owner-oversight";

const base: OversightInput = {
  id: "p1",
  ownerName: "Riley Adler",
  ownerEmail: "riley@example.com",
  ownerLinked: true,
  status: "active",
  startedOn: "2026-08-01",
  endsOn: "2026-10-30",
  day: 32,
  daysLeft: 58,
  reportedHours: 10,
  benchmark: 55,
  goalMet: false,
  openTasks: 0,
  lastOwnerActivityAt: null,
  lastNotificationAt: null,
  properties: [{ id: "h1", name: "Willow Creek Cottage" }],
};

const now = new Date("2026-09-22T12:00:00Z");

describe("readAlertConfig", () => {
  it("fills in defaults for anything missing", () => {
    expect(readAlertConfig(null)).toEqual(DEFAULT_ALERT_CONFIG);
  });

  it("clamps nonsense values into a usable range", () => {
    const config = readAlertConfig({ behindHours: -5, ownerItemDays: 9999, behindEnabled: "yes" });
    expect(config.behindHours).toBe(1);
    expect(config.ownerItemDays).toBe(90);
    expect(config.behindEnabled).toBe(true);
  });
});

describe("alertsForRow", () => {
  it("flags a homeowner well behind the program pace", () => {
    const alerts = alertsForRow(oversightRow(base), DEFAULT_ALERT_CONFIG, now);
    const behind = alerts.find((a) => a.kind === "behind_pace");
    expect(behind).toBeDefined();
    expect(behind?.severity).toBe("urgent");
  });

  it("stays quiet when the behind-pace alert is switched off", () => {
    const alerts = alertsForRow(
      oversightRow(base),
      { ...DEFAULT_ALERT_CONFIG, behindEnabled: false },
      now,
    );
    expect(alerts.some((a) => a.kind === "behind_pace")).toBe(false);
  });

  it("flags items sitting with a homeowner nobody has contacted", () => {
    const alerts = alertsForRow(oversightRow({ ...base, openTasks: 2 }), DEFAULT_ALERT_CONFIG, now);
    const waiting = alerts.find((a) => a.kind === "owner_items");
    expect(waiting?.title).toContain("2 items");
    expect(waiting?.detail).toContain("No contact");
  });

  it("leaves recent contact alone", () => {
    const row = oversightRow({
      ...base,
      openTasks: 1,
      lastOwnerActivityAt: "2026-09-21T12:00:00Z",
    });
    expect(alertsForRow(row, DEFAULT_ALERT_CONFIG, now).some((a) => a.kind === "owner_items")).toBe(
      false,
    );
  });

  it("respects a stricter contact threshold", () => {
    const row = oversightRow({
      ...base,
      openTasks: 1,
      lastOwnerActivityAt: "2026-09-19T12:00:00Z",
    });
    const alerts = alertsForRow(row, { ...DEFAULT_ALERT_CONFIG, ownerItemDays: 2 }, now);
    expect(alerts.some((a) => a.kind === "owner_items")).toBe(true);
  });
});

describe("oversightAlerts", () => {
  it("puts the most serious alerts first", () => {
    const rows = [
      oversightRow({ ...base, id: "p2", reportedHours: 45, openTasks: 1 }),
      oversightRow(base),
    ];
    const alerts = oversightAlerts(rows, DEFAULT_ALERT_CONFIG, now);
    expect(alerts[0]?.severity).toBe("urgent");
  });
});
