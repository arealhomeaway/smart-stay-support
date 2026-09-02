/**
 * Property context, without leaving the ticket.
 *
 * The property on a ticket is the single most-consulted piece of supporting
 * information, so it opens as a drawer over the work rather than sending the
 * employee out to Properties to search for a home they are already looking at.
 * Deeper work still has a home: "Open full Property Hub" carries the ticket
 * origin so the employee comes straight back.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SpecialHandlingNotice } from "@/components/SpecialHandlingNotice";
import { useRole } from "@/hooks/useRole";

export function PropertyContextDrawer({
  propertyId,
  open,
  onOpenChange,
  originToken,
}: {
  propertyId: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originToken?: string | undefined;
}) {
  const { can } = useRole();
  const { data } = useQuery({
    queryKey: ["property-context", propertyId],
    enabled: Boolean(propertyId) && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const address = [data?.address_line1, data?.unit, data?.city, data?.state].filter(Boolean).join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{data?.nickname ?? data?.name ?? "Property"}</span>
          </SheetTitle>
          <SheetDescription>{address || "No address on file"}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <SpecialHandlingNotice propertyId={propertyId} moment="maintenance" />

          <Facts
            rows={[
              ["Market", data?.market],
              ["Neighbourhood", data?.neighborhood],
              ["Status", data?.lifecycle_status?.replace(/_/g, " ")],
              ["Check-in", data?.check_in_time],
              ["Check-out", data?.check_out_time],
              ["Bedrooms", data?.bedrooms != null ? String(data.bedrooms) : null],
              ["Bathrooms", data?.bathrooms != null ? String(data.bathrooms) : null],
            ]}
          />

          {can("properties") && data?.access_notes && (
            <Block title="Access notes" body={data.access_notes} />
          )}
          {data?.wifi_notes && <Block title="Wi-Fi" body={data.wifi_notes} />}
          {data?.notes && <Block title="Notes" body={data.notes} />}

          {data?.ownerrez_property_id && (
            <p className="text-xs text-muted-foreground">
              OwnerRez ID <span className="numeric">{data.ownerrez_property_id}</span>
            </p>
          )}

          {propertyId && (
            <Button asChild variant="outline" className="w-full">
              <Link
                to="/property/$propertyId"
                params={{ propertyId }}
                search={(originToken ? { from: originToken } : undefined) as never}
              >
                <ExternalLink className="size-4" aria-hidden="true" /> Open full Property Hub
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  const visible = rows.filter(([, v]) => Boolean(v));
  if (visible.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {visible.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </div>
  );
}
