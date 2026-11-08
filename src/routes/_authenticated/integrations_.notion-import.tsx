import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useRole";
import {
  notionImportBatch,
  notionImportCheck,
  notionImportResume,
  notionImportRetryFiles,
  notionImportSample,
  notionImportStart,
  notionImportStatus,
  notionImportStop,
  type NotionImportView,
  type SampleRow,
} from "@/lib/notion-import.functions";
import { IMPORT_GROUPS, IMPORT_GROUP_LABELS, type ImportGroup } from "@/lib/notion-import/mapping";
import { NOTION_IMPORT_COPY, RUN_BUTTONS, assigneeRows } from "@/lib/notion-import/runner";
import { usDate } from "@/lib/dates";


export const Route = createFileRoute("/_authenticated/integrations_/notion-import")({
  component: NotionImportPage,
  head: () => ({
    meta: [
      { title: "Notion import | Resolve" },
      { name: "description", content: "Admin tool to bring every Notion maintenance ticket, with comments and files, into Resolve in safe stages." },
      { property: "og:title", content: "Notion import | Resolve" },
      { property: "og:description", content: "Check the connection, dry run, preview and staged runs for the Notion ticket import." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Check = { ok: boolean; reason: string; fix: string | null; ticket?: string };

const STATUS_TEXT: Record<string, { label: string; tone: StatusTone }> = {
  idle: { label: "Nothing has run yet", tone: "closed" },
  running: { label: "Running", tone: "progress" },
  stopping: { label: "Stopping after this batch", tone: "waiting" },
  stopped: { label: "Stopped", tone: "review" },
  done: { label: "Finished", tone: "resolved" },
  failed: { label: "Stopped on an error", tone: "escalated" },
  crashed: { label: "Stopped unexpectedly", tone: "escalated" },
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function NotionImportPage() {
  const { isAdmin, readOnly, isLoading } = useRole();
  const canRun = isAdmin && !readOnly;
  const qc = useQueryClient();
  const statusFn = useServerFn(notionImportStatus);
  const checkFn = useServerFn(notionImportCheck);
  const startFn = useServerFn(notionImportStart);
  const batchFn = useServerFn(notionImportBatch);
  const stopFn = useServerFn(notionImportStop);
  const resumeFn = useServerFn(notionImportResume);
  const sampleFn = useServerFn(notionImportSample);
  const retryFn = useServerFn(notionImportRetryFiles);

  const [driving, setDriving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [sample, setSample] = useState<SampleRow[] | null>(null);
  const [live, setLive] = useState<NotionImportView | null>(null);
  const loop = useRef(false);

  const status = useQuery({
    queryKey: ["notion-import-status"],
    queryFn: () => statusFn(),
    enabled: canRun,
    refetchInterval: driving ? false : 15_000,
  });
  const view = live && driving ? { ...live, storageBytes: status.data?.storageBytes ?? 0 } : (status.data ?? null);
  const state = view?.status ?? "idle";
  const going = state === "running" || state === "stopping";

  async function drive(first: NotionImportView) {
    setLive(first);
    setDriving(true);
    loop.current = true;
    let cur = first;
    try {
      while (loop.current && cur.job && cur.job.status === "running") {
        cur = await batchFn({ data: { runId: cur.job.runId } });
        setLive(cur);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      loop.current = false;
      setDriving(false);
      setLive(null);
      await qc.invalidateQueries({ queryKey: ["notion-import-status"] });
    }
  }

  async function act(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const start = (kind: "dry_run" | "run", group?: ImportGroup) =>
    act(kind === "dry_run" ? "dry" : `run_${group}`, async () => {
      const v = await startFn({ data: group ? { kind, group } : { kind } });
      void drive(v);
    });
  const stop = () =>
    act("stop", async () => {
      const v = await stopFn();
      if (!driving) await qc.invalidateQueries({ queryKey: ["notion-import-status"] });
      else setLive(v);
    });
  const resume = () =>
    act("resume", async () => {
      const v = await resumeFn();
      void drive(v);
    });

  if (isLoading) return null;
  if (!canRun) return <EmptyState title="Admin only" hint="Only an Admin can run the Notion import." />;

  const job = view?.job ?? null;
  const st = STATUS_TEXT[state] ?? STATUS_TEXT["idle"]!;
  const disabled = !!busy || driving || going;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow="Admin" title={NOTION_IMPORT_COPY.title} description={NOTION_IMPORT_COPY.intro} />

      <SectionCard title="Before you run" description={NOTION_IMPORT_COPY.quiet}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => act("check", async () => setCheck((await checkFn()) as Check))}
          >
            {busy === "check" ? "Checking..." : NOTION_IMPORT_COPY.check}
          </Button>
          <Button variant="outline" disabled={disabled} onClick={() => start("dry_run")}>
            {NOTION_IMPORT_COPY.dry}
          </Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => act("sample", async () => setSample(await sampleFn()))}
          >
            {busy === "sample" ? "Reading 20 tickets..." : NOTION_IMPORT_COPY.sample}
          </Button>
        </div>
        {check && (
          <div className="mt-3 rounded-md border border-border p-3 text-sm" data-testid="notion-check">
            <p className="font-medium">{check.ok ? "Yes, Resolve can read the ticket database." : "No, Resolve cannot read the ticket database."}</p>
            <p className="text-muted-foreground">{check.reason}{check.ticket ? ` First ticket: ${check.ticket}` : ""}</p>
            {check.fix && <p className="mt-1">{check.fix}</p>}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Run" description="Run the groups in any order. Each one brings tickets, then their comments and files.">
        <div className="flex flex-wrap gap-2">
          {RUN_BUTTONS.map((b) => (
            <Button key={b.group} disabled={disabled} onClick={() => start("run", b.group)}>
              {b.label}
            </Button>
          ))}
          <Button variant="outline" disabled={!going || busy === "stop"} onClick={stop}>
            {NOTION_IMPORT_COPY.stop}
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !(state === "stopped" || state === "failed" || state === "crashed")}
            onClick={resume}
          >
            {NOTION_IMPORT_COPY.resume}
          </Button>
        </div>
        {driving && <p className="mt-3 text-sm text-muted-foreground">{NOTION_IMPORT_COPY.keepOpen}</p>}
        {!driving && going && <p className="mt-3 text-sm text-muted-foreground">{NOTION_IMPORT_COPY.elsewhere}</p>}
        {state === "crashed" && <p className="mt-3 text-sm text-destructive">{NOTION_IMPORT_COPY.crashed}</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </SectionCard>

      <SectionCard title="Status">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          {job && (
            <span className="text-muted-foreground">
              {job.kind === "dry_run" ? "Dry run" : IMPORT_GROUP_LABELS[job.group!]}, started {new Date(job.startedAt).toLocaleString()}, {job.batches} batches
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Group</th>
                <th className="py-1 pr-3 font-medium">Done</th>
                <th className="py-1 pr-3 font-medium">Left</th>
                <th className="py-1 pr-3 font-medium">Failed</th>
                <th className="py-1 pr-3 font-medium">Skipped</th>
                <th className="py-1 pr-3 font-medium">Comments</th>
                <th className="py-1 pr-3 font-medium">Files</th>
              </tr>
            </thead>
            <tbody>
              {IMPORT_GROUPS.map((g) => {
                const p = view?.progress[g];
                const left = view?.left[g];
                return (
                  <tr key={g} className="border-t border-border">
                    <td className="py-1.5 pr-3">{IMPORT_GROUP_LABELS[g]}</td>
                    <td className="numeric py-1.5 pr-3">{p?.done ?? 0}</td>
                    <td className="numeric py-1.5 pr-3">{left == null ? "Not known yet" : left}</td>
                    <td className="numeric py-1.5 pr-3">{p?.failed ?? 0}</td>
                    <td className="numeric py-1.5 pr-3">{p?.skipped ?? 0}</td>
                    <td className="numeric py-1.5 pr-3">{p?.comments ?? 0}</td>
                    <td className="numeric py-1.5 pr-3">{p?.files ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!view?.dryRun?.finishedAt && <p className="mt-2 text-xs text-muted-foreground">{NOTION_IMPORT_COPY.noDry}</p>}
        <p className="mt-3 text-sm">
          Storage used by imported files: <span className="numeric font-medium">{formatBytes(view?.storageBytes ?? 0)}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Skipped means already up to date, or already taken or reopened in Resolve and left as it is.</p>
        <p className="mt-3 text-sm">
          Last error: <span className={view?.lastError ? "text-destructive" : "text-muted-foreground"}>{view?.lastError ?? "None"}</span>
        </p>
        <Rows title="Tickets that failed" rows={(view?.failures ?? []).map((f) => `${f.title}: ${f.error}`)} />
        {(view?.failedFileCount ?? 0) > 0 && (
          <div className="mt-4 space-y-2">
            <Rows title={`Files that failed (${view?.failedFileCount})`} rows={(view?.failedFiles ?? []).map((f) => `${f.name}: ${f.error}`)} open />
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                act("retry", async () => {
                  await retryFn();
                  await qc.invalidateQueries({ queryKey: ["notion-import-status"] });
                })
              }
            >
              {busy === "retry" ? "Trying again..." : NOTION_IMPORT_COPY.retryFiles}
            </Button>
          </div>
        )}
      </SectionCard>

      {view?.dryRun && view.dryRun.total > 0 && <DryRunCard d={view.dryRun} />}
      {sample && <SampleCard rows={sample} />}
    </div>
  );
}

function DryRunCard({ d }: { d: NonNullable<NotionImportView["dryRun"]> }) {
  const tile = (label: string, n: number) => (
    <div key={label} className="rounded-md border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="numeric text-lg font-semibold">{n}</dd>
    </div>
  );
  return (
    <SectionCard
      title={d.finishedAt ? `Dry run, finished ${usDate(d.finishedAt)}` : "Dry run, still reading"}
      description="Read from Notion and sorted by the import rules. Nothing was written."
    >
      <h3 className="mb-2 text-sm font-semibold">Groups</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tile("All tickets read", d.total)}
        {IMPORT_GROUPS.map((g) => tile(IMPORT_GROUP_LABELS[g], d.groups[g]))}
      </dl>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Priority</h3>
      <dl className="grid grid-cols-3 gap-3">
        {tile("P1 (Urgent)", d.priority.p1)}
        {tile("P2 (High)", d.priority.p2)}
        {tile("P3 (Medium, Low or blank)", d.priority.p3)}
      </dl>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Open, past 30 days: Team Queue groups</h3>
      <dl className="grid grid-cols-3 gap-3">
        {tile("Team A", d.teams.team_a)}
        {tile("Team B", d.teams.team_b)}
        {tile("Unassigned", d.teams.unassigned)}
      </dl>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Other rules</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tile("Linked claims", d.claims)}
        {tile("Claim review", d.claimReview)}
        {tile("Needs a home", d.needsHome)}
        {tile("Former home, left unlinked", d.formerHome)}
        {tile("More than one home in Notion", d.multipleHomes)}
        {tile("Blank created date (treated as older)", d.blankCreatedDate)}
      </dl>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Assignee</h3>
      <ul className="space-y-1 text-sm">
        {assigneeRows(d).map((r) => (
          <li key={r.label} className="flex justify-between gap-2 border-b border-border py-1">
            <span>{r.label}</span>
            <span className="numeric">{r.n}</span>
          </li>
        ))}
      </ul>
      <Rows
        title="Notion assignees with no matching Resolve login"
        rows={Object.entries(d.missingLogins).map(([name, n]) => `${name}: ${n}`)}
      />
    </SectionCard>
  );
}

function SampleCard({ rows }: { rows: SampleRow[] }) {
  return (
    <SectionCard title={`Preview of ${rows.length}`} description="Read only. This is how each ticket would be imported. Nothing was written.">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.pageId} className="space-y-1 py-3 text-sm">
            <p className="font-medium">{r.title}</p>
            <p className="text-muted-foreground">
              {r.group} · {r.priority} · Home: {r.home} · Claim: {r.claim}
            </p>
            <p className="text-muted-foreground">
              In Notion: {r.notionAssignee} · In Resolve: {r.assignee} · Team Queue: {r.team}
            </p>
            {r.comments.length > 0 ? (
              <ul className="ml-3 list-disc space-y-0.5 text-xs text-muted-foreground">
                {r.comments.map((c, i) => (
                  <li key={i}>
                    {c.author}, {usDate(c.date)}: {c.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No comments.</p>
            )}
            {r.url && (
              <a className="text-xs underline" href={r.url} target="_blank" rel="noreferrer">
                Open in Notion
              </a>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Rows({ title, rows, open }: { title: string; rows: string[]; open?: boolean }) {
  if (!rows.length) return null;
  return (
    <details className="mt-4" open={open}>
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm text-muted-foreground">
        {rows.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </details>
  );
}
