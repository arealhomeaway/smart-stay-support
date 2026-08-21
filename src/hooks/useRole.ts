import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "tech" | "vendor" | "owner";

/** Roles for the signed-in user. Supervisors = admin or manager. Vendors are outside partners. */
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
  const isVendor = roles.includes("vendor") && !roles.some((r) => r !== "vendor");
  // Homeowners are program participants, never internal staff.
  const isOwner = roles.includes("owner") && !roles.some((r) => r === "admin" || r === "manager");
  return {
    roles,
    isLoading: query.isLoading,
    isAdmin: roles.includes("admin"),
    isSupervisor: roles.includes("admin") || roles.includes("manager"),
    isVendor,
    isOwner,
    isStaff: !isVendor && !isOwner,
  };
}

