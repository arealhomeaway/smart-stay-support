import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useRole";
import {
  notionImportDryRun,
  notionImportHistory,
  notionImportPass1,
  notionImportPass2,
} from "@/lib/notion-import.functions";
import { emptyReport, mergeReport, type RunReport } from "@/lib/notion-import/mapping";

export const Route = createFileRoute("/_authenticated/integrations_/notion-import")({
  component: NotionImportPage,
  head: () => ({
    meta: [
      { title: "Notion ticket import | Resolve" },
      { name: "description", content: "Admin tool to bring Notion maintenance tickets, comments and files into Resolve." },
      { property: "og:title", content: "Notion ticket import | Resolve" },
      { property: "og:description", content: "Dry run, ticket pass and history pass for the Notion ticket import." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Pass = RunReport["pass"];
type Step = (args: { data: { cursor: string | null; runId?: string } }) => Promise<{ runId: string; report: RunReport; nextCursor: string | null }>;
const RESUME_KEY = "notion-import-resume";
const PASS_LABEL: Record<Pass, string> = { dry_run: "Dry run", pass1: "Pass 1: tickets and claims", pass2: "Pass 2: comments and files" };

function NotionImportPage() {
  const { isAdmin, readOnly, isLoading } = useRole();
  const role = isAdmin && !readOnly ? "admin" : null;
  const qc = useQueryClient();
  const dry = useServerFn(notionImportDryRun) as unknown as Step;
  const p1 = useServerFn(notionImportPass1) as unknown as Step;
  const p2 = useServerFn(notionImportPass2) as unknown as Step;
  const historyFn = useServerFn(notionImportHistory);
  const history = useQuery({ queryKey: ["notion-import-history"], queryFn: () => historyFn(), enabled: role === "admin" });

  const [running, setRunning] = useState<Pass | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<{ pass: Pass; cursor: string; runId: string } | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RESUME_KEY);
      if (raw) setResume(JSON.parse(raw));
    } catch {
      setResume(null);
    }
  }, []);

  async function run(pass: Pass, from?: { cursor: string; runId: string }) {
    const step = pass === "dry_run" ? dry : pass === "pass1" ? p1 : p2;
    setRunning(pass);
    setError(null);
    stop.current = false;
    let total = emptyReport(pass);
    setReport(total);
    let cursor: string | null = from?.cursor ?? null;
    let runId: string | undefined = from?.runId;
    try {
      do {
        const out = await step({ data: { cursor, runId } });
        runId = out.runId;
        total = mergeReport(total, out.report);
        setReport(total);
        cursor = out.nextCursor;
        if (pass !== "dry_run") {
          if (cursor) window.localStorage.setItem(RESUME_KEY, JSON.stringify({ pass, cursor, runId }));
          else window.localStorage.removeItem(RESUME_KEY);
        }
      } while (cursor && !stop.current);
      if (stop.current && cursor && pass !== "dry_run") setResume({ pass, cursor, runId: runId! });
      else setResume(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (cursor && runId && pass !== "dry_run") setResume({ pass, cursor, runId });
    } finally {
      setRunning(null);
      qc.invalidateQueries({ queryKey: ["notion-import-history"] });
    }
  }

  if (isLoading) return null;
  if (role !== "admin") {
    return <EmptyState title="Admin only" hint="Only an Admin can run the Notion ticket import." />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Notion ticket import"
        description="Brings open Notion maintenance tickets, and any created or changed in the last 30 days, into Resolve. Reads Notion only. Runs only when you press a button. Rerunning updates tickets instead of adding copies."
      />

      <SectionCard
        title="Run"
        description="Start with a dry run. Run Pass 1 before Pass 2. Imported tickets start no response clocks, alerts or escalations."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!running} onClick={() => run("dry_run")}>Dry run (counts only)</Button>
          <Button disabled={!!running} onClick={() => run("pass1")}>Run Pass 1: tickets and claims</Button>
          <Button disabled={!!running} onClick={() => run("pass2")}>Run Pass 2: comments and files</Button>
          {resume && !running && (
            <Button variant="outline" onClick={() => run(resume.pass, resume)}>
              Resume {PASS_LABEL[resume.pass]}
            </Button>
          )}
          {running && (
            <Button variant="outline" onClick={() => { stop.current = true; }}>Stop after this batch</Button>
          )}
        </div>
        {running && <p className="mt-3 text-sm text-muted-foreground">{PASS_LABEL[running]} is running. Keep this page open.</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </SectionCard>

      {report && <ReportCard title={`${PASS_LABEL[report.pass]} report`} report={report} />}

      <SectionCard title="Earlier runs">
        {(history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(history.data ?? []).map((r) => (
              <li key={r.runId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{PASS_LABEL[r.pass as Pass] ?? r.pass}, {new Date(r.startedAt).toLocaleString()}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {r.report.created} created, {r.report.updated} updated, {r.report.comments} comments, {r.report.files} files, {r.report.failures.length} failures
                  </span>
                  <StatusBadge tone={r.status === "failed" ? "escalated" : r.status === "completed" ? "resolved" : "waiting"}>
                    {r.status === "failed" ? "Had failures" : r.status === "completed" ? "Finished" : "Stopped part way"}
                  </StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function ReportCard({ title, report }: { title: string; report: RunReport }) {
  const stats: [string, number][] = [
    ["In scope", report.inScope],
    ["Created", report.created],
    ["Updated", report.updated],
    ["Skipped (no change)", report.skipped],
    ["Unassigned, no login", report.unassignedMissingLogin.length],
    ["Needs a home", report.needsHome.length],
    ["Backlog review", report.backlog],
    ["Linked claims", report.claims],
    ["Comments", report.comments],
    ["Files", report.files],
    ["Failures", report.failures.length],
  ];
  return (
    <SectionCard title={title}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold">{n}</dd>
          </div>
        ))}
      </dl>
      <List title="Unassigned because the person has no Resolve login" rows={report.unassignedMissingLogin.map((r) => `${r.title} (${r.assignee})`)} />
      <List title="Needs a home" rows={report.needsHome.map((r) => `${r.title} (home in Notion: ${r.home})`)} />
      <List title="Failures" rows={report.failures.map((r) => `${r.title}: ${r.error}`)} />
    </SectionCard>
  );
}

function List({ title, rows }: { title: string; rows: string[] }) {
  if (!rows.length) return null;
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-medium">{title} ({rows.length})</summary>
      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm text-muted-foreground">
        {rows.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </details>
  );
}
