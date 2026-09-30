/**
 * One read of the canonical vendor records, shared by every Vendor workspace
 * tab (Directory, Database, Gold Standard, Market Coverage, Needs Review).
 * No tab keeps its own copy — they all read these rows.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { vendorCompliance } from "@/lib/vendor-compliance";

export type VendorRecord = Database["public"]["Tables"]["vendor_orgs"]["Row"];
export type CoverageRecord = Database["public"]["Tables"]["vendor_market_coverage"]["Row"];
export type CustomField = Database["public"]["Tables"]["vendor_custom_fields"]["Row"];
export type SavedView = Database["public"]["Tables"]["vendor_saved_views"]["Row"];

export const VENDOR_WS_KEY = ["vendor-workspace"] as const;

export function useVendorWorkspace() {
  return useQuery({
    queryKey: VENDOR_WS_KEY,
    queryFn: async () => {
      const [vendors, markets, categories, coverage, fields, views, gates, results] = await Promise.all([
        supabase.from("vendor_orgs").select("*").order("display_name"),
        supabase.from("vendor_markets").select("*").eq("active", true).order("sort_order"),
        supabase.from("vendor_service_categories").select("*").eq("active", true).order("sort_order"),
        supabase.from("vendor_market_coverage").select("*"),
        supabase.from("vendor_custom_fields").select("*").order("sort_order"),
        supabase.from("vendor_saved_views").select("*").order("name"),
        supabase
          .from("gatekeeper_requirements")
          .select("id, code, label, requirement_level, allows_not_applicable, allows_equivalent, expiry_required")
          .eq("active", true)
          .order("sort_order"),
        supabase.from("vendor_gatekeeper_results").select("org_id, requirement_id, result, expires_on"),
      ]);
      for (const r of [vendors, markets, categories, coverage, fields, views, gates, results]) {
        if (r.error) throw r.error;
      }
      const today = new Date().toISOString().slice(0, 10);
      const gateList = gates.data ?? [];
      const gateStatus = new Map<string, { passed: number; total: number; blockingClear: boolean; expired: number }>();
      for (const v of vendors.data ?? []) {
        const mine = (results.data ?? []).filter((r) => r.org_id === v.id);
        const ok = (reqId: string) => {
          const r = mine.find((x) => x.requirement_id === reqId);
          const g = gateList.find((x) => x.id === reqId);
          if (!r || !g) return false;
          if (r.result === "not_applicable") return g.allows_not_applicable;
          if (g.expiry_required && !r.expires_on) return false;
          const fresh = !r.expires_on || r.expires_on >= today;
          if (r.result === "equivalent_verified") return g.allows_equivalent && fresh;
          return r.result === "verified_meets" && fresh;
        };
        gateStatus.set(v.id, {
          passed: gateList.filter((g) => ok(g.id)).length,
          total: gateList.length,
          expired: gateList.filter((g) => {
            const r = mine.find((x) => x.requirement_id === g.id);
            return !!r && (r.result === "verified_meets" || r.result === "equivalent_verified") && !!r.expires_on && r.expires_on < today;
          }).length,
          blockingClear: gateList.filter((g) => g.requirement_level === "blocking").every((g) => ok(g.id)),
        });
      }
      const compliance = new Map<string, ReturnType<typeof vendorCompliance>>();
      for (const v of vendors.data ?? []) {
        compliance.set(v.id, vendorCompliance(gateList, (results.data ?? []).filter((r) => r.org_id === v.id), today));
      }
      return {
        compliance,
        vendors: vendors.data ?? [],
        markets: (markets.data ?? []).map((m) => m.code),
        categories: categories.data ?? [],
        coverage: coverage.data ?? [],
        customFields: fields.data ?? [],
        savedViews: views.data ?? [],
        gateStatus,
      };
    },
  });
}

export function useInvalidateVendors() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: VENDOR_WS_KEY });
}

/** Market/category/preference rows for a vendor, for the Directory card. */
export function coverageFor(vendorId: string, coverage: CoverageRecord[]) {
  return coverage.filter((c) => c.org_id === vendorId);
}

export function errorText(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong.";
}

/**
 * Approved/Gold only count while every Must Pass gate currently passes —
 * an expired insurance or licence puts the vendor on hold until corrected.
 * Mirrors public.vendor_dispatch_eligible in the database.
 */
export function qualificationHold(v: Pick<VendorRecord, "id" | "status">, gateStatus: Map<string, { blockingClear: boolean }>) {
  return (v.status === "approved" || v.status === "gold") && !gateStatus.get(v.id)?.blockingClear;
}

/**
 * Can this vendor be picked for new Ticket/Work Order work right now?
 * Mirrors public.vendor_dispatch_eligible (the database re-checks on save).
 */
export function canTakeWork(
  v: Pick<VendorRecord, "id" | "status" | "is_active" | "critical_failure" | "transitional_review" | "transitional_deadline">,
  gateStatus: Map<string, { blockingClear: boolean }>,
  compliance: Map<string, { state: string }>,
  today = new Date().toISOString().slice(0, 10),
) {
  if (!v.is_active || v.status === "suspended") return false;
  if (compliance.get(v.id)?.state === "expired") return false;
  if (inTransitionalReview(v, today) && !v.critical_failure) return true;
  if (!["pilot", "approved", "gold", "corrective_action"].includes(v.status)) return false;
  if ((v.status === "approved" || v.status === "gold") && (!gateStatus.get(v.id)?.blockingClear || v.critical_failure)) return false;
  return true;
}

/** Existing ARHA Vendor — Transitional Review, still inside its window. Not a lifecycle status. */
export function inTransitionalReview(
  v: Pick<VendorRecord, "transitional_review" | "transitional_deadline">,
  today = new Date().toISOString().slice(0, 10),
) {
  return v.transitional_review && !!v.transitional_deadline && v.transitional_deadline >= today;
}

export function transitionalDaysLeft(v: Pick<VendorRecord, "transitional_deadline">, today = new Date()) {
  if (!v.transitional_deadline) return null;
  const d = new Date(v.transitional_deadline + "T00:00:00Z").getTime();
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((d - t) / 86_400_000);
}
