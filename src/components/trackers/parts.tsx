/** Small shared pieces for the Build 14 tracker pages. */
import type { ReactNode } from "react";

export const SELECT_CLASS = "h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";
export const INPUT_CLASS = "h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";
export const AREA_CLASS = "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] text-foreground";
export const LABEL_CLASS = "flex flex-col gap-1 text-[13px] text-muted-foreground";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={LABEL_CLASS}>
      {label}
      {children}
    </label>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border px-4 py-3">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

/** The database's own message, without the technical prefix. */
export function plainError(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? "Something went wrong. Try again.";
  return msg.replace(/^.*?ERROR:\s*/i, "").replace(/\s*\(SQLSTATE.*$/, "");
}
