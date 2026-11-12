/**
 * Item 39 (Nov 12): a step marked "Needs a file before sending" refuses Send to the homeowner
 * and Send email until the Task has a stored file. The rule is `sendNeedsFile`; this reads the
 * Task's own settings and files as the caller (staff read every document under RLS).
 */
import { kindSettings, sendNeedsFile } from "./onboarding-task-kinds";

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function assertTaskFileForSend(db: Db, taskId: string): Promise<void> {
  const task = await db.from("onboarding_tasks").select("kind_settings").eq("id", taskId).maybeSingle();
  if (task.error) throw new Error("This Task could not be checked before sending.");
  const settings = kindSettings((task.data as { kind_settings?: unknown } | null)?.kind_settings);
  if (!settings.requireFile) return;
  const files = await db
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "onboarding_task")
    .eq("entity_id", taskId)
    .eq("upload_status", "stored")
    .is("archived_at", null)
    .is("deleted_at", null);
  if (files.error) throw new Error("This Task's files could not be checked before sending.");
  const block = sendNeedsFile(settings, files.count ?? 0);
  if (block) throw new Error(block);
}

/** An email from an onboarding Task to the homeowner (not a vendor request) waits on the same rule. */
export async function taskEmailFileGate(db: Db, input: { context: string; recordId: string; vendorOrgId?: string | null }): Promise<void> {
  if (input.context !== "onboarding_task" || input.vendorOrgId) return;
  await assertTaskFileForSend(db, input.recordId);
}
