import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Chip, EmptyState } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UTILITY_STATUS_LABELS,
  UTILITY_TYPES,
  FACT_FIELDS,
  isConflict,
  isStaleFact,
  pendingFacts,
  utilityLabel,
  utilitySpend,
  utilityStatusLabel,
  utilitiesNotReady,
  type FactProposal,
  type UtilityAccount,
  type UtilityCost,
} from "@/lib/onboarding-finance";
import {
  decideFactFn,
  proposeFactFn,
  getOnboardingFinance,
  recordUtilityCostFn,
  saveUtilityAccountFn,
} from "@/lib/onboarding-finance.functions";

const money = (n: number) =>
  `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function PropertyFactsPanel({
  propertyId,
  canEdit,
}: {
  propertyId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getOnboardingFinance);
  const { data, isLoading, error } = useQuery({
    queryKey: ["onboarding-finance", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["onboarding-finance", propertyId] });
    void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
  };
  const [factDraft, setFactDraft] = useState({
    fieldKey: "wifi_notes",
    proposedValue: "",
    sourceDetail: "",
  });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const propose = useMutation({
    mutationFn: useServerFn(proposeFactFn),
    onSuccess: () => {
      toast.success("Change proposed for review.");
      setFactDraft((draft) => ({ ...draft, proposedValue: "", sourceDetail: "" }));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveUtility = useMutation({
    mutationFn: useServerFn(saveUtilityAccountFn),
    onSuccess: () => {
      toast.success("Utility saved.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addCost = useMutation({
    mutationFn: useServerFn(recordUtilityCostFn),
    onSuccess: () => {
      toast.success("Cost recorded.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideFact = useMutation({
    mutationFn: useServerFn(decideFactFn),
    onSuccess: () => {
      toast.success("Fact reviewed.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newUtility, setNewUtility] = useState({
    utilityType: "electric",
    provider: "",
    status: "needed",
  });
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});

  if (error) return <p role="alert">Property facts could not be loaded: {error.message}</p>;
  if (isLoading || !data) return <p className="text-muted-foreground">Loading property facts…</p>;

  const utilities = (data.utilities ?? []) as unknown as UtilityAccount[];
  const costs = (data.utilityCosts ?? []) as unknown as UtilityCost[];
  const facts = (data.factProposals ?? []) as unknown as FactProposal[];
  const pending = pendingFacts(facts);
  const notReady = utilitiesNotReady(utilities);
  const owner = data.ownerContact;
  const currentFacts = data.currentFacts as Record<string, string | null> | null;
  const currentValue = (key: string) => currentFacts?.[key] ?? null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Homeowner contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {owner ? (
            <>
              <p className="font-medium">{owner.owner_name || "Homeowner"}</p>
              {owner.owner_email ? (
                <p>
                  <a className="underline" href={`mailto:${owner.owner_email}`}>
                    {owner.owner_email}
                  </a>
                </p>
              ) : null}
              {owner.owner_phone ? (
                <p>
                  <a className="underline" href={`tel:${owner.owner_phone}`}>
                    {owner.owner_phone}
                  </a>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">No homeowner contact on file for this home yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permanent property facts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit ? (
            <form
              className="space-y-3 rounded-lg border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                propose.mutate({ data: { propertyId, ...factDraft } });
              }}
            >
              <Label htmlFor="fact-field">Propose a change</Label>
              <select
                id="fact-field"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={factDraft.fieldKey}
                onChange={(event) => setFactDraft({ ...factDraft, fieldKey: event.target.value })}
              >
                {Object.entries(FACT_FIELDS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="whitespace-pre-wrap break-words text-sm">
                Current value: {currentValue(factDraft.fieldKey) ?? "Not recorded"}
              </p>
              <Label htmlFor="fact-value">Proposed value</Label>
              <Textarea
                id="fact-value"
                required
                maxLength={2000}
                value={factDraft.proposedValue}
                onChange={(event) =>
                  setFactDraft({ ...factDraft, proposedValue: event.target.value })
                }
              />
              <Label htmlFor="fact-source">Observation or evidence reference</Label>
              <Textarea
                id="fact-source"
                maxLength={500}
                value={factDraft.sourceDetail}
                onChange={(event) =>
                  setFactDraft({ ...factDraft, sourceDetail: event.target.value })
                }
              />
              <Button type="submit" disabled={propose.isPending || !factDraft.proposedValue.trim()}>
                {propose.isPending ? "Submitting…" : "Submit for review"}
              </Button>
            </form>
          ) : null}
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing to review"
              hint="Proposed changes to permanent property facts land here."
            />
          ) : (
            pending.map((f) => (
              <div key={f.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {f.field_label || FACT_FIELDS[f.field_key] || f.field_key}
                  </span>
                  {isConflict(f) ? (
                    <Chip className="text-warning">Changes the captured value</Chip>
                  ) : (
                    <Chip>New value</Chip>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">
                  Value when proposed: {f.current_value ?? "Not recorded"}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  Proposed value: {f.proposed_value}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  Current value: {currentValue(f.field_key) ?? "Not recorded"}
                </p>
                {f.source_detail ? (
                  <p className="whitespace-pre-wrap break-words">Observation: {f.source_detail}</p>
                ) : null}
                {isStaleFact(f, currentValue(f.field_key)) ? (
                  <p role="status" className="text-warning">
                    The current value changed after this proposal. Keep the current value, then
                    submit a fresh proposal if needed.
                  </p>
                ) : null}
                {canEdit ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Label htmlFor={`fact-review-${f.id}`}>Review note</Label>
                    <Textarea
                      id={`fact-review-${f.id}`}
                      maxLength={1000}
                      value={reviewNotes[f.id] ?? ""}
                      onChange={(event) =>
                        setReviewNotes({ ...reviewNotes, [f.id]: event.target.value })
                      }
                    />
                    <Button
                      size="sm"
                      disabled={decideFact.isPending || isStaleFact(f, currentValue(f.field_key))}
                      onClick={() =>
                        decideFact.mutate({
                          data: { proposalId: f.id, accept: true, note: reviewNotes[f.id] ?? "" },
                        })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decideFact.isPending}
                      onClick={() =>
                        decideFact.mutate({
                          data: { proposalId: f.id, accept: false, note: reviewNotes[f.id] ?? "" },
                        })
                      }
                    >
                      Keep current
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
          {facts.some((fact) => fact.status !== "pending") ? (
            <details className="border-t pt-3">
              <summary className="cursor-pointer text-sm font-medium">Review history</summary>
              {facts
                .filter((fact) => fact.status !== "pending")
                .map((fact) => (
                  <div key={fact.id} className="mt-3 space-y-1 rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {fact.field_label}: {fact.status}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      Prior value: {fact.current_value ?? "Not recorded"}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      Proposed value: {fact.proposed_value}
                    </p>
                    <p>
                      Reviewed by{" "}
                      {data.reviewers.find((reviewer) => reviewer.id === fact.reviewed_by)
                        ?.full_name || "Recorded reviewer"}
                      {fact.reviewed_at ? ` · ${new Date(fact.reviewed_at).toLocaleString()}` : ""}
                    </p>
                    {fact.decision_note ? (
                      <p className="whitespace-pre-wrap break-words">{fact.decision_note}</p>
                    ) : null}
                  </div>
                ))}
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {utilities.length === 0
              ? "No utility accounts recorded yet."
              : notReady.length === 0
                ? `All utilities are active. Recorded spend ${money(utilitySpend(costs))}.`
                : `${notReady.length} utility account${notReady.length === 1 ? "" : "s"} still need work. Recorded spend ${money(utilitySpend(costs))}.`}
          </p>

          {utilities.length === 0 ? (
            <EmptyState title="No utilities yet" hint="Add each account this home needs." />
          ) : (
            <div className="space-y-2">
              {utilities.map((u) => (
                <div key={u.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{utilityLabel(u.utility_type)}</span>
                    <Chip>{utilityStatusLabel(u.status)}</Chip>
                    {u.provider ? (
                      <span className="text-muted-foreground">{u.provider}</span>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select
                        value={u.status}
                        onValueChange={(v) =>
                          saveUtility.mutate({
                            data: {
                              id: u.id,
                              propertyId,
                              utilityType: u.utility_type,
                              provider: u.provider ?? "",
                              accountLabel: u.account_label ?? "",
                              status: v,
                              responsible: u.responsible ?? "arha",
                            },
                          } as never)
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(UTILITY_STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="max-w-[8rem]"
                        inputMode="decimal"
                        placeholder="Cost $"
                        value={costDraft[u.id] ?? ""}
                        onChange={(e) => setCostDraft({ ...costDraft, [u.id]: e.target.value })}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!costDraft[u.id]}
                        onClick={() =>
                          addCost.mutate(
                            {
                              data: {
                                accountId: u.id,
                                propertyId,
                                amount: Number(costDraft[u.id]),
                              },
                            } as never,
                            { onSuccess: () => setCostDraft({ ...costDraft, [u.id]: "" }) },
                          )
                        }
                      >
                        Record cost
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {canEdit ? (
            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
              <div className="space-y-1.5">
                <Label>Add utility</Label>
                <Select
                  value={newUtility.utilityType}
                  onValueChange={(v) => setNewUtility({ ...newUtility, utilityType: v })}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UTILITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="max-w-[12rem]"
                placeholder="Provider"
                value={newUtility.provider}
                onChange={(e) => setNewUtility({ ...newUtility, provider: e.target.value })}
              />
              <Button
                variant="outline"
                onClick={() =>
                  saveUtility.mutate(
                    {
                      data: {
                        propertyId,
                        utilityType: newUtility.utilityType,
                        provider: newUtility.provider,
                        accountLabel: "",
                        status: newUtility.status,
                        responsible: "arha",
                      },
                    } as never,
                    { onSuccess: () => setNewUtility({ ...newUtility, provider: "" }) },
                  )
                }
              >
                Add
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
