/** Screen wording for the nightly PID copy (browser-safe). */
import { PID_MAPPING_V1 } from "./mapping-v1";
import { targetPath } from "./transforms";

const NAME = new Map<string, string>();
for (const m of PID_MAPPING_V1) {
  const t = targetPath(m.target);
  if (t) NAME.set(t.join("."), m.name);
}

/** "hoa.notes" → "HOA Notes"; "link:BW Property Link" → "BW Property Link"; "pid:Owner" → "Owner". */
export function pidFieldLabel(key: string): string {
  if (key.startsWith("link:") || key.startsWith("pid:") || key.startsWith("notion:")) return key.slice(key.indexOf(":") + 1);
  if (key.startsWith("code:")) return key.slice(5);
  if (key === "latitude,longitude") return "GPS Coordinates";
  if (key === "market") return "Greater Area";
  if (key === "(home)") return "Whole home";
  return NAME.get(key) ?? key.replace(/[._]/g, " ");
}

export const REVIEW_KIND_LABEL: Record<string, string> = {
  resolve_changed: "Changed in Resolve",
  ownerrez: "OwnerRez decides",
  pid_pages_disagree: "Two PID pages disagree",
  withheld: "May hold a code",
  invalid: "Could not be read",
  code_kept: "Code kept in Resolve",
  error: "Not copied",
};

export type PidRunRow = { id: string; status: string; created_at: string; updated_at: string; error_message: string | null; request_payload: any };

/** The run's state in a few words. */
export function pidRunLabel(r: PidRunRow | null): string {
  if (!r) return "No runs yet";
  if (r.status === "processing") return "Running";
  if (r.status === "failed") return "Last run failed";
  return r.error_message ? "Finished with problems" : "Last run OK";
}
