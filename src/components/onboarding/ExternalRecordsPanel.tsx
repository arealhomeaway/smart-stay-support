import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ExternalDatabase = {
  key: string;
  label: string;
  source: string;
  description: string | null;
  external_database_id: string | null;
  sync_enabled: boolean;
  read_only: boolean;
  verified: boolean;
};

export type ExternalRecord = {
  id: string;
  database_key: string;
  source: string;
  external_id: string;
  title: string | null;
  payload: unknown;
  property_id: string | null;
  ownerrez_property_id: string | null;
  match_status: string;
  match_note: string | null;
  created_at: string;
};

type Property = { id: string; name: string; ownerrez_property_id?: string | null };

/**
 * One standard framework for every external database — Notion databases, the
 * Property Utility Matrix and Fillout-replacement forms are all handled here
 * with the same rules: canonical property matching only (Resolve UUID or
 * OwnerRez Property ID, never a name), a human review queue for anything
 * unmatched, and archive instead of delete.
 */
export function ExternalRecordsPanel({
  databases,
  records,
  properties,
  syncConfigured,
  disabled,
  onResolve,
}: {
  databases: ExternalDatabase[];
  records: ExternalRecord[];
  properties: Property[];
  syncConfigured: boolean;
  disabled: boolean;
  onResolve: (input: {
    recordId: string;
    propertyId: string | null;
    ownerrezPropertyId: string | null;
    decision: "match" | "review" | "archive";
    note: string;
  }) => void;
}) {
  const [dbKey, setDbKey] = useState<string>("all");
  const queue = useMemo(
    () =>
      records.filter(
        (r) => r.match_status !== "matched" && (dbKey === "all" || r.database_key === dbKey),
      ),
    [records, dbKey],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source databases</CardTitle>
          <CardDescription>
            Notion stays the editable source of truth during the transition. Synchronisation is read-only
            configuration and stays disabled until the connection and exact database IDs are verified —
            Resolve never writes to Notion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {databases.map((d) => (
            <div key={d.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">
                  {d.description} · source: {d.source} · database ID{" "}
                  {d.external_database_id ? d.external_database_id : "not verified"}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{d.read_only ? "Read-only" : "Writable"}</Badge>
                <Badge variant="outline" className={d.sync_enabled ? "bg-emerald-100 text-emerald-900" : ""}>
                  {d.sync_enabled ? "Sync on" : "Sync disabled"}
                </Badge>
                <Badge variant="outline">{d.verified ? "Verified" : "Unverified"}</Badge>
              </div>
            </div>
          ))}
          {!syncConfigured && (
            <p className="text-xs text-muted-foreground">
              The onboarding external-sync workflow control is off, so nothing is imported automatically.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unmatched record review</CardTitle>
          <CardDescription>
            {queue.length} record(s) need a human decision. A record can never create a property.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-64">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Database</Label>
            <Select value={dbKey} onValueChange={setDbKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All databases</SelectItem>
                {databases.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {queue.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing is waiting for review.</p>
          )}
          {queue.map((r) => (
            <RecordRow key={r.id} record={r} properties={properties} disabled={disabled} onResolve={onResolve} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RecordRow({
  record,
  properties,
  disabled,
  onResolve,
}: {
  record: ExternalRecord;
  properties: Property[];
  disabled: boolean;
  onResolve: (input: {
    recordId: string;
    propertyId: string | null;
    ownerrezPropertyId: string | null;
    decision: "match" | "review" | "archive";
    note: string;
  }) => void;
}) {
  const [propertyId, setPropertyId] = useState("none");
  const [ownerrez, setOwnerrez] = useState(record.ownerrez_property_id ?? "");

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{record.title ?? record.external_id}</p>
          <p className="text-xs text-muted-foreground">
            {record.database_key} · external ID {record.external_id} · {record.match_status}
          </p>
        </div>
        <Badge variant="outline">{record.source}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={propertyId} onValueChange={setPropertyId} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Match to a Resolve property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No property selected</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={ownerrez}
          onChange={(e) => setOwnerrez(e.target.value)}
          placeholder="or OwnerRez Property ID"
          disabled={disabled}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={disabled || (propertyId === "none" && !ownerrez.trim())}
          onClick={() =>
            onResolve({
              recordId: record.id,
              propertyId: propertyId === "none" ? null : propertyId,
              ownerrezPropertyId: ownerrez.trim() || null,
              decision: "match",
              note: "",
            })
          }
        >
          Match
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            onResolve({
              recordId: record.id,
              propertyId: null,
              ownerrezPropertyId: null,
              decision: "review",
              note: "Needs a second look",
            })
          }
        >
          Flag for review
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            onResolve({
              recordId: record.id,
              propertyId: null,
              ownerrezPropertyId: null,
              decision: "archive",
              note: "Archived from the review queue",
            })
          }
        >
          Archive
        </Button>
      </div>
    </div>
  );
}
