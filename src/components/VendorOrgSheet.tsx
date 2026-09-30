/**
 * One vendor company: screening, coverage, team and status history.
 *
 * Everything a supervisor needs to answer "can we send this company work, and
 * where?" — and nothing a vendor should ever see about another vendor.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, CircleSlash, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addVendorCoverage,
  changeVendorStatus,
  dropVendorCoverage,
  recordGatekeeperResult,
  vendorOrgDetail,
} from "@/lib/vendors.functions";
import {
  COVERAGE_PRIORITIES,
  COVERAGE_PRIORITY_LABELS,
  allowedResults,
  linePasses,
  GATEKEEPER_RESULT_LABELS,
  REQUIREMENT_LEVEL_LABELS,
  SERVICE_CATEGORIES,
  VENDOR_STATUSES,
  VENDOR_STATUS_BLURBS,
  VENDOR_STATUS_LABELS,
  effectiveResult,
  reputationGate,
  type CoveragePriority,
  type GatekeeperResult,
  type VendorStatus,
} from "@/lib/vendors";
import { GateRow, type GateSave } from "@/components/vendors/GateRow";
import { VendorDocumentsPanel } from "@/components/VendorDocumentsPanel";
import { VendorTerritoryPanel } from "@/components/VendorTerritoryPanel";
import { Badge } from "@/components/ui/badge";
import { usDateTime } from "@/lib/dates";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PropertyOption = { id: string; label: string };

export function VendorOrgSheet({
  orgId,
  onOpenChange,
  properties,
  canManage,
}: {
  orgId: string | null;
  onOpenChange: (open: boolean) => void;
  properties: PropertyOption[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(vendorOrgDetail);
  const changeStatus = useServerFn(changeVendorStatus);
  const setResult = useServerFn(recordGatekeeperResult);
  const addCoverage = useServerFn(addVendorCoverage);
  const removeCoverage = useServerFn(dropVendorCoverage);

  const [statusChoice, setStatusChoice] = useState<VendorStatus | "">("");
  const [statusReason, setStatusReason] = useState("");
  const [coverageProperty, setCoverageProperty] = useState("");
  const [coverageCategory, setCoverageCategory] = useState("");
  const [coveragePriority, setCoveragePriority] = useState<CoveragePriority>("primary");
  const [coverageLimit, setCoverageLimit] = useState("");
  const [coverageAccess, setCoverageAccess] = useState("");

  const detail = useQuery({
    queryKey: ["vendor-org", orgId],
    queryFn: () => load({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["vendor-org", orgId] });
    void qc.invalidateQueries({ queryKey: ["vendor-directory"] });
  };

  const statusMutation = useMutation({
    mutationFn: () =>
      changeStatus({
        data: { orgId: orgId!, status: statusChoice as VendorStatus, reason: statusReason },
      }),
    onSuccess: () => {
      toast.success("Status updated and recorded.");
      setStatusReason("");
      setStatusChoice("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resultMutation = useMutation({
    mutationFn: (input: GateSave) => setResult({ data: { orgId: orgId!, ...input } }),
    onSuccess: () => {
      toast.success("Screening item updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const coverageMutation = useMutation({
    mutationFn: () =>
      addCoverage({
        data: {
          orgId: orgId!,
          propertyId: coverageProperty,
          serviceCategory: coverageCategory,
          coveragePriority,
          approvalLimit: coverageLimit ? Number(coverageLimit) : null,
          accessRequirements: coverageAccess || null,
        },
      }),
    onSuccess: () => {
      toast.success("Coverage added.");
      setCoverageProperty("");
      setCoverageCategory("");
      setCoverageLimit("");
      setCoverageAccess("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dropMutation = useMutation({
    mutationFn: (coverageId: string) => removeCoverage({ data: { coverageId } }),
    onSuccess: () => {
      toast.success("Coverage removed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = detail.data;
  const org = data?.org;
  const reputation = org ? reputationGate(org.google_rating, org.google_review_count) : null;

  return (
    <Sheet open={Boolean(orgId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {detail.isLoading || !org ? (
          <div className="space-y-3 pt-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{org.display_name}</SheetTitle>
              <SheetDescription>
                {VENDOR_STATUS_LABELS[org.status as VendorStatus]} —{" "}
                {VENDOR_STATUS_BLURBS[org.status as VendorStatus]}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="screening" className="mt-4">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
                <TabsTrigger value="screening">Screening</TabsTrigger>
                <TabsTrigger value="coverage">Coverage</TabsTrigger>
                <TabsTrigger value="territory">Territory</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="screening" className="space-y-4 pt-4">
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    {data.readiness.clear
                      ? "All blocking items are verified."
                      : "Not approvable yet."}
                  </p>
                  <p className="text-muted-foreground">
                    {data.readiness.passed} of {data.readiness.total} screening items verified.
                    {data.readiness.blockersFailing.length > 0 &&
                      ` Still open: ${data.readiness.blockersFailing.map((l) => l.label).join(", ")}.`}
                  </p>
                </div>

                {reputation && (
                  <div className="rounded-lg border border-dashed p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Google reputation (outside signal, not an ARHA score)
                    </p>
                    <p className="mt-1 font-medium">{reputation.headline}</p>
                    <p className="text-muted-foreground">{reputation.requirement}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {data.gatekeeper.map((line) => (
                    <GateRow
                      key={`${line.requirementId}-${line.verifiedAt ?? ""}-${line.result}`}
                      line={line}
                      documents={data.documents.map((d) => ({ id: d.id, title: d.title, docType: d.docType }))}
                      canManage={canManage}
                      saving={resultMutation.isPending}
                      onSave={(v) => resultMutation.mutate(v)}
                    />
                  ))}
                </div>

                {canManage && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Change status</Label>
                      <Select
                        value={statusChoice}
                        onValueChange={(v) => setStatusChoice(v as VendorStatus)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a new status" />
                        </SelectTrigger>
                        <SelectContent>
                          {VENDOR_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {VENDOR_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        placeholder="Why is this changing? This goes on the permanent record."
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                        maxLength={600}
                      />
                      <Button
                        onClick={() => statusMutation.mutate()}
                        disabled={
                          !statusChoice ||
                          statusReason.trim().length < 5 ||
                          statusMutation.isPending
                        }
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Record status change
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="coverage" className="space-y-4 pt-4">
                {data.coverage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No homes assigned yet. Coverage is what makes this vendor the right first call
                    for a property.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.coverage.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="text-sm">
                          <p className="font-medium">{c.propertyName}</p>
                          <p className="text-muted-foreground">
                            {c.serviceCategory} ·{" "}
                            {COVERAGE_PRIORITY_LABELS[c.coveragePriority as CoveragePriority] ??
                              c.coveragePriority}
                            {c.approvalLimit != null && ` · approval limit $${c.approvalLimit}`}
                          </p>
                          {c.accessRequirements && (
                            <p className="text-xs text-muted-foreground">
                              Access: {c.accessRequirements}
                            </p>
                          )}
                        </div>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => dropMutation.mutate(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canManage && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <Label>Add coverage</Label>
                    <Select value={coverageProperty} onValueChange={setCoverageProperty}>
                      <SelectTrigger>
                        <SelectValue placeholder="Home" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={coverageCategory} onValueChange={setCoverageCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Service" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={coveragePriority}
                      onValueChange={(v) => setCoveragePriority(v as CoveragePriority)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COVERAGE_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {COVERAGE_PRIORITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Approval limit in dollars (optional)"
                      value={coverageLimit}
                      onChange={(e) => setCoverageLimit(e.target.value.replace(/[^0-9.]/g, ""))}
                    />
                    <Input
                      placeholder="Access requirements (lockbox, gate code, escort…)"
                      value={coverageAccess}
                      onChange={(e) => setCoverageAccess(e.target.value)}
                      maxLength={600}
                    />
                    <Button
                      onClick={() => coverageMutation.mutate()}
                      disabled={
                        !coverageProperty || !coverageCategory || coverageMutation.isPending
                      }
                    >
                      Add coverage
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="territory">
                <VendorTerritoryPanel
                  orgId={org.id}
                  areas={data.serviceAreas}
                  canManage={canManage}
                  onChanged={refresh}
                />
              </TabsContent>

              <TabsContent value="documents">
                <VendorDocumentsPanel
                  orgId={org.id}
                  documents={data.documents}
                  canManage={canManage}
                  onChanged={refresh}
                />
              </TabsContent>

              <TabsContent value="team" className="space-y-3 pt-4">
                <p className="text-xs text-muted-foreground">
                  ARHA schedules the masked code, never a worker's personal name. Vendor admins
                  manage their own team.
                </p>
                {data.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No logins attached to this company yet.
                  </p>
                ) : (
                  data.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <span className="font-medium">{m.maskedCode}</span>
                      <span className="text-muted-foreground">
                        {m.vendorRole} · {m.active ? "active" : "inactive"} ·{" "}
                        {m.attestedAt ? "attested" : "attestation pending"}
                      </span>
                    </div>
                  ))
                )}
                {data.contacts.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Contacts without a login
                    </p>
                    {data.contacts.map((c) => (
                      <div key={c.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-muted-foreground">
                          {[c.email, c.phone].filter(Boolean).join(" · ") ||
                            "No contact details on file"}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-3 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status history
                </p>
                {data.statusHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
                ) : (
                  data.statusHistory.map((e) => (
                    <div key={e.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">
                        {e.from_status
                          ? `${e.from_status} → ${e.to_status}`
                          : `Created as ${e.to_status}`}
                      </p>
                      <p className="text-muted-foreground">{e.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {usDateTime(e.created_at)} · {e.actor_label ?? "Unknown"}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
