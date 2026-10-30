import { mock } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { can } from "../src/lib/permissions";

mock.module("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
mock.module("@tanstack/react-router", () => ({ Link: ({ children }: { children: unknown }) => children }));
mock.module("../src/lib/owner-program.functions", () => ({ ownerPrograms: () => {}, ownerProgramDetail: () => {}, setOwnerProgramStatus: () => {} }));
mock.module("../src/lib/onboarding.functions", () => ({ startOnboardingProjectFn: () => {} }));
mock.module("../src/lib/co-owners.functions", () => ({ listProgramHomeowners: () => {}, addProgramCoOwner: () => {}, removeProgramCoOwner: () => {} }));
mock.module("../src/components/property/ActiveOwnerEnrollForm", () => ({ ActiveOwnerEnrollForm: () => null }));
mock.module("../src/components/property/ActualClosingCorrection", () => ({ ActualClosingCorrection: () => null }));

const { ActiveOwnerPanel } = await import("../src/components/property/ActiveOwnerPanel");
for (const scenario of [
  { name: "Admin", allowed: can(["admin"], "active_owner_enroll"), demo: false },
  { name: "Onboarding Director", allowed: can(["onboarding"], "active_owner_enroll", { onboardingDirector: true }), demo: false },
  { name: "Practice Admin", allowed: true, demo: true },
  { name: "Coordinator", allowed: can(["tech"], "active_owner_enroll"), demo: false },
]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  // A stale optional ownerLinked flag must not hide a roster the guarded RPC can read.
  qc.setQueryData(["owner-programs", "property", "home", scenario.demo], { rows: [{ id: "program", ownerLinked: false, ownerUserId: "primary", status: "active", ownerName: "Main", reportedHours: 2, openTasks: 0, properties: [{ id: "home" }] }] });
  qc.setQueryData(["program-homeowners", "program"], { ready: true, homeowners: [
    { userId: "primary", role: "primary", name: "Main homeowner", email: "main@example.org" },
    { userId: "co", role: "co_owner", name: "Co-owner", email: "co@example.org" },
  ] });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(ActiveOwnerPanel, { propertyId: "home", propertyName: "8602 E. Galveston St.", canManage: false, canEnroll: scenario.allowed, isDemo: scenario.demo })));
  const visible = html.includes('aria-label="Homeowners"') && html.includes("Add co-owner") && html.includes("Remove") && html.includes("Main homeowner, receives emails");
  if (visible !== scenario.allowed) throw new Error(`${scenario.name}: homeowner management visibility mismatch`);
  console.log(`${scenario.name}: pass`);
  qc.clear();
}