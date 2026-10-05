/**
 * Read-only access to completed onboarding records from the Operations
 * property page. The database decides scope (staff only, completed Tasks,
 * operational files only); these functions never write.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CompletedOnboardingTask = {
  id: string;
  title: string;
  stage: string | null;
  detail: string | null;
  evidenceNote: string | null;
  completedAt: string | null;
  completedBy: string | null;
  assignedTo: string | null;
  observations: { id: string; body: string; createdAt: string; author: string | null }[];
  findings: {
    id: string;
    title: string;
    detail: string | null;
    category: string | null;
    severity: string | null;
    location: string | null;
    status: string | null;
    createdAt: string;
  }[];
  files: {
    id: string;
    title: string;
    filename: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
    uploadedBy: string | null;
  }[];
};

export type CompletedOnboardingRecords = {
  project: {
    status: string;
    handoffState: string | null;
    readyAt: string | null;
    readyBy: string | null;
    acceptedAt: string | null;
    acceptedBy: string | null;
    completedAt: string | null;
    projectManager: string | null;
  } | null;
  tasks: CompletedOnboardingTask[];
  history: { at: string; summary: string; actor: string | null }[];
};

export const readCompletedOnboardingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("read_completed_onboarding_records", {
      _property_id: data.propertyId,
    });
    if (error) throw new Error(error.message);
    return rows as unknown as CompletedOnboardingRecords;
  });

export const completedOnboardingFileUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Permission check runs as the caller; only then is a short-lived link signed.
    const { data: path, error } = await context.supabase.rpc(
      "can_read_completed_onboarding_document",
      { _document_id: data.documentId },
    );
    if (error || !path) throw new Error(error?.message ?? "That file is not available.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage
      .from("resolve-attachments")
      .createSignedUrl(path as string, 300);
    if (signed.error) throw new Error("Resolve could not open that file.");
    return { url: signed.data.signedUrl };
  });
