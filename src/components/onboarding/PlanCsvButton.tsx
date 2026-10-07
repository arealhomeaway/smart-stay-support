import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportProjectPlanCsv, exportTemplateCsv } from "@/lib/plan-csv.functions";

/** Read-only download; never changes the plan. */
export function PlanCsvButton(props: { propertyId: string } | { templateId: string }) {
  const project = useServerFn(exportProjectPlanCsv);
  const template = useServerFn(exportTemplateCsv);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = "propertyId" in props ? await project({ data: { propertyId: props.propertyId } }) : await template({ data: { templateId: props.templateId } });
      const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The download failed.");
    } finally { setBusy(false); }
  };
  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={run}>
      <Download className="size-4" /> {busy ? "Preparing…" : "Download CSV"}
    </Button>
  );
}
