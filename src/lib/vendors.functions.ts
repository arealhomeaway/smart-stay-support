import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GATEKEEPER_RESULTS, VENDOR_STATUSES } from "@/lib/vendors";

/** Staff-only: the vendor company directory with screening readiness. */
export const vendorDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadVendorDirectory } = await import("./vendors.server");
    await assertStaff(context.supabase, context.userId);
    return loadVendorDirectory(context.supabase);
  });

/** Staff-only: one vendor company with its team, coverage and screening. */
export const vendorOrgDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadVendorOrg } = await import("./vendors.server");
    await assertStaff(context.supabase, context.userId);
    const { data: supervisor } = await context.supabase.rpc("is_supervisor", {
      _user_id: context.userId,
    });
    return loadVendorOrg(context.supabase, data.orgId, Boolean(supervisor));
  });

export const createVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        displayName: z.string().trim().min(2).max(120),
        legalName: z.string().trim().max(160).optional().nullable(),
        vendorClass: z.enum(["company", "sole_operator", "internal_team"]),
        serviceCategories: z.array(z.string().max(60)).max(20),
        markets: z.array(z.string().max(60)).max(20),
        primaryContactName: z.string().trim().max(120).optional().nullable(),
        primaryContactEmail: z
          .string()
          .trim()
          .email()
          .max(180)
          .optional()
          .nullable()
          .or(z.literal("")),
        primaryContactPhone: z.string().trim().max(40).optional().nullable(),
        website: z.string().trim().max(200).optional().nullable(),
        emergencyAvailable: z.boolean(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { createVendorOrg } = await import("./vendors.server");
    return createVendorOrg(context.supabase, context.userId, data);
  });

export const changeVendorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        status: z.enum(VENDOR_STATUSES),
        reason: z.string().trim().min(5).max(600),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setVendorStatus } = await import("./vendors.server");
    return setVendorStatus(context.supabase, context.userId, data);
  });

export const recordGatekeeperResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        requirementId: z.string().uuid(),
        result: z.enum(GATEKEEPER_RESULTS),
        note: z.string().trim().max(600).optional().nullable(),
        expiresOn: z.string().trim().max(10).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setGatekeeperResult } = await import("./vendors.server");
    return setGatekeeperResult(context.supabase, context.userId, data);
  });

export const addVendorCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        propertyId: z.string().uuid(),
        serviceCategory: z.string().trim().min(2).max(60),
        coveragePriority: z.enum(["primary", "backup", "emergency", "recurring"]),
        approvalLimit: z.number().min(0).max(1000000).optional().nullable(),
        accessRequirements: z.string().trim().max(600).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { addCoverage } = await import("./vendors.server");
    return addCoverage(context.supabase, context.userId, data);
  });

export const dropVendorCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ coverageId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { removeCoverage } = await import("./vendors.server");
    return removeCoverage(context.supabase, context.userId, data.coverageId);
  });

/* --------------------------- legacy migration --------------------------- */

export const stageLegacyVendors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sourceSystem: z.string().trim().min(2).max(40),
        label: z.string().trim().min(2).max(120),
        text: z.string().trim().min(3).max(200000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { createImportBatch } = await import("./vendor-import.server");
    return createImportBatch(context.supabase, context.userId, data);
  });

export const vendorImportQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertSupervisor } = await import("./vendors.server");
    const { loadImportQueue } = await import("./vendor-import.server");
    await assertSupervisor(context.supabase, context.userId);
    return loadImportQueue(context.supabase);
  });

export const decideVendorImportRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        rowId: z.string().uuid(),
        action: z.enum(["create", "match", "skip"]),
        orgId: z.string().uuid().optional().nullable(),
        note: z.string().trim().max(600).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { decideImportRow } = await import("./vendor-import.server");
    return decideImportRow(context.supabase, context.userId, data);
  });

/* --------------------------- territories --------------------------- */

export const addVendorServiceArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        serviceCategory: z.string().trim().min(2).max(60),
        zipText: z.string().trim().min(5).max(20000),
        territoryLabel: z.string().trim().max(80).optional().nullable(),
        coveragePriority: z.enum(["primary", "backup", "emergency", "recurring"]),
        travelNote: z.string().trim().max(600).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { addServiceArea } = await import("./vendors.server");
    return addServiceArea(context.supabase, context.userId, data);
  });

export const dropVendorServiceArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ areaId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { removeServiceArea } = await import("./vendors.server");
    return removeServiceArea(context.supabase, context.userId, data.areaId);
  });

/** Which homes this company actually reaches, and whether by home or territory. */
export const vendorCoverageMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { coverageForOrg } = await import("./vendors.server");
    await assertStaff(context.supabase, context.userId);
    return coverageForOrg(context.supabase, data.orgId);
  });

/* --------------------------- documents --------------------------- */

export const fileVendorDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        docType: z.string().trim().min(2).max(40),
        title: z.string().trim().min(2).max(160),
        externalUrl: z.string().trim().url().max(600).optional().nullable().or(z.literal("")),
        expiresOn: z.string().trim().max(10).optional().nullable(),
        note: z.string().trim().max(1000).optional().nullable(),
        verified: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordVendorDocument } = await import("./vendors.server");
    return recordVendorDocument(context.supabase, context.userId, data);
  });

export const verifyVendorIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        subject: z.string().trim().min(2).max(120),
        method: z.string().trim().min(4).max(160),
        expiresOn: z.string().trim().max(10).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordIdentityCheck } = await import("./vendors.server");
    return recordIdentityCheck(context.supabase, context.userId, data);
  });
