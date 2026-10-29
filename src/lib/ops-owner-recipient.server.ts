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
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const account = await supabaseAdmin.auth.admin.getUserById(link.ownerUserId);
  if (account.error) throw new Error('Could not confirm homeowner portal access. Nothing has been sent.');
  const owner = account.data.user;
  const bannedUntil = owner?.['banned_until'];
  const roles = await db.from('user_roles').select('role').eq('user_id',link.ownerUserId);
  if (roles.error) throw roles.error;
  if (!owner || (typeof bannedUntil==='string' && Date.parse(bannedUntil)>Date.now()) || !roles.data.some(r=>r.role==='owner') || roles.data.some(r=>['admin','manager','tech','onboarding','vendor'].includes(r.role))) return { eligible: false as const, name: link.ownerName };
  return { eligible: true as const, name: link.ownerName, programId: link.programId, recipientId: link.ownerUserId };
}