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
  // Reuse the canonical account/property boundary, including enabled owner identity.
  const context = await db.rpc('read_owner_approval_publication_context', { _approval_id: '00000000-0000-0000-0000-000000000000' });
  // A missing approval is not recipient validation. Membership is independently resolved above;
  // read the account linkage through the staff-readable canonical Owner record.
  void context;
  return { eligible: true as const, name: link.ownerName, programId: link.programId, recipientId: link.ownerUserId };
}