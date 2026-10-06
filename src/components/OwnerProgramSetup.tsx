import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateOwnerProgram } from "@/lib/owner-program.functions";
import { captureProgramChangeVersion } from "@/lib/owner-lifecycle-version";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function OwnerProgramSetup({
  programId,
  version,
  program,
  staffChoices,
  onRefresh,
}: {
  programId: string;
  version: string;
  program: {
    ownerName: string | null;
    ownerEmail: string | null;
    onboardingLead: string | null;
    operationsLead: string | null;
    dfyConfirmed: boolean;
    internalNotes: string | null;
  };
  staffChoices: { id: string; label: string }[];
  onRefresh: () => void;
}) {
  const save = useServerFn(updateOwnerProgram);
  const [reviewedVersion, setReviewedVersion] = useState(() =>
    captureProgramChangeVersion(version),
  );
  const [onboardingLead, setOnboardingLead] = useState(program.onboardingLead ?? "");
  const [operationsLead, setOperationsLead] = useState(program.operationsLead ?? "");
  const [dfyConfirmed] = useState(program.dfyConfirmed);
  const [internalNotes, setInternalNotes] = useState(program.internalNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const stale = reviewedVersion !== version;
  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          programId,
          expectedVersion: reviewedVersion,
          onboardingLead: onboardingLead || null,
          operationsLead: operationsLead || null,
          dfyConfirmed,
          internalNotes,
        },
      }),
    onSuccess: (receipt) => {
      setReviewedVersion(receipt.reportVersion);
      toast.success("Program details saved.");
      setError(null);
      onRefresh();
    },
    onError: (failure: Error) => {
      setError(failure.message);
      onRefresh();
    },
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!stale) mutation.mutate();
      }}
    >
      <h3 className="text-sm font-semibold">Program setup</h3>
      <p className="text-sm">
        Canonical Owner: {program.ownerName ?? "Owner relationship needs review"}
        {program.ownerEmail ? ` · ${program.ownerEmail}` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Owner identity and contact details come from the Property’s canonical Owner record.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span>Onboarding lead</span>
          <select
            className="block w-full rounded-md border bg-background p-2"
            value={onboardingLead}
            onChange={(event) => setOnboardingLead(event.target.value)}
            disabled={mutation.isPending}
          >
            <option value="">Unassigned</option>
            {onboardingLead && !staffChoices.some((p) => p.id === onboardingLead) && (
              <option value={onboardingLead}>Current assignment needs review</option>
            )}
            {staffChoices.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span>Operations lead</span>
          <select
            className="block w-full rounded-md border bg-background p-2"
            value={operationsLead}
            onChange={(event) => setOperationsLead(event.target.value)}
            disabled={mutation.isPending}
          >
            <option value="">Unassigned</option>
            {operationsLead && !staffChoices.some((p) => p.id === operationsLead) && (
              <option value={operationsLead}>Current assignment needs review</option>
            )}
            {staffChoices.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span>Internal notes</span>
        <Textarea
          value={internalNotes}
          maxLength={4000}
          rows={2}
          onChange={(event) => setInternalNotes(event.target.value)}
          disabled={mutation.isPending}
        />
      </label>
      {stale && (
        <div className="space-y-2" role="status">
          <p>
            The program changed. Your draft is retained. Review current enrollment and leads before saving.
          </p>
          <p>
            Current onboarding lead:{" "}
            {staffChoices.find((p) => p.id === program.onboardingLead)?.label ??
              "Unassigned or no longer eligible"}
          </p>
          <p>
            Current Operations lead:{" "}
            {staffChoices.find((p) => p.id === program.operationsLead)?.label ??
              "Unassigned or no longer eligible"}
          </p>
          <p className="whitespace-pre-line">
            Current internal notes: {program.internalNotes || "None"}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => {
              setReviewedVersion(captureProgramChangeVersion(version));
              setError(null);
            }}
          >
            I have reviewed the current program
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={stale || mutation.isPending}>
        Save details
      </Button>
    </form>
  );
}
