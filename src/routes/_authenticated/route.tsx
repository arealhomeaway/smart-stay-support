import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { portalsFor } from "@/lib/portals";
import { canOpenPath, homePathFor } from "@/lib/route-access";
import type { AppRole } from "@/lib/permissions";
import { watchAccountIdentity } from "@/lib/account-query-boundary";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // A signed-in account with no authorised role or portal membership never
    // sees the Operations shell — it lands on a neutral "Awaiting access"
    // page. Nothing is granted here; the invite flow stays the only way in.
    const [{ data: roleRows }, director, opsDirector, finance] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase.rpc("is_onboarding_director", { _user_id: data.user.id }),
      supabase.rpc("is_director", { _user_id: data.user.id }),
      supabase.rpc("is_accounting", { _user_id: data.user.id }),
    ]);
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    // Seats grant areas too (e.g. Finance), so the route gate must see them.
    const access = {
      roles,
      seats: {
        onboardingDirector: director.data === true,
        opsDirector: opsDirector.data === true,
        finance: finance.data === true,
      },
    };
    if (
      portalsFor(roles).length === 0 &&
      !access.seats.onboardingDirector &&
      !location.pathname.startsWith("/join")
    ) {
      throw redirect({ to: "/awaiting-access" });
    }

    // Route authorization runs before any page renders, so a typed URL for a
    // portal this person does not work in never flashes its data. They land
    // in the most useful portal they ARE authorised to use instead.
    if (!location.pathname.startsWith("/join") && !canOpenPath(location.pathname, access)) {
      const home = homePathFor(access);
      if (home !== location.pathname) throw redirect({ to: home as never, replace: true });
    }

    return { user: data.user, roles, access };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, queryClient } = Route.useRouteContext();
  const router = useRouter();
  // Wait for the initial auth notification and cache boundary before mounting
  // consumers of cached roles or private data.
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  useEffect(
    () =>
      watchAccountIdentity(supabase.auth, queryClient, user.id, setSessionUserId, () => {
        void router.invalidate();
      }),
    [user.id, queryClient, router],
  );
  if (sessionUserId !== user.id)
    return (
      <p role="status" className="p-6">
        Checking your account…
      </p>
    );
  return (
    <AppShell key={user.id}>
      <Outlet />
    </AppShell>
  );
}
