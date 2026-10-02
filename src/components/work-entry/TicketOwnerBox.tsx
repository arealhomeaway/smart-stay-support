import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPropertyContactContext } from "@/lib/guest-context.functions";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import { insuranceFlagged, ownerSectionRelevant } from "@/lib/work-entry";

/**
 * Compact owner section on a Maintenance Ticket — only when owner contact or
 * approval is potentially relevant (over the policy threshold, or a possible
 * insured loss). Approval itself runs through the existing Work Order owner
 * approval; nothing here sends anything on its own.
 */
export function TicketOwnerBox({
  ticket,
  workOrderCosts,
}: {
  ticket: {
    property_id: string | null;
    entry_kind?: string | null;
    insurance_risk?: string | null;
    estimated_cost?: number | string | null;
    is_demo?: boolean | null;
  };
  workOrderCosts: (number | string | null | undefined)[];
}) {
  const { can, isVendor, isOwner } = useRole();
  const { demoMode } = useDemo();
  const fetchContext = useServerFn(getPropertyContactContext);
  const relevance = ownerSectionRelevant(ticket, workOrderCosts);
  const staff = can("guest_contact") && !isVendor && !isOwner;
  const enabled = relevance.relevant && staff && Boolean(ticket.property_id) && !demoMode;
  const { data } = useQuery({
    queryKey: ["property-contact-context", ticket.property_id],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchContext({ data: { propertyId: ticket.property_id! } }),
  });
  if (!relevance.relevant || !staff) return null;
  const owner = data && data.visible !== false ? data.owner : null;
  const email = owner?.status === "matched" ? owner.email : null;

  return (
    <Card data-testid="ticket-owner-box">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4" /> Owner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {insuranceFlagged(ticket.insurance_risk) && (
          <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            Potential insurance-related event ({ticket.insurance_risk === "yes" ? "Yes" : "Unsure"}). Flagged for
            supervisors. No insurance action is taken automatically.
          </p>
        )}
        <ul className="list-disc pl-4 text-xs text-muted-foreground">
          {relevance.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {owner?.status === "matched" && <p className="font-medium">{owner.name ?? "Owner on file"}</p>}
        {demoMode && <p className="text-xs text-muted-foreground">Owner contact is hidden on demo records.</p>}
        <div className="flex flex-wrap gap-2">
          {ticket.property_id && (
            <Button asChild size="sm" variant="outline">
              <Link to="/property/$propertyId" params={{ propertyId: ticket.property_id }}>
                View Owner
              </Link>
            </Button>
          )}
          <Button asChild={Boolean(email)} size="sm" variant="outline" disabled={!email}>
            {email ? <a href={`mailto:${email}`}>Email Owner</a> : <span>Email Owner</span>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              (document.querySelector("[data-ticket-work-orders]") ?? document.querySelector("[data-current-work]"))?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Review Owner Approval
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="owner-approval-note">
          Owner approval may be required. Nothing is sent from here — the approval request is sent
          from the Work Order once a scope and cost (quote) are available, under the maintenance
          policy.
        </p>
      </CardContent>
    </Card>
  );
}
