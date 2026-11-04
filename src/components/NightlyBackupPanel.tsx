import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DatabaseBackup } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { listBackupRuns } from "@/lib/nightly-backup.functions";

export function NightlyBackupPanel() {
  const fn = useServerFn(listBackupRuns);
  const q = useQuery({ queryKey: ["backup-runs"], queryFn: () => fn() });
  const runs = q.data?.runs ?? [];
  const last = runs[0];
  const tone = !last ? "closed" : last.status === "failed" ? "breached" : last.status === "succeeded" ? "resolved" : "waiting";

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <DatabaseBackup className="size-4" /> Nightly backup to SharePoint
        </span>
      }
      actions={
        <StatusBadge tone={tone as never}>
          {!q.data?.ready ? "Not turned on" : !last ? "No runs yet" : last.status === "failed" ? "Last run failed" : last.status === "succeeded" ? "Last run OK" : "Running"}
        </StatusBadge>
      }
      description="Every night at 2 a.m. Central, tickets, ticket activity, work orders, claims, guest refunds and credits, expenses and onboarding Tasks are saved as spreadsheets in ARHA Resolve > Documents > Resolve Backups. Each night gets its own dated folder, kept for 60 days."
    >
      {q.isError ? (
        <p className="text-sm text-muted-foreground">Could not load backup history.</p>
      ) : !q.data?.ready ? (
        <p className="text-sm text-muted-foreground">The backup history is not set up yet, so no backups run.</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No backups have run yet.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="font-medium">{r.folder_name}</span>
              <span className="text-muted-foreground">
                {r.status === "succeeded"
                  ? `${r.files?.length ?? 0} files saved${r.pruned_count ? `, ${r.pruned_count} old folder(s) removed` : ""}`
                  : r.status === "failed"
                    ? `Failed: ${r.error ?? "unknown reason"}`
                    : "Running"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
