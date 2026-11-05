import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { performSopUpload, sopVersionName, validateSopFile, SOP_NOT_SAVED, type SopReceipt, type SopLink } from "./sop-upload";

export const uploadSop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Choose a Word or PDF file.");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose a Word or PDF file.");
    validateSopFile(file);
    return { file, owner: z.string().uuid().parse(data.get("owner")), effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(data.get("effectiveDate")), text: z.string().trim().min(1).max(180000).parse(data.get("text")) };
  })
  .handler(async ({ data, context }) => {
    const rpc = async <T,>(name: string, params: Record<string, unknown>): Promise<T> => {
      const result = await context.supabase.rpc(name as never, params as never);
      if (result.error) throw new Error(result.error.code === "PGRST202" ? "SOP Upload is not available yet. Saved nothing." : result.error.message);
      return result.data as T;
    };
    // Caller-authenticated permission and schema checks happen before AI or SharePoint.
    const previous = await rpc<unknown[]>("sop_upload_context", { _name: data.file.name });
    const { draftSopPlaybooks } = await import("./sop-ai.server");
    const { sopSharePoint } = await import("./sop-sharepoint.server");
    let sharepoint;
    try { sharepoint = await sopSharePoint(); } catch { throw new Error(SOP_NOT_SAVED); }
    return performSopUpload({
      generate: () => draftSopPlaybooks(data.text, previous),
      reserve: () => rpc<{ id: string; version: number }>("reserve_sop_upload", { _name: data.file.name, _owner: data.owner, _effective_on: data.effectiveDate }),
      upload: (version) => sharepoint.upload(data.file, sopVersionName(data.file.name, version)),
      commit: (id, file, drafts) => rpc<SopReceipt>("commit_sop_upload", { _id: id, _file: file, _drafts: drafts }),
      receipt: (id) => rpc<SopReceipt | null>("sop_upload_receipt", { _id: id }),
      removeFile: sharepoint.remove,
      abort: (id) => rpc<void>("abort_sop_upload", { _id: id }),
    });
  });

export const getSopPlaybookLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("read_sop_playbook_links" as never);
    if (error?.code === "PGRST202") return {} as Record<string, SopLink>;
    if (error) throw new Error("Could not load SOP links.");
    return data as unknown as Record<string, SopLink>;
  });