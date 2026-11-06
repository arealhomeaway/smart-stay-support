/**
 * Server-side gate for outside-system lookups (OwnerRez, Breezeway, PriceLabs).
 * Being signed in is not enough: vendors and homeowners are signed in too.
 * Only Resolve staff, as decided by the database's own is_staff check, pass.
 */
type StaffCheckClient = {
  rpc: (fn: "is_staff", args: { _user_id: string }) => PromiseLike<{ data: unknown; error: unknown }>;
};

export const STAFF_ONLY_MESSAGE = "Only Resolve staff can look this up.";

export async function isStaffCaller(supabase: unknown, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const client = supabase as StaffCheckClient;
  const { data, error } = await client.rpc("is_staff", { _user_id: userId });
  return !error && data === true;
}

export async function assertStaffCaller(supabase: unknown, userId: string | null | undefined): Promise<void> {
  if (!(await isStaffCaller(supabase, userId))) throw new Error(STAFF_ONLY_MESSAGE);
}
