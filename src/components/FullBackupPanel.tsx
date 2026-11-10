import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { useRole } from "@/hooks/useRole";
import { listFullBackups, runFullBackupNow, verifyFullBackupNow, type FullBackupRecord } from "@/lib/full-backup.functions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " Central";
const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-US");

function VerifyResult({ b }: { b: FullBackupRecord }) {
  const v = b.verify_result;
  if (!b.verified_at || !v) return <p className="text-sm text-muted-foreground">Not checked yet.</p>;
  if (v.error) return <p className="text-sm text-destructive">Checked {when(b.verified_at)}: {v.error}</p>;
  const changed = (v.lines ?? []).filter((l) => l.state === "changed");
  const broken = (v.lines ?? []).filter((l) => l.state === "broken");
  return (
    <div className="space-y-1 text-sm">
      <p className={v.ok ? "" : "text-destructive"}>
        Checked {when(b.verified_at)}:{" "}
        {v.ok ? "every file matches what was saved." : `${broken.length} files do not match what was saved.`}
      </p>
      {broken.length ? <p className="text-destructive">Not matching: {broken.map((l) => l.table).join(", ")}</p> : null}
      {changed.length ? (
        <p className="text-muted-foreground">
          Changed since the backup: {changed.map((l) => `${l.table} (${n(l.saved)} saved, ${n(l.live)} now)`).join(", ")}
        </p>
      ) : (
        <p className="text-muted-foreground">Every table still has the same number of rows.</p>
      )}
      {v.newTables?.length ? <p className="text-muted-foreground">New tables since: {v.newTables.join(", ")}</p> : null}
    </div>
  );
}

export function FullBackupPanel() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const listFn = useServerFn(listFullBackups);
  const runFn = useServerFn(runFullBackupNow);
  const verifyFn = useServerFn(verifyFullBackupNow);
  const [showCounts, setShowCounts] = useState(false);
  const q = useQuery({ queryKey: ["full-backups"], queryFn: () => listFn(), enabled: isAdmin });
  const refresh = () => qc.invalidateQueries({ queryKey: ["full-backups"] });
  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) =>
      r.ok
        ? toast.success(`Backup saved: ${r.folder}, ${n(r.tableCount)} tables, ${n(r.totalRows)} rows`)
        : toast.error(`Backup did not finish: ${r.error}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Backup did not start"),
    onSettled: refresh,
  });
  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: (r) => (r.ok ? toast.success("Every file matches what was saved") : toast.error("Some files do not match")),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Check did not run"),
    onSettled: refresh,
  });

  if (!isAdmin) return null;
  const last = q.data?.backups.find((b) => b.status === "succeeded") ?? null;
  const latest = q.data?.backups[0] ?? null;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Archive className="size-4" aria-hidden="true" /> Back up everything
        </span>
      }
      actions={
        <span className="flex flex-wrap items-center gap-2">
          {last ? (
            <Button size="sm" variant="outline" className="min-h-11" disabled={verify.isPending || run.isPending} onClick={() => verify.mutate(last.id)}>
              {verify.isPending ? "Checking..." : "Verify"}
            </Button>
          ) : null}
          <Button size="sm" className="min-h-11" disabled={!q.data?.ready || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? "Backing up..." : "Back up everything"}
          </Button>
        </span>
      }
      description="Saves every table to its own file in a private dated folder, with a list of every table, its row count and a fingerprint. Passwords, codes and keys are never included."
    >
      {q.isError ? (
        <p className="text-sm text-muted-foreground">Could not load the backups.</p>
      ) : !q.data ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !q.data.ready ? (
        <p className="text-sm text-muted-foreground">Backups are not set up yet.</p>
      ) : !last ? (
        <p className="text-sm text-muted-foreground">No full backup yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge tone={(last.verify_ok === false ? "breached" : "resolved") as never}>
              {last.verify_ok === false ? "Check failed" : last.verify_ok ? "Checked" : "Saved"}
            </StatusBadge>
            <span>
              Last backup {when(last.finished_at ?? last.created_at)}
              {last.created_by_name ? ` by ${last.created_by_name}` : ""}: folder {last.folder}, {n(last.table_count)} tables,{" "}
              {n(last.total_rows)} rows.
            </span>
          </div>
          <VerifyResult b={last} />
          <Button variant="ghost" size="sm" className="min-h-11 px-0" onClick={() => setShowCounts((s) => !s)}>
            {showCounts ? "Hide row counts" : "Show row counts"}
          </Button>
          {showCounts && last.counts ? (
            <ul className="grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(last.counts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([t, c]) => (
                  <li key={t} className="flex justify-between gap-2 border-b border-border/50 py-0.5">
                    <span className="truncate">{t}</span>
                    <span className="tabular-nums">{n(c)}</span>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      )}
      {latest && latest.status === "failed" && latest.id !== last?.id ? (
        <p className="mt-2 text-sm text-destructive">The latest backup did not finish: {latest.error}</p>
      ) : null}
    </SectionCard>
  );
}
