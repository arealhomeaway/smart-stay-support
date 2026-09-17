import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ownership is resolved server-side from the signed-in account: a homeowner
 * can only ever reach the program whose owner_user_id is their own uid, and
 * the file bytes come back through this authenticated call — never a link.
 */
async function ownProgramId(supabase: never, userId: string) {
  const client = supabase as unknown as import("./owner-participation.server").Client;
  const { findOwnerProgram } = await import("./owner-program-reader.server");
  const program = await findOwnerProgram(client, userId);
  if (!program) throw new Error("No participation program is linked to this account.");
  return program.id;
}

/** Report model for the portal panel — same numbers the files carry. */
export const ownerReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildOwnerReport } = await import("./owner-report.server");
    const programId = await ownProgramId(context.supabase as never, context.userId);
    return buildOwnerReport(context.supabase as never, programId);
  });

/** PDF or CSV bytes, base64 encoded, generated on demand from saved records. */
export const ownerReportFile = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ format: z.enum(["pdf", "csv"]) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { buildOwnerReport, reportCsv, reportPdf, reportFileNames } =
      await import("./owner-report.server");
    const programId = await ownProgramId(context.supabase as never, context.userId);
    const report = await buildOwnerReport(context.supabase as never, programId);
    const names = reportFileNames(report);
    if (data.format === "csv") {
      return {
        filename: names.csv,
        mime: "text/csv",
        base64: Buffer.from(reportCsv(report), "utf8").toString("base64"),
      };
    }
    const bytes = await reportPdf(report);
    return {
      filename: names.pdf,
      mime: "application/pdf",
      base64: Buffer.from(bytes).toString("base64"),
    };
  });
