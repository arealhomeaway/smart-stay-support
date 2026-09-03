import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ownerReport, ownerReportFile } from "@/lib/owner-report.functions";

function saveFile(file: { filename: string; mime: string; base64: string }) {
  const bin = atob(file.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Self-serve Hours & Participation Report. Nothing here waits on staff: the
 * report is built from the homeowner's own saved entries every time it is
 * opened or downloaded, so a late correction or a new approval simply
 * produces a freshly dated report.
 */
export function ParticipationReportPanel() {
  const fetchFile = useServerFn(ownerReportFile);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["owner-report"],
    queryFn: () => ownerReport(),
    retry: false,
  });

  const download = async (format: "pdf" | "csv") => {
    setBusy(format);
    try {
      saveFile(await fetchFile({ data: { format } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the report");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing your report…
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const final = data.kind === "final";
  const t = data.totals;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">
            {final ? "End-of-period participation report" : "Progress report"}
          </CardTitle>
          <Badge variant={final ? "default" : "secondary"}>
            {final ? "Available now" : `Day ${data.program.day} of ${data.program.totalDays}`}
          </Badge>
        </div>
        <CardDescription>
          {final
            ? "Your 90-day window has closed. Download your complete record whenever you need it — no request to ARHA required."
            : "A live snapshot of your participation so far. The end-of-period report becomes available automatically when your 90-day window closes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Reported hours</p>
            <p className="text-lg font-semibold">{t.reportedHours}</p>
            <p className="text-xs text-muted-foreground">Everything you have logged</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Entries</p>
            <p className="text-lg font-semibold">{data.entries.length}</p>
            <p className="text-xs text-muted-foreground">Documented participation records</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Not counted</p>
            <p className="text-lg font-semibold">
              {Math.round((t.returnedHours + t.supersededHours) * 100) / 100}
            </p>
            <p className="text-xs text-muted-foreground">Returned or replaced by a correction</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Period {data.program.startedOn ?? "not started"} to {data.program.endsOn ?? "n/a"} ·{" "}
          {data.entries.length} entries in period
          {data.outsidePeriod.length > 0
            ? ` · ${data.outsidePeriod.length} entries dated outside the period are listed separately`
            : ""}
. These are your own reported hours; ARHA does not certify them. This report is a record of
          participation, not a tax certification.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void download("pdf")} disabled={busy !== null}>
            {busy === "pdf" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => void download("csv")}
            disabled={busy !== null}
          >
            {busy === "csv" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download CSV detail
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
