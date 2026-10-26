import { z } from "zod";

export const enrollmentInput = z.object({
  requestId: z.string().uuid(), propertyId: z.string().uuid(), ownerRecordId: z.string().uuid(),
  name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(255),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
    const date = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
  }, "Enter a valid closing date."),
  reason: z.string().trim().max(1000).default(""),
  onboardingLead: z.string().uuid().nullable().default(null),
  operationsLead: z.string().uuid().nullable().default(null), notes: z.string().trim().max(4000).default(""),
});
export type EnrollmentInput = z.infer<typeof enrollmentInput>;
export const ENROLLMENT_STEPS = ["account", "enrollment", "closing", "activation", "onboarding", "operating", "welcome"] as const;
export type EnrollmentStep = typeof ENROLLMENT_STEPS[number];
export type EnrollmentReceipt = {
  complete: boolean; programId: string | null; accountId: string | null; accountCreated: boolean;
  steps: { key: EnrollmentStep; status: "done" | "failed" | "not_reached"; detail?: string }[];
  welcomeHeld: boolean; onboardingAdded: number; operatingAdded: number;
};

/** Checkpoint implementations re-read durable state; a Retry never trusts browser progress. */
export async function runEnrollment(ops: {
  prepare: () => Promise<void>;
  account: () => Promise<{ id: string; created: boolean }>;
  step: (step: Exclude<EnrollmentStep, "account">, accountId: string) => Promise<{
    programId: string; added?: number; held?: boolean;
  }>;
}): Promise<EnrollmentReceipt> {
  await ops.prepare(); // Migration availability/authority/identity checked BEFORE creating any account.
  const receipt: EnrollmentReceipt = {
    complete: false, programId: null, accountId: null, accountCreated: false,
    steps: ENROLLMENT_STEPS.map((key) => ({ key, status: "not_reached" })),
    welcomeHeld: true, onboardingAdded: 0, operatingAdded: 0,
  };
  for (const step of receipt.steps) {
    try {
      if (step.key === "account") {
        const account = await ops.account();
        receipt.accountId = account.id; receipt.accountCreated = account.created;
      } else {
        if (!receipt.accountId) throw new Error("The homeowner login needs to be checked before continuing.");
        const saved = await ops.step(step.key, receipt.accountId);
        receipt.programId = saved.programId;
        if (step.key === "onboarding") receipt.onboardingAdded = saved.added ?? 0;
        if (step.key === "operating") receipt.operatingAdded = saved.added ?? 0;
        if (step.key === "welcome") receipt.welcomeHeld = saved.held === true;
      }
      step.status = "done";
    } catch (error) {
      step.status = "failed";
      step.detail = error instanceof Error ? error.message : "Could not finish this step. Please retry.";
      return receipt;
    }
  }
  receipt.complete = true;
  return receipt;
}

export function assertOwnerAccountRoles(roles: string[]) {
  if (roles.some((role) => role !== "owner"))
    throw new Error("That email belongs to a staff account. Use the homeowner's own email.");
}