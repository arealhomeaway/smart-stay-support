import { Info } from "lucide-react";
import { REPORTING_BASELINE_NOTE } from "@/lib/reporting";

/** Quiet in-product footnote explaining the clean-start reporting baseline. */
export function ReportingBaselineNote({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground ${className}`}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{REPORTING_BASELINE_NOTE}</span>
    </p>
  );
}
