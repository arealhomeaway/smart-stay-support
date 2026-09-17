import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkflowTable } from "@/components/onboarding/WorkflowTable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createOnboardingQaProject,
  QA_SCENARIOS,
  type QaScenario,
} from "@/lib/onboarding-qa-fixtures";
import { buildReleaseContext, chainProgress, deriveLifecycle } from "@/lib/onboarding-state";
import type { FurnishingScope } from "@/lib/onboarding-scope";
import { STATUS_LABEL, viewTask } from "@/lib/onboarding-workflow";
import "../styles.css";

const labels: Record<QaScenario, string> = {
  pre_close: "Before closing",
  work: "Active onboarding",
  review: "Director review",
  pending_live: "Awaiting Supervisor Live",
  live: "Live and locked",
};
function Preview() {
  const [scope, setScope] = useState<FurnishingScope>("full_furnishing");
  const [scenario, setScenario] = useState<QaScenario>("work");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fixture = useMemo(() => createOnboardingQaProject(scope, scenario), [scope, scenario]);
  const release = buildReleaseContext(fixture.state);
  const life = deriveLifecycle(fixture.state);
  const selected = fixture.inScope.find((task) => task.id === selectedId);
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-warning">Local QA · excluded from live reporting</p>
        <h1 className="text-2xl font-semibold">Onboarding acceptance preview</h1>
        <p className="text-sm text-muted-foreground">
          Synthetic projects using the current template and workflow rules. No database connection
          or message delivery. Reloading restores the fixtures.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={scope === "full_furnishing" ? "default" : "outline"}
          onClick={() => {
            setScope("full_furnishing");
            setSelectedId(null);
          }}
        >
          QA — Full Furnishing
        </Button>
        <Button
          variant={scope === "no_furnishing" ? "default" : "outline"}
          onClick={() => {
            setScope("no_furnishing");
            setSelectedId(null);
          }}
        >
          QA — No Furnishings
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="qa-scenario">Acceptance scenario</Label>
        <select
          id="qa-scenario"
          className="block w-full rounded-md border bg-background p-2 md:max-w-sm"
          value={scenario}
          onChange={(event) => setScenario(event.target.value as QaScenario)}
        >
          {QA_SCENARIOS.map((value) => (
            <option key={value} value={value}>
              {labels[value]}
            </option>
          ))}
        </select>
      </div>
      <section className="surface space-y-2 p-4" aria-label="Project overview">
        <h2 className="font-semibold">{fixture.property.name}</h2>
        <p>{life.label}</p>
        <p className="text-sm text-muted-foreground">{life.explain}</p>
        <p className="text-sm">
          {fixture.inScope.length} applicable tasks · {fixture.outOfScope.length} not applicable
        </p>
        <ol className="flex flex-wrap gap-3 text-sm">
          {chainProgress(fixture.state).map((step) => (
            <li key={step.key}>
              {step.label}: {step.state}
            </li>
          ))}
        </ol>
      </section>
      {selected ? (
        <section className="surface space-y-2 p-4" aria-label="Selected task">
          <h2 className="font-semibold">{selected.title}</h2>
          <p>{STATUS_LABEL[viewTask(selected, fixture.inScope, release).status]}</p>
          <p className="text-sm text-muted-foreground">
            {selected.requires_owner_approval
              ? "Owner approval required"
              : "No owner approval required"}{" "}
            · {selected.evidence_required ? "Evidence required" : "No required evidence"}
          </p>
          <Button variant="outline" onClick={() => setSelectedId(null)}>
            Close task details
          </Button>
        </section>
      ) : null}
      <WorkflowTable
        tasks={fixture.inScope}
        outOfScope={fixture.outOfScope}
        release={release}
        people={[{ id: "qa-project-manager", full_name: "QA Project Manager", email: null }]}
        selectedId={selectedId}
        onSelect={(task) => setSelectedId(task.id)}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
