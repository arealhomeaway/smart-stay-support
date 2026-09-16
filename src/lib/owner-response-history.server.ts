import type { Client } from "./owner-participation.server";
import { projectOwnerResponseReceipt } from "./owner-reviewed-update";
import { readCountedRows } from "./read-all-rows";

/** Caller-scoped history shared by the hub, exports and saved closeout. */
export async function loadOwnerResponseReceipts(supabase: Client, programId: string) {
  const rows = await readCountedRows(
    supabase
      .from("owner_program_events")
      .select("id, review_id, created_at, detail", { count: "exact" })
      .eq("program_id", programId)
      .in("kind", ["owner_participation_response", "owner_decision"])
      .order("created_at")
      .order("id"),
  );
  return rows.data.map(projectOwnerResponseReceipt);
}

export type OwnerResponseReceipt = Awaited<ReturnType<typeof loadOwnerResponseReceipts>>[number];
