import { supabase } from '@/integrations/supabase/client';
import { takeTicketPatch } from '@/lib/automated-sources';
import { TEAM_QUEUE_COPY } from '@/lib/team-queue-board';

/** Shared existing Take it write, including its race guard and history line. */
export async function takeUnownedTicket(t: { id: string; record_owner?: string | null; accountable_owner?: string | null }, userId: string) {
  const { data, error } = await supabase.from('tickets').update(takeTicketPatch(t, userId))
    .eq("id", t.id).is("assigned_to", null).is("current_action_owner", null).select("id");
  if (error) throw error;
  if (!data?.length) return false;
  await supabase.from('ticket_activity').insert({ ticket_id: t.id,
    author_id: userId, kind: 'assignment', event_type: 'assigned',
    body: TEAM_QUEUE_COPY.history.took, internal: false, mentions: [] });
  return true;
}