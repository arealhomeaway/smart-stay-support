import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { saveOwnerReportFile } from "@/lib/owner-report-download";
import { OWNER_WAITING_COPY, REPORT_DISCLAIMER, hrs, timeLabel, totalText } from "@/lib/str-report";
import { ownerStrReportFile, ownerStrReports } from "@/lib/str-report.functions";

/**
 * Homeowner view of the final STR Participation & Work Activity Report. The
 * server returns only released versions of the owner's own completed
 * programs, so nothing here can show a draft, a provisional record or
 * safeguard data.
 */
export function StrReportPanel() {
  const load = useServerFn(ownerStrReports);
  const fetchFile = useServerFn(ownerStrReportFile);
  const q = useQuery({ queryKey: ["owner-str-reports"], queryFn: () => load(), retry: false });
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  if (!q.data) return null;
  const { reports, activePrograms } = q.data;
  if (!reports.length && !activePrograms) return null;
  const current = reports.find((r) => r.id === selected) ?? reports[0];

  const download = async (format: "pdf" | "csv") => {
    if (!current) return;
    setBusy(format);
    try {
      saveOwnerReportFile(await fetchFile({ data: { reportId: current.id, format } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download the report");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />STR Participation & Work Activity Report</span>}>
      {!current ? (
        <p className="text-sm text-muted-foreground">{OWNER_WAITING_COPY}</p>
      ) : (
        <div className="space-y-4">
          {reports.length > 1 ? (
            <select aria-label="Report" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={current.id} onChange={(e) => setSelected(e.target.value)}>
              {reports.map((r) => <option key={r.id} value={r.id}>{r.propertyName} · {r.periodStart} to {r.periodEnd}</option>)}
            </select>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {current.propertyName} · Program period {current.periodStart} to {current.periodEnd} · Version {current.version}
            {current.revised ? " (latest revision)" : ""} · generated {current.releasedAt?.slice(0, 10) ?? current.generatedAt.slice(0, 10)}
          </p>
          <p className="text-sm">Recorded owner participation: <strong>{hrs(current.snapshot.totals.ownerMinutes)?.toFixed(2)} hrs</strong> across {current.snapshot.totals.ownerEntries} entries</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Person</th><th>Work type</th><th>Activities</th><th>Time type</th><th>Total</th></tr></thead>
            <tbody>
              {current.snapshot.summary.map((s, i) => (
                <tr key={i} className="border-t border-border"><td className="py-1.5">{s.person}</td><td>{s.workType}</td><td>{s.activities}</td><td>{timeLabel(s)}</td><td>{totalText(s)}</td></tr>
              ))}
            </tbody>
          </table>
          {current.snapshot.underReviewNote ? <p className="text-sm">{current.snapshot.underReviewNote}</p> : null}
          <div className="flex gap-2">
            <Button onClick={() => void download("pdf")} disabled={busy !== null}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
            <Button variant="outline" onClick={() => void download("csv")} disabled={busy !== null}><Download className="mr-2 h-4 w-4" />Download CSV</Button>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{REPORT_DISCLAIMER}</p>
    </SectionCard>
  );
}
