/**
 * Program Owner: the internal person responsible for this vendor's
 * qualification/compliance follow-up. Receives expiry reminders alongside
 * Admins and the Director of Operations. The database only accepts active
 * internal staff and audits every change; it never touches status, coverage
 * or dispatch eligibility.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usDate } from "@/lib/dates";
import { errorText, useInvalidateVendors } from "./useVendorWorkspace";

const NONE = "__none";

export function ProgramOwnerField({ orgId, value, canManage }: { orgId: string; value: string | null; canManage: boolean }) {
  const invalidate = useInvalidateVendors();
  const choices = useQuery({
    queryKey: ["vendor-program-owner-choices"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_program_owner_choices");
      if (error) throw error;
      return data ?? [];
    },
  });
  const current = useQuery({
    queryKey: ["vendor-program-owner-name", value],
    enabled: Boolean(value),
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", value!).maybeSingle();
      return data?.full_name ?? data?.email ?? "Unknown person";
    },
  });
  const history = useQuery({
    queryKey: ["vendor-program-owner-history", orgId, value],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_field_audit")
        .select("changed_at, changed_by")
        .eq("org_id", orgId)
        .eq("field", "program_owner")
        .order("changed_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });
  const save = useMutation({
    mutationFn: async (next: string | null) => {
      const { error } = await supabase.from("vendor_orgs").update({ program_owner: next }).eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Program Owner updated.");
      invalidate();
      void history.refetch();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <div className="space-y-1 text-sm">
      <p className="text-xs text-muted-foreground">Program Owner</p>
      {canManage ? (
        <Select value={value ?? NONE} onValueChange={(v) => save.mutate(v === NONE ? null : v)} disabled={save.isPending}>
          <SelectTrigger className="h-9 w-72" aria-label="Program Owner">
            <SelectValue placeholder="Not assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not assigned</SelectItem>
            {(choices.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p>{value ? (current.data ?? "…") : "Not assigned"}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Handles qualification and compliance follow-up and gets expiry reminders with Admins and the Director of Operations.
        {history.data ? ` Last changed ${usDate(history.data.changed_at.slice(0, 10))}.` : ""}
      </p>
    </div>
  );
}
