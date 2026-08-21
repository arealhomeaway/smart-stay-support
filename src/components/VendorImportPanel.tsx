/**
 * Legacy vendor migration review.
 *
 * Pasted legacy rows never become live vendors on their own — each one shows
 * what the system thinks it is, why, and waits for a person to decide.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { decideVendorImportRow, stageLegacyVendors, vendorImportQueue } from "@/lib/vendors.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function VendorImportPanel() {
  const qc = useQueryClient();
  const stage = useServerFn(stageLegacyVendors);
  const loadQueue = useServerFn(vendorImportQueue);
  const decide = useServerFn(decideVendorImportRow);

  const [label, setLabel] = useState("Breezeway service providers");
  const [text, setText] = useState("");

  const queue = useQuery({ queryKey: ["vendor-import-queue"], queryFn: () => loadQueue() });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["vendor-import-queue"] });
    void qc.invalidateQueries({ queryKey: ["vendor-directory"] });
  };

  const stageMutation = useMutation({
    mutationFn: () => stage({ data: { sourceSystem: "breezeway", label, text } }),
    onSuccess: (r) => {
      toast.success(`${r.rowCount} row${r.rowCount === 1 ? "" : "s"} staged for review.`);
      setText("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideMutation = useMutation({
    mutationFn: (input: { rowId: string; action: "create" | "match" | "skip"; orgId?: string | null }) =>
      decide({ data: { rowId: input.rowId, action: input.action, orgId: input.orgId ?? null } }),
    onSuccess: () => {
      toast.success("Decision recorded.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = queue.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Import a legacy vendor list</CardTitle>
          <CardDescription>
            One vendor per line: name, role, email, phone, departments, groups — tab or comma separated. A CSV export
            from the old system pastes straight in. The Breezeway people directory export and the Notion Vendor Database
            export are each recognised on their own and read by column name — Breezeway brings across departments,
            groups and export notes; Notion brings across specialty, market, pricing, contact and compliance notes.
            Nothing imports as approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="import-label">Batch name</Label>
            <Input id="import-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="import-file">Or pick a CSV file</Label>
            <Input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setText(await file.text());
                setLabel(file.name.replace(/\.csv$/i, "").slice(0, 120));
                toast.success("File loaded — review the row count, then stage it.");
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="import-text">Rows</Label>
            <Textarea
              id="import-text"
              rows={6}
              placeholder="ModMaids, Service Provider, info@modmaids.com, 405-555-0100, Cleaning, Edmond"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <Button onClick={() => stageMutation.mutate()} disabled={text.trim().length < 3 || stageMutation.isPending}>
            <Upload className="mr-2 h-4 w-4" />
            Stage for review
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waiting on a decision</CardTitle>
          <CardDescription>
            {rows.length === 0 ? "Nothing pending." : `${rows.length} row${rows.length === 1 ? "" : "s"} to review.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {queue.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.displayName}</span>
                  <Badge variant="secondary">
                    {r.sourceRole === "service_provider" ? "Company" : "Person"}
                  </Badge>
                  <Badge variant={r.proposedAction === "needs_review" ? "destructive" : "outline"}>
                    Proposed: {r.proposedAction.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[r.email, r.phone].filter(Boolean).join(" · ") || "No contact details"}
                  {r.departments.length > 0 && ` · legacy services: ${r.departments.join(", ")}`}
                  {r.groups.length > 0 && ` · legacy groups: ${r.groups.join(", ")}`}
                </p>
                {r.profile && (
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    <p>
                      {[
                        r.profile.contactPerson,
                        r.profile.specialties.join(", ") || null,
                        r.profile.markets.join(", ") || null,
                        r.profile.pricing,
                        r.profile.paymentType,
                        r.profile.legacyStatus ? `Notion status: ${r.profile.legacyStatus}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {r.profile.claims.length > 0 && (
                      <p>Recorded, still unverified — {r.profile.claims.join("; ")}.</p>
                    )}
                    {r.profile.comments && <p>{r.profile.comments}</p>}
                  </div>
                )}
                {r.matchReasons.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.matchOrgName ? `Possible match: ${r.matchOrgName}. ` : ""}
                    {r.matchReasons.join("; ")}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => decideMutation.mutate({ rowId: r.id, action: "create" })}
                    disabled={decideMutation.isPending}
                  >
                    Create as legacy vendor
                  </Button>
                  {r.matchOrgId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideMutation.mutate({ rowId: r.id, action: "match", orgId: r.matchOrgId })}
                      disabled={decideMutation.isPending}
                    >
                      Attach to {r.matchOrgName}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => decideMutation.mutate({ rowId: r.id, action: "skip" })}
                    disabled={decideMutation.isPending}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
