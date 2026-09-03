import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  roles: AppRole[];
  /** Another active account shares this display name. */
  ambiguous?: boolean;
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
      const staff = (profiles.data ?? [])
        .map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }) as TeamMember)
        .filter((p) => p.roles.some((r) => ["admin", "manager", "onboarding", "tech"].includes(r)));

      // Two accounts can carry the same name (a real staff member and a test
      // account, for instance). Assigning work to "Emily Jimenez" twice over is
      // not a choice anyone can make, so colliding names get their email shown.
      const counts = new Map<string, number>();
      for (const m of staff) {
        const key = (m.full_name ?? "").trim().toLowerCase();
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return staff.map((m) => {
        const key = (m.full_name ?? "").trim().toLowerCase();
        return counts.get(key) ?? 0 > 1 ? { ...m, ambiguous: true } : m;
      });
    },
  });
}

export function displayName(
  m: { full_name: string | null; email: string | null; ambiguous?: boolean } | undefined | null,
) {
  if (!m) return "Unassigned";
  const name = m.full_name?.trim();
  if (!name) return m.email || "Team member";
  // Disambiguate duplicate names so the picker never offers two identical rows.
  return m.ambiguous && m.email ? `${name} (${m.email})` : name;
}
