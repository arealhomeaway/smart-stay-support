import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { entryPathFor } from "@/lib/portals";
import {
  can,
  capabilitiesFor,
  primaryRole,
  type AppRole,
  type Capability,
} from "@/lib/permissions";
import { useViewAs } from "@/hooks/useViewAs";
import { useDemoFlag, usePreviewSeat } from "@/hooks/useDemoFlag";
import { canOperateDemo, previewIdentityLabel } from "@/lib/demo-mode";
import { ROLE_LABELS } from "@/lib/permissions";

export type { AppRole };

/**
 * The signed-in user's real roles, cached and shared via react-query so
 * every caller (this hook, DemoProvider's admin check) sees the same
 * result instead of each running its own one-shot fetch.
 */
export function useMyRoles() {
  return useQuery({
    queryKey: ["my-roles"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { userId: null as string | null, roles: [] as AppRole[] };
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      if (error) throw error;
      return { userId: auth.user.id, roles: (data ?? []).map((r) => r.role as AppRole) };
    },
  });
}

/**
 * Roles for the signed-in user.
 *
 * `roles` are the effective roles the UI should honour (they follow a Platform
 * Owner's read-only "View As" preview). `actualRoles` are always the real ones.
 */
export function useRole() {
  const { viewAs } = useViewAs();
  const demoFlag = useDemoFlag();
  const previewSeat = usePreviewSeat();

  const query = useMyRoles();

  const actualRoles = query.data?.roles ?? [];
  const userId = query.data?.userId ?? null;
  const previewing = Boolean(viewAs) && canOperateDemo(actualRoles);
  // The demo environment exists to be worked. An ordinary role preview is a
  // look, never a change; the demo lens is a look at *demo records*, which the
  // previewer is meant to act on.
  const demoMode = canOperateDemo(actualRoles) && demoFlag;
  const roles: AppRole[] = previewing && viewAs ? [viewAs] : actualRoles;

  const isVendor = roles.includes("vendor") && !roles.some((r) => r !== "vendor");
  // Homeowners are program participants, never internal staff.
  const isOwner = roles.includes("owner") && !roles.some((r) => r === "admin" || r === "manager");

  return {
    userId,
    roles,
    actualRoles,
    previewing,
    previewRole: previewing ? viewAs : null,
    /**
     * Read-only means read-only. A plain role preview may not change anything;
     * the safe demo environment may change demo records only, which the
     * queries and writes on each surface already scope by `is_demo`.
     */
    readOnly: previewing && !demoMode,
    /** True while previewing the isolated demo environment. */
    demoMode,
    /** The operational seat being previewed, when one was chosen. */
    previewSeat: previewing ? previewSeat : null,
    isDirectorPreview: previewing && previewSeat === "director_ops",
    isLoading: query.isLoading,
    primary: primaryRole(roles),
    /**
     * The one identity label every preview-aware surface should show —
     * "Director of Operations" while previewing that seat, never the
     * permission role it happens to share ("Supervisor"). Use this instead
     * of reading ROLE_LABELS[primary] directly wherever a role/identity is
     * displayed to the viewer.
     */
    identityLabel: previewIdentityLabel({
      previewing,
      previewSeat: previewing ? previewSeat : null,
      previewRoleLabel: previewing && viewAs ? ROLE_LABELS[viewAs] : null,
      actualLabel: ROLE_LABELS[primaryRole(actualRoles)],
    }),
    capabilities: capabilitiesFor(roles),
    can: (capability: Capability) => can(roles, capability),
    landing: entryPathFor(roles),
    isPlatformOwner: roles.includes("admin"),
    isAdmin: roles.includes("admin"),
    isSupervisor: roles.includes("admin") || roles.includes("manager"),
    isOnboardingStaff: can(roles, "onboarding_workspace"),
    isVendor,
    isOwner,
    isStaff: !isVendor && !isOwner,
  };
}
