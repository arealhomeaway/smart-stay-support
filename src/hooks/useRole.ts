import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "tech";

/** Roles for the signed-in user. Supervisors = admin or manager. */
export function useRole() {
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

  const roles = query.data ?? [];
  return {
    roles,
    isLoading: query.isLoading,
    isAdmin: roles.includes("admin"),
    isSupervisor: roles.includes("admin") || roles.includes("manager"),
  };
}
