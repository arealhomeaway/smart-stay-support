/**
 * Field work booked for one home during onboarding — read-only.
 *
 * Reads the two places the work already lives: jobs pushed to Breezeway and
 * work orders tracked in Resolve for vendors who are not in Breezeway. It
 * creates nothing and dispatches nothing; dispatch stays where it already is.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mergeWorkOrders, workOrderCounts, type BreezewayRow, type VendorRow } from "./onboarding-work-orders";

type Client = SupabaseClient<Database>;

async function assertStaff(db: Client, userId: string) {
  const { data, error } = await db.rpc("is_internal_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can see this home's work orders.");
}

export async function loadOnboardingWorkOrders(db: Client, userId: string, propertyId: string) {
  await assertStaff(db, userId);

  const [pushed, vendor] = await Promise.all([
    db
      .from("breezeway_outbound_tasks")
      .select("id, title, status, scheduled_date, assignee_names, onboarding_task_id, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    db
      .from("work_orders")
      .select("id, title, phase, vendor_name, scheduled_for, closed_at, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
  ]);
  if (pushed.error) throw pushed.error;
  if (vendor.error) throw vendor.error;

  const orders = mergeWorkOrders(
    (pushed.data ?? []) as unknown as BreezewayRow[],
    (vendor.data ?? []) as unknown as VendorRow[],
  );
  return { orders, counts: workOrderCounts(orders) };
}
