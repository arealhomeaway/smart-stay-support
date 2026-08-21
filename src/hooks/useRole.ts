import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  can,
  capabilitiesFor,
  landingFor,
  primaryRole,
  type AppRole,
  type Capability,
} from "@/lib/permissions";
import { useViewAs } from "@/hooks/useViewAs";

export type { AppRole };

/**
 * Roles for the signed-in user.
 *
 * `roles` are the effective roles the UI should honour (they follow a Platform
 * Owner's read-only "View As" preview). `actualRoles` are always the real ones.
 */
export function useRole() {
  const { viewAs } = useViewAs();

  const query = useQuery({
    queryKey: ["my-roles"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [] as AppRole[];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const actualRoles = query.data ?? [];
  const previewing = Boolean(viewAs) && actualRoles.includes("admin");
  const roles: AppRole[] = previewing && viewAs ? [viewAs] : actualRoles;

  const isVendor = roles.includes("vendor") && !roles.some((r) => r !== "vendor");
  // Homeowners are program participants, never internal staff.
  const isOwner = roles.includes("owner") && !roles.some((r) => r === "admin" || r === "manager");

  return {
    roles,
    actualRoles,
    previewing,
    previewRole: previewing ? viewAs : null,
    /** Every preview is read-only: nothing in the UI may mutate data. */
    readOnly: previewing,
    isLoading: query.isLoading,
    primary: primaryRole(roles),
    capabilities: capabilitiesFor(roles),
    can: (capability: Capability) => can(roles, capability),
    landing: landingFor(roles),
    isPlatformOwner: roles.includes("admin"),
    isAdmin: roles.includes("admin"),
    isSupervisor: roles.includes("admin") || roles.includes("manager"),
    isOnboardingStaff: can(roles, "onboarding_workspace"),
    isVendor,
    isOwner,
    isStaff: !isVendor && !isOwner,
  };
}
