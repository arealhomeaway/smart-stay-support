import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  roles: AppRole[];
};

/** The signed-in user's id, resolved once. */
export function useCurrentUserId() {
  const q = useQuery({
    queryKey: ["current-user-id"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
  return q.data ?? null;
}

/** Internal staff who can own operational work (coordinators and supervisors). */
export function useStaffDirectory() {
  return useQuery({
    queryKey: ["staff-directory"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      const roleMap = new Map<string, AppRole[]>();
      for (const r of roles.data ?? []) {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        roleMap.set(r.user_id, list);
      }
      return (profiles.data ?? [])
        .map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }) as TeamMember)
        .filter((p) => p.roles.some((r) => ["admin", "manager", "onboarding", "tech"].includes(r)));
    },
  });
}

export function displayName(m: { full_name: string | null; email: string | null } | undefined | null) {
  if (!m) return "Unassigned";
  return m.full_name?.trim() || m.email || "Team member";
}
