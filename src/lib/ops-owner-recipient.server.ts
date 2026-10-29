import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { activeOwnerFor } from './active-owner.server';

/** Only this helper decides the Phase 1 recipient; canonical writes still recheck authority. */
export async function resolveOperationsOwnerRecipient(db: SupabaseClient<Database>, userId: string, propertyId: string) {
  const access = await db.rpc('is_internal_staff', { _user_id: userId });
  if (access.error) throw access.error;
  if (!access.data) throw new Error('Only staff can send to the owner.');
  const link = await activeOwnerFor(db, propertyId);
  if (!link?.ownerUserId || ['paused', 'closed', 'completed', 'complete'].includes(link.programStatus)) return { eligible: false as const, name: link?.ownerName ?? null };
  const account = await db.from('profiles').select('id').eq('id', link.ownerUserId).maybeSingle();
  if (account.error) throw account.error;
  if (!account.data) return { eligible: false as const, name: link.ownerName };
  return { eligible: true as const, name: link.ownerName, programId: link.programId, recipientId: link.ownerUserId };
}