import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Property = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  access_notes: string | null;
  wifi_notes: string | null;
  ownerrez_property_id?: string | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  exception_reason?: string | null;
  linked_ticket_id?: string | null;
  evidence_required: boolean;
  evidence_note: string | null;
};

type ExternalRecord = {
  id: string;
  database_key: string;
  title: string | null;
  property_id: string | null;
  payload: unknown;
};

type DocumentRow = {
  id: string;
  entity_id: string;
  title: string;
  kind: string | null;
  external_url: string | null;
  required: boolean | null;
};

/** Everything Operations needs before accepting a home. Internal staff only. */
export function OperationsContextPanel({
  property,
  tasks,
  records,
  documents,
  documentsEnabled,
}: {
  property: Property;
  tasks: Task[];
  records: ExternalRecord[];
  documents: DocumentRow[];
  documentsEnabled: boolean;
}) {
  const matched = records.filter((r) => r.property_id === property.id);
  const utilities = matched.filter((r) => r.database_key === "property_utility_matrix");
  const access = matched.filter((r) => r.database_key === "property_access_details");
  const exceptions = tasks.filter((t) => (t.exception_reason ?? "").trim());
  const evidence = tasks.filter((t) => t.evidence_required);
  const linked = tasks.filter((t) => t.linked_ticket_id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Operations context</CardTitle>
        <CardDescription>Shown to Operations before they accept the handoff.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Property
          </p>
          <p>Resolve property ID: {property.id}</p>
          <p>OwnerRez Property ID: {property.ownerrez_property_id ?? "not linked"}</p>
          <p>
            {[property.address_line1, property.city, property.state, property.postal_code]
              .filter(Boolean)
              .join(", ") || "Address incomplete"}
          </p>
        </section>

        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Access
          </p>
          <p>{property.access_notes?.trim() || "No access instructions recorded."}</p>
          {access.map((r) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              {r.title ?? "Access record"} (matched external record)
            </p>
          ))}
        </section>

        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Utilities
          </p>
          {utilities.length === 0 ? (
            <p className="text-muted-foreground">No matched utility record for this home yet.</p>
          ) : (
            utilities.map((r) => (
              <p key={r.id} className="text-xs text-muted-foreground">
                {r.title ?? "Utility record"} (matched external record)
              </p>
            ))
          )}
        </section>

        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documents
          </p>
          {!documentsEnabled ? (
            <p className="text-muted-foreground">
              Document links are turned off until the SharePoint connection is confirmed scoped to
              the approved folder.
            </p>
          ) : documents.filter((d) => d.entity_id === property.id).length === 0 ? (
            <p className="text-muted-foreground">No documents linked yet.</p>
          ) : (
            documents
              .filter((d) => d.entity_id === property.id)
              .map((d) => (
                <p key={d.id} className="text-xs">
                  {d.title} {d.required ? "· required" : ""}
                </p>
              ))
          )}
        </section>

        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Readiness evidence & exceptions
          </p>
          <p className="text-xs text-muted-foreground">
            {evidence.length} task(s) require evidence · {exceptions.length} recorded exception(s)
          </p>
          {exceptions.map((t) => (
            <p key={t.id} className="text-xs">
              <Badge variant="warning" className="mr-2">
                Exception
              </Badge>
              {t.title}: {t.exception_reason}
            </p>
          ))}
        </section>

        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Linked tickets
          </p>
          {linked.length === 0 ? (
            <p className="text-muted-foreground">
              No onboarding item is linked to an Operations ticket.
            </p>
          ) : (
            linked.map((t) => (
              <p key={t.id} className="text-xs">
                {t.title} → ticket {String(t.linked_ticket_id).slice(0, 8)}
              </p>
            ))
          )}
        </section>
      </CardContent>
    </Card>
  );
}
