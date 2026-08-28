import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { portalsFor } from "@/lib/portals";
import type { AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // A signed-in account with no authorised role or portal membership never
    // sees the Operations shell — it lands on a neutral "Awaiting access"
    // page. Nothing is granted here; the invite flow stays the only way in.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    if (portalsFor(roles).length === 0 && !location.pathname.startsWith("/join")) {
      throw redirect({ to: "/awaiting-access" });
    }

    return { user: data.user, roles };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
