import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StrReport } from "./str-report";

/**
 * STR Participation & Work Activity Report. Every read goes through a
 * database function that enforces access itself: internal ones allow only
 * Admin / Director of Operations; the owner one returns only released
 * versions of the caller's own completed programs.
 */
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (sb: unknown) => (sb as { rpc: Rpc }).rpc.bind(sb);

async function call<T>(sb: unknown, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await rpc(sb)(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const id = z.string().uuid();

export const strReportContext = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ propertyId: id }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(({ data, context }) =>
    call<Record<string, unknown>>(context.supabase, "str_report_context", { _property: data.propertyId }),
  );

const previewInput = z.object({
  propertyId: id,
  programId: id.nullable(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeOwner: z.boolean(),
  includeNonOwner: z.boolean(),
});

const preview = (sb: unknown, d: z.infer<typeof previewInput>) =>
  call<StrReport>(sb, "str_report_preview", {
    _property: d.propertyId,
    _program: d.programId,
    _from: d.from,
    _to: d.to,
    _include_owner: d.includeOwner,
    _include_nonowner: d.includeNonOwner,
  });

export const strReportPreview = createServerFn({ method: "POST" })
  .inputValidator((d) => previewInput.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(({ data, context }) => preview(context.supabase, data));

export const strReportVersion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ reportId: id }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(({ data, context }) =>
    call<StrReport & { sourceRefs: unknown[]; status: string }>(context.supabase, "str_report_version", {
      _report: data.reportId,
    }),
  );

export const strReportRelease = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ reportId: id, exclusionNote: z.string().max(2000).optional() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(({ data, context }) =>
    call(context.supabase, "str_report_release", { _report: data.reportId, _exclusion_note: data.exclusionNote ?? null }),
  );

export const strReportRevise = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ programId: id, propertyId: id, reason: z.string().max(2000) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(({ data, context }) =>
    call<{ created: boolean; message?: string }>(context.supabase, "str_report_revise", {
      _program: data.programId,
      _property: data.propertyId,
      _reason: data.reason,
    }),
  );

async function file(report: StrReport, format: "pdf" | "csv", appendix: boolean) {
  const { strReportCsv, reportFileBase } = await import("./str-report");
  const { strReportPdf, ownerSafe } = await import("./str-report.server");
  const safe = ownerSafe(report);
  const base = reportFileBase(safe);
  if (format === "csv")
    return { filename: `${base}.csv`, mime: "text/csv", base64: Buffer.from(strReportCsv(safe), "utf8").toString("base64") };
  const bytes = await strReportPdf(safe, { appendix });
  return { filename: `${base}.pdf`, mime: "application/pdf", base64: Buffer.from(bytes).toString("base64") };
}

/** Internal export: a draft from filters, or a stored version. */
export const strReportExport = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        format: z.enum(["pdf", "csv"]),
        appendix: z.boolean(),
        reportId: id.optional(),
        filters: previewInput.optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    let report: StrReport;
    if (data.reportId) {
      report = await call<StrReport>(context.supabase, "str_report_version", { _report: data.reportId });
    } else if (data.filters) {
      report = { ...(await preview(context.supabase, data.filters)), generatedAt: new Date().toISOString() };
    } else throw new Error("Choose a report to export.");
    return file(report, data.format, data.appendix);
  });

type OwnerReports = {
  activePrograms: number;
  reports: {
    id: string;
    version: number;
    propertyName: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
    releasedAt: string;
    revised: boolean;
    snapshot: StrReport;
  }[];
};

/** Owner: only released final versions of their own completed programs. */
export const ownerStrReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const res = (await call<OwnerReports | null>(context.supabase, "owner_str_reports")) ?? {
      activePrograms: 0,
      reports: [],
    };
    return res;
  });

export const ownerStrReportFile = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ reportId: id, format: z.enum(["pdf", "csv"]) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const res = await call<OwnerReports | null>(context.supabase, "owner_str_reports");
    const r = res?.reports.find((x) => x.id === data.reportId);
    if (!r) throw new Error("This report is not available.");
    return file({ ...r.snapshot, version: r.version, generatedAt: r.generatedAt, draft: false }, data.format, true);
  });
