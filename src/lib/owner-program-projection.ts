import type { ProgramAggregate } from "./owner-participation.server";

/** Explicit transport boundary: staff program fields must not reach owner clients. */
export function ownerProgramProjection(program: ProgramAggregate["program"]) {
  return {
    id: program.id,
    status: program.status,
    ownerUserId: program.ownerUserId,
    ownerName: program.ownerName,
    ownerEmail: program.ownerEmail,
    ownerPhone: program.ownerPhone,
    startedOn: program.startedOn,
    endsOn: program.endsOn,
    activatedAt: program.activatedAt,
    operatingTargetHours: program.operatingTargetHours,
    onboardingMilestoneHours: program.onboardingMilestoneHours,
    onboardingMilestoneDay: program.onboardingMilestoneDay,
    onboardingLead: program.onboardingLead,
    operationsLead: program.operationsLead,
    dfyConfirmed: program.dfyConfirmed,
    completedAt: program.completedAt,
    notifyEmail: program.notifyEmail,
    notifySmsP1: program.notifySmsP1,
    notifyPush: program.notifyPush,
  };
}
