import { ActiveOwnerEnrollForm } from "./ActiveOwnerEnrollForm";
/**
 * Active Owner participation, on the home's own page.
 *
 * A supervisor can enrol a home, see where its programme stands, and pause or
 * resume it without going looking for the programme admin screen. Enrolment
 * creates a draft: activation stays a deliberate step
 * on the programme record itself.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import {
  ownerProgramDetail,
  ownerPrograms,
  setOwnerProgramStatus,
} from "@/lib/owner-program.functions";
import { startOnboardingProjectFn } from "@/lib/onboarding.functions";
import { defaultModules } from "@/lib/onboarding-scope";
import { ActualClosingCorrection } from "./ActualClosingCorrection";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — not started",
  waiting_for_closing: "Waiting for closing",
  ready_for_onboarding: "Ready for onboarding",
  active: "Active",
  paused: "Paused",
  complete: "Complete",
};

const CHANGEABLE = ["draft", "waiting_for_closing", "ready_for_onboarding", "paused", "active"];

export function ActiveOwnerPanel({
  propertyId,
  propertyName,
  canManage,
  canEnroll = false,
  lifecycleStatus = null,
}: {
  propertyId: string;
  propertyName: string;
  canManage: boolean;
  /** Onboarding Director seat or Platform Owner: enroll / finish Active Owner setup. */
  canEnroll?: boolean;
  /** The home's lifecycle, so enrolment can offer to start onboarding too. */
  lifecycleStatus?: string | null;
}) {
  const qc = useQueryClient();
  const loadPrograms = useServerFn(ownerPrograms);
  const loadDetail = useServerFn(ownerProgramDetail);
  const statusFn = useServerFn(setOwnerProgramStatus);
  const startProjectFn = useServerFn(startOnboardingProjectFn);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Enrolment alone never moves a home; onboarding is a deliberate second step.
  const inOnboarding = lifecycleStatus === "onboarding";

  const programs = useQuery({
    queryKey: ["owner-programs", "property", propertyId],
    queryFn: () => loadPrograms({ data: {} }),
  });

  const row = (programs.data?.rows ?? []).find((p) =>
    p.properties.some((home) => home.id === propertyId),
  );

  const detail = useQuery({
    queryKey: ["owner-program-detail", row?.id],
    enabled: Boolean(row?.id),
    queryFn: () => loadDetail({ data: { programId: row!.id } }),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["owner-programs"] });
    void qc.invalidateQueries({ queryKey: ["owner-program-detail"] });
  };


  // Enrolment records participation; this is what actually gives the team work
  // to do — it moves the home into the onboarding pipeline with its task plan.
  const startOnboarding = useMutation({
    mutationFn: () =>
      startProjectFn({
        data: {
          propertyId,
          branch: null,
          projectManager: null,
          director: null,
          plannedClosingOn: null,
          possessionOn: null,
          targetHandoffOn: null,
          furnishingScope: "full_furnishing" as const,
          modules: row ? [...defaultModules(), "active_owner" as const] : defaultModules(),
          poolLocation: "none" as const,
          notes: null,
          externalRefs: {},
        },
      }),
    onSuccess: () => {
      toast.success(`${propertyName} is now in onboarding with its task plan.`);
      refresh();
      void qc.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });



  const changeStatus = useMutation({
    mutationFn: (status: string) =>
      statusFn({
        data: {
          programId: row!.id,
          expectedVersion: detail.data!.activationVersion as string,
          status: status as "draft",
        },
      }),
    onSuccess: () => {
      toast.success("Program status updated.");
      setPendingStatus(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="size-4" aria-hidden="true" /> Active Owner program
        </span>
      }
      description="Whether this home takes part in owner participation."
      actions={
        row ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/owner-programs">Open program record</Link>
          </Button>
        ) : null
      }
    >
      {programs.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking enrollment…</p>
      ) : row ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={row.status === "active" ? "resolved" : "waiting"}>
              {STATUS_LABEL[row.status] ?? row.status}
            </StatusBadge>
            {row.ownerName ? (
              <span className="text-sm text-muted-foreground">{row.ownerName}</span>
            ) : (
              <span className="text-sm text-muted-foreground">No homeowner linked yet</span>
            )}
          </div>
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Day in program</dt>
              <dd className="numeric font-medium">{row.startedOn ? row.day : "Not started"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Hours logged</dt>
              <dd className="numeric font-medium">{row.reportedHours.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Waiting on the homeowner</dt>
              <dd className="numeric font-medium">{row.openTasks}</dd>
            </div>
          </dl>
          {canEnroll && !row.ownerLinked ? (
            <ActiveOwnerEnrollForm
              finishing
              propertyId={propertyId}
              propertyName={propertyName}
              initialName={row.ownerName && row.ownerName !== "Owner link unresolved" ? row.ownerName : ""}
              initialEmail={row.ownerEmail ?? ""}
              onDone={refresh}
            />
          ) : null}
          {canManage && CHANGEABLE.includes(row.status) ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={pendingStatus ?? row.status}
                onValueChange={setPendingStatus}
                disabled={!detail.data}
              >
                <SelectTrigger className="w-[15rem]">
                  <SelectValue placeholder="Program status" />
                </SelectTrigger>
                <SelectContent>
                  {CHANGEABLE.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={
                  !pendingStatus ||
                  pendingStatus === row.status ||
                  !detail.data ||
                  changeStatus.isPending
                }
                onClick={() => pendingStatus && changeStatus.mutate(pendingStatus)}
              >
                {changeStatus.isPending ? "Saving…" : "Update status"}
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Activating the program and adding the homeowner&apos;s details happen on the
                program record.
              </p>
            </div>
          ) : null}
          {canManage ? (
            <div className="space-y-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => startOnboarding.mutate()}
                disabled={startOnboarding.isPending}
              >
                {startOnboarding.isPending
                  ? "Starting…"
                  : inOnboarding
                    ? "Check the onboarding plan"
                    : "Start onboarding"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Enrolling records participation. This puts the home in the Onboarding hub with its
                task plan, and fills the plan in if it is missing.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {propertyName} is a standard home. Enrolling links the homeowner and queues their welcome. Hour logging
            opens automatically once an actual closing is confirmed and has arrived.
          </p>
          {canManage || canEnroll ? (
            <div className="space-y-3">
              {canEnroll ? (
                <ActiveOwnerEnrollForm propertyId={propertyId} propertyName={propertyName} onDone={refresh} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  The Onboarding Director or a Platform Owner enrolls homes in Active Owner.
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => startOnboarding.mutate()}
                disabled={startOnboarding.isPending}
              >
                {startOnboarding.isPending ? "Starting…" : "Start onboarding"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              The Onboarding Director or a Platform Owner can enroll this home in the program.
            </p>
          )}
        </div>
      )}
      <ActualClosingCorrection propertyId={propertyId} />
    </SectionCard>
  );
}
