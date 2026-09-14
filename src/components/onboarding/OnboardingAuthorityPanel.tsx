import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AuthorityPolicy } from "@/lib/maintenance-policy";
import { setOnboardingPolicyFn } from "@/lib/onboarding-policy.functions";

export function OnboardingAuthorityPanel({
  policy,
  onSaved,
}: {
  policy: AuthorityPolicy;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    version: policy.version,
    supervisor: String(policy.supervisorApprovalThreshold),
    owner: String(policy.ownerApprovalThreshold),
    reason: "",
  });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: useServerFn(setOnboardingPolicyFn),
    onSuccess: () => {
      toast.success("Approved policy recorded for new onboarding requests.");
      void qc.invalidateQueries({ queryKey: ["onboarding-finance"] });
      setDraft((current) => ({ ...current, reason: "" }));
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Record an approved policy change
      </summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({
            data: {
              version: draft.version,
              supervisorApprovalThreshold: Number(draft.supervisor),
              ownerApprovalThreshold: Number(draft.owner),
              reason: draft.reason,
            },
          });
        }}
      >
        <p className="text-sm text-muted-foreground">
          Administrator setting for future onboarding requests. Enter leadership's approved
          thresholds and reference. Existing requests retain their recorded authority.
        </p>
        <Label htmlFor="authority-version">Policy version</Label>
        <Input
          id="authority-version"
          required
          maxLength={120}
          value={draft.version}
          onChange={(event) => setDraft({ ...draft, version: event.target.value })}
        />
        <Label htmlFor="authority-supervisor">Supervisor approval starts at ($)</Label>
        <Input
          id="authority-supervisor"
          type="number"
          required
          min={0}
          max={1000000}
          step="0.01"
          value={draft.supervisor}
          onChange={(event) => setDraft({ ...draft, supervisor: event.target.value })}
        />
        <Label htmlFor="authority-owner">Owner approval required above ($)</Label>
        <Input
          id="authority-owner"
          type="number"
          required
          min={Number(draft.supervisor)}
          max={1000000}
          step="0.01"
          value={draft.owner}
          onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
        />
        <Label htmlFor="authority-reason">Approval reference and reason</Label>
        <Textarea
          id="authority-reason"
          required
          minLength={5}
          maxLength={1000}
          value={draft.reason}
          onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
        />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save for future requests"}
        </Button>
      </form>
    </details>
  );
}
