/**
 * View as (Emily, Nov 7, 2026; register M5). An Admin sees the app as a chosen role for
 * testing. It never changes the signed-in account or any data: the screens follow the chosen
 * role and are read only. It does not depend on demo mode and turns demo mode off.
 */
import type { AccessSeats, AppRole } from "@/lib/permissions";
import type { PreviewSeat } from "@/lib/demo-mode";

export type ViewAsOption = { key: string; label: string; role: AppRole; seat: PreviewSeat | null };

/** Staff roles only: homeowner and vendor screens need a chosen home or company, so they keep
 *  their own Preview as homeowner path on Active Owner. Each role keeps its role on top of the
 *  account type (Build 5, register M5), so the preview matches a real account. */
export const VIEW_AS_OPTIONS: ViewAsOption[] = [
  { key: "tech", label: "Property Coordinator", role: "tech", seat: null },
  { key: "ops_supervisor", label: "Operations Supervisor", role: "manager", seat: "ops_supervisor" },
  { key: "director_ops", label: "Director of Operations", role: "manager", seat: "director_ops" },
  { key: "director_onboarding", label: "Director of Onboarding", role: "onboarding", seat: "director_onboarding" },
  { key: "project_manager", label: "Project Manager", role: "onboarding", seat: "project_manager" },
  { key: "utilities", label: "Utilities", role: "onboarding", seat: "utilities" },
  { key: "design", label: "Design", role: "onboarding", seat: "design" },
  { key: "finance_lead", label: "Finance lead", role: "manager", seat: "finance_lead" },
];

/** The roles on top that a previewed role carries, exactly as a real account holds them. */
export function seatsForPreview(seat: PreviewSeat | null): AccessSeats {
  switch (seat) {
    case "ops_supervisor":
      return { opsSupervisor: true };
    case "director_ops":
      return { opsDirector: true };
    case "director_onboarding":
      return { onboardingDirector: true };
    case "project_manager":
      return { projectManager: true };
    case "utilities":
      return { utilities: true };
    case "finance_lead":
      return { finance: true };
    default:
      return {};
  }
}

/** Who sees the View as switcher: Admins only, by their real roles, never a preview. */
export function canUseViewAs(actualRoles: readonly string[]): boolean {
  return actualRoles.includes("admin");
}

export const VIEW_AS_COPY = {
  menu: "View as",
  banner: (label: string) => `Viewing as ${label}. You can look around, but nothing can be changed.`,
  stop: "Stop viewing as",
};
