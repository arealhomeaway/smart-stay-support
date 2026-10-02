import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";

/**
 * Finance authority for the signed-in user. Mirrors the database rules
 * (`is_finance_lead`, `is_accounting`, `is_director`); the database enforces them.
 */
export function useFinanceAccess() {
  const role = useRole();
  const q = useQuery({
    queryKey: ["finance-access", role.userId],
    enabled: !!role.userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const id = role.userId!;
      const [lead, acct, dir] = await Promise.all([
        supabase.rpc("is_finance_lead", { _user_id: id }),
        supabase.rpc("is_accounting", { _user_id: id }),
        supabase.rpc("is_director", { _user_id: id }),
      ]);
      return { lead: lead.data === true, accounting: acct.data === true, director: dir.data === true };
    },
  });
  const readOnly = role.readOnly;
  return {
    userId: role.userId,
    isLead: !readOnly && Boolean(q.data?.lead),
    isAccounting: !readOnly && Boolean(q.data?.accounting),
    isDirector: !readOnly && Boolean(q.data?.director),
    isAdmin: !readOnly && role.isAdmin,
    isStaff: role.isStaff && !readOnly,
  };
}
