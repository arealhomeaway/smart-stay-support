/**
 * 3.2: the home's Stager shows on its Vendors and work tab with contact buttons.
 * One Stager per home (Nov 17), picked from the vendor database (onboarding_project_stagers).
 * Shows nothing while the home has no stager.
 */
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, Phone } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export type Stager = { vendor_org_id: string; vendor_orgs: { display_name: string | null; legal_name: string | null; primary_contact_name: string | null; primary_contact_phone: string | null; primary_contact_email: string | null } | null };

/** The home's live Stager link (newest first; the database keeps one). */
export function useProjectStagers(projectId: string | null) {
  return useQuery({
    queryKey: ["project-stagers", projectId],
    enabled: Boolean(projectId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as SupabaseClient)
        .from("onboarding_project_stagers")
        .select("vendor_org_id, vendor_orgs(display_name, legal_name, primary_contact_name, primary_contact_phone, primary_contact_email)")
        .eq("project_id", projectId!)
        .is("removed_at", null)
        .order("added_at", { ascending: false });
      if (error) return [] as Stager[];
      return (data ?? []) as unknown as Stager[];
    },
  });
}

export function stagerLabel(s: Stager | null): string | null {
  if (!s) return null;
  return s.vendor_orgs?.display_name || s.vendor_orgs?.legal_name || "Stager";
}

export function ProjectStagersCard({ projectId }: { projectId: string | null }) {
  const q = useProjectStagers(projectId);
  const r = q.data?.[0] ?? null;
  if (!r) return null;
  const v = r.vendor_orgs;
  const name = stagerLabel(r);
  const phone = v?.primary_contact_phone?.trim() || null;
  const email = v?.primary_contact_email?.trim() || null;
  return (
    <section className="surface space-y-2 p-4" aria-label="Stager">
      <h2 className="font-semibold">Stager</h2>
      <div className="flex flex-wrap items-center gap-2 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{name}</p>
          {v?.primary_contact_name ? <p className="text-xs text-muted-foreground">{v.primary_contact_name}</p> : null}
        </div>
        {phone ? (
          <>
            <Button asChild size="sm" variant="outline" className="min-h-11 gap-1">
              <a href={`tel:${phone}`}><Phone className="size-4" /> Call</a>
            </Button>
            <Button asChild size="sm" variant="outline" className="min-h-11 gap-1">
              <a href={`sms:${phone}`}><MessageSquare className="size-4" /> Text</a>
            </Button>
          </>
        ) : null}
        {email ? (
          <Button asChild size="sm" variant="outline" className="min-h-11 gap-1">
            <a href={`mailto:${email}`}><Mail className="size-4" /> Email</a>
          </Button>
        ) : null}
        {!phone && !email ? <span className="text-xs text-muted-foreground">No contact on file</span> : null}
      </div>
    </section>
  );
}
