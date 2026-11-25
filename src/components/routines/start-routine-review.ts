import { supabase } from '@/integrations/supabase/client';
/** Existing routine drawer Start write, reused by Home's Take it. */
export async function startRoutineReview(row: { id: string; assigned_to: string | null }) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('routine_controls')
    .update({ status: 'in_progress', assigned_to: row.assigned_to ?? auth.user?.id ?? null }).eq('id', row.id);
  if (error) throw error;
}