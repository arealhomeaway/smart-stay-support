/**
 * Single source of truth for the live reporting baseline.
 *
 * Operations analytics start clean on this date: pre-launch imported tickets
 * were archived rather than deleted, and demo records stay flagged, so every
 * reporting surface excludes both. Change the date here only — surfaces read
 * the label from this module rather than hardcoding their own copy.
 */
export const REPORTING_START_ISO = "2026-09-02";

export const REPORTING_START_LABEL = new Date(`${REPORTING_START_ISO}T00:00:00`).toLocaleDateString(
  "en-US",
  { month: "long", day: "numeric", year: "numeric" },
);

export const REPORTING_BASELINE_NOTE = `Live reporting begins ${REPORTING_START_LABEL}. Pre-launch archived and demo records are excluded.`;
