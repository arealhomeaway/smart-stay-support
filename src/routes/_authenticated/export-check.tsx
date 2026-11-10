import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RequireCapability } from "@/components/RequireCapability";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { readExportCheck } from "@/lib/nightly-export.functions";
import { keptRange, plainSize, runResult, type ExportRunRow } from "@/lib/nightly-export";
import { usDateTime } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/export-check")({
  head: () => ({
    meta: [
      { title: "Export check | Resolve" },
      { name: "description", content: "Whether last night's SharePoint export of every table and stored file passed its check." },
      { property: "og:title", content: "Export check | Resolve" },
      { property: "og:description", content: "Last night's SharePoint export and its check, read only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="export_check" title="Export check">
      <ExportCheckPage />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">The export check could not be loaded. Try again in a minute.</p>,
});

const TONE: Record<ReturnType<typeof runResult>, StatusTone> = {
  Passed: "resolved",
  Failed: "escalated",
  Running: "progress",
  "Not checked": "closed",
};

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-US");

function contents(r: ExportRunRow): string {
  if (r.phase === null) return "Earlier nightly backup: 8 lists only";
  const parts = [`${n(r.table_count)} tables`, `${n(r.total_rows)} rows`];
  if (r.files_inventoried !== null) parts.push(`${n(r.files_inventoried)} stored files listed`);
  if (r.files_copied !== null) parts.push(`${n(r.files_copied)} copied (${plainSize(Number(r.bytes_copied ?? 0))})`);
  return parts.join(", ");
}

function ExportCheckPage() {
  const read = useServerFn(readExportCheck);
  const q = useQuery({ queryKey: ["export-check"], queryFn: () => read() });
  const data = q.data;
  const runs = data?.runs ?? [];
  const last = runs[0];
  const kept = keptRange(runs);
  const failures = runs.filter((r) => runResult(r) === "Failed").slice(0, 14);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Nightly export"
        title="Export check"
        description="Every night from 2 AM Central, Resolve saves every table and every stored file to SharePoint, then reads the copy back and checks it."
      />
      {q.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          The export check could not be loaded. Try again in a minute.
        </p>
      ) : !data?.ready ? (
        <EmptyState title="The full nightly export is not turned on yet." />
      ) : !last ? (
        <EmptyState title="No nightly export has run yet." />
      ) : (
        <>
          <SectionCard
            title="Last night"
            actions={<StatusBadge tone={TONE[runResult(last)]}>{runResult(last)}</StatusBadge>}
            bodyClassName="text-sm"
          >
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="export-summary">
              <div>
                <dt className="text-xs text-muted-foreground">Last run</dt>
                <dd className="font-medium">{usDateTime(last.finished_at ?? last.started_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tables and rows</dt>
                <dd className="font-medium">
                  {last.phase === null ? "8 lists only" : `${n(last.table_count)} tables, ${n(last.total_rows)} rows`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Stored files</dt>
                <dd className="font-medium">
                  {last.files_copied === null
                    ? "Not copied"
                    : `${n(last.files_copied)} copied (${plainSize(Number(last.bytes_copied ?? 0))}) of ${n(last.files_inventoried)} listed`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Oldest folder kept</dt>
                <dd className="font-medium">{kept.oldest ?? "None"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Newest folder kept</dt>
                <dd className="font-medium">{kept.newest ?? "None"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Kept</dt>
                <dd className="font-medium">
                  {data.settings.dailyKeep} nightly and {data.settings.weeklyKeep} weekly folders
                </dd>
              </div>
            </dl>
            {runResult(last) === "Failed" ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-coral" data-testid="export-last-reasons">
                {(last.verify_reasons?.length ? last.verify_reasons : [last.error ?? "The export did not finish."]).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          <SectionCard title={`Last ${Math.min(14, runs.length)} runs`} bodyClassName="text-sm">
            <ul className="divide-y divide-border" data-testid="export-runs">
              {runs.slice(0, 14).map((r) => (
                <li key={r.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                  <span className="font-medium">
                    {r.folder_name}
                    {r.weekly ? <span className="ml-2 text-xs text-muted-foreground">Weekly full copy</span> : null}
                  </span>
                  <span className="text-muted-foreground">{contents(r)}</span>
                  <StatusBadge tone={TONE[runResult(r)]}>{runResult(r)}</StatusBadge>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Failures" bodyClassName="text-sm">
            {failures.length === 0 && (data.alerts ?? []).length === 0 ? (
              <p className="text-muted-foreground">No failures.</p>
            ) : (
              <ul className="divide-y divide-border" data-testid="export-failures">
                {failures.map((r) => (
                  <li key={r.id} className="py-2">
                    <p className="font-medium">{r.folder_name}</p>
                    <p className="text-muted-foreground">
                      {(r.verify_reasons?.length ? r.verify_reasons : [r.error ?? "The export did not finish."]).join(" ")}
                    </p>
                  </li>
                ))}
                {(data.alerts ?? [])
                  .filter((a) => !failures.some((r) => r.folder_name === a.folder_name))
                  .map((a) => (
                    <li key={a.folder_name} className="py-2">
                      <p className="font-medium">{a.folder_name}</p>
                      <p className="text-muted-foreground">{a.message}</p>
                    </li>
                  ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
