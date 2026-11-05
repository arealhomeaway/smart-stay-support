export async function leadershipGuard(supabase: any, userId: string) {
  const [{ data: admin }, { data: director }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_director", { _user_id: userId }),
  ]);
  if (admin !== true && director !== true) throw new Error("Only leadership can manage help tickets.");
}
export async function submitterEmail(ticket: { submitted_by: string | null; submitter_email: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (ticket.submitted_by) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(ticket.submitted_by);
    if (data?.user?.email) return data.user.email;
  }
  return ticket.submitter_email ?? null;
}