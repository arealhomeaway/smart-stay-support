import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { WorkHistoryRow } from '@/lib/owner-work-history';
export type OwnerWorkSave = {
 saveKey: string; programId: string; source: string; cardId: string | null; propertyIds: string[];
 activity: string; minutes: number; entryDate: string; values: Record<string, string | number | boolean | null>;
 files: { document_id: string; name: string }[]; paths: string[]; phase: string;
 editSaveId?: string; editEntryId?: string; decision?: string; approvalId?:string; publicationId?: string; mode?: string;
};
export const readOwnerWorkHistory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((data: { programId: string }) => data)
 .handler(async ({data,context}) => {
  const r = await context.supabase.rpc('read_owner_work_history', { _program: data.programId });
  if (r.error) throw new Error(r.error.message);
  return r.data as unknown as WorkHistoryRow[];
 });
export const saveOwnerCardWork = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((data: OwnerWorkSave) => data)
 .handler(async ({data,context}) => {
  const r = await context.supabase.rpc('save_owner_card_work', { _save: data });
  if (r.error) throw new Error(r.error.message);
  return r.data as string;
 });
export const archiveOwnerDuplicateTimeEntry = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
 .inputValidator((data: { entryId: string }) => data)
 .handler(async ({data,context}) => {
  const r = await context.supabase.rpc('archive_owner_duplicate_time_entry', { _entry_id: data.entryId });
  if (r.error) throw new Error(r.error.message);
  return r.data as { archivedEntryId: string; originalEntryId: string };
 });
