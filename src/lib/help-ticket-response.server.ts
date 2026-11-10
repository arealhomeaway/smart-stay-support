/** Register A20: help tickets are Admin Edit; everyone else sees only their own reports. */
export async function leadershipGuard(supabase: any, userId: string) {
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (admin !== true) throw new Error("Only the Admin can manage help tickets.");
}
export async function submitterEmail(ticket: { submitted_by: string | null; submitter_email: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (ticket.submitted_by) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(ticket.submitted_by);
    if (data?.user?.email) return data.user.email;
  }
  return ticket.submitter_email ?? null;
}