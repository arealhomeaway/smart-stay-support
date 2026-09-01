/**
 * Shared, browser-safe rules for Resolve file attachments.
 *
 * The bytes live in Resolve's own private bucket (`resolve-attachments`).
 * Nothing here talks to storage — these are the rules both the browser and
 * the server apply, so the interface and the server never disagree about
 * what is allowed. The server is the enforcer; the browser copy only exists
 * to give a fast, clear message before a pointless upload starts.
 */

export const ATTACHMENT_BUCKET = "resolve-attachments";

/** 50 MB — a phone video clip fits; anything larger fails fast on site. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type AttachmentEntity = "ticket" | "onboarding_task" | "property";

export const ATTACHMENT_ENTITIES: AttachmentEntity[] = ["ticket", "onboarding_task", "property"];

/** Visibility of a stored file. */
export type AttachmentVisibility = "internal" | "owner_shared";

/**
 * How a property-level record is filed. Ticket and task files keep their
 * record as their context and leave this empty.
 *
 * The values below are the property document library's shelves; the DB check
 * constraint on `documents.category` holds the same list.
 */
export type DocumentCategory =
  // Property & Ownership
  | "pma"
  | "insurance"
  | "ownership"
  // HOA & Compliance
  | "hoa"
  | "covenants"
  | "permit_license"
  | "compliance"
  // Property Systems & Manuals
  | "manual"
  | "hvac_doc"
  | "warranty"
  | "equipment"
  // Access & Security (non-secret operational documents only)
  | "access_security"
  // Onboarding
  | "measurements"
  | "design"
  | "onboarding_evidence"
  // Operations
  | "assessment"
  | "operations"
  | "maintenance"
  // Media
  | "media"
  // Unfiled
  | "reference"
  | "other";

export type DocumentGroupId =
  | "property_ownership"
  | "hoa_compliance"
  | "systems_manuals"
  | "access_security"
  | "onboarding"
  | "operations"
  | "media"
  | "unfiled";

export const DOCUMENT_GROUPS: { id: DocumentGroupId; label: string; blurb: string }[] = [
  { id: "property_ownership", label: "Property & Ownership", blurb: "PMA, insurance and ownership records." },
  { id: "hoa_compliance", label: "HOA & Compliance", blurb: "HOA documents, covenants, permits, licences and compliance references." },
  { id: "systems_manuals", label: "Property Systems & Manuals", blurb: "Appliance manuals, HVAC, warranties and equipment references." },
  { id: "access_security", label: "Access & Security", blurb: "Non-secret operational access documents. Codes and passwords never live here." },
  { id: "onboarding", label: "Onboarding", blurb: "Measurements, design references and onboarding evidence." },
  { id: "operations", label: "Operations", blurb: "Assessments, operating references and maintenance documentation." },
  { id: "media", label: "Media", blurb: "Property media that is not OwnerRez listing photography." },
  { id: "unfiled", label: "Other & Unfiled", blurb: "Anything not yet filed on a shelf." },
];

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; group: DocumentGroupId }[] = [
  { value: "pma", label: "Property management agreement (PMA)", group: "property_ownership" },
  { value: "insurance", label: "Insurance", group: "property_ownership" },
  { value: "ownership", label: "Ownership / property document", group: "property_ownership" },
  { value: "hoa", label: "HOA document", group: "hoa_compliance" },
  { value: "covenants", label: "Covenants / CC&Rs", group: "hoa_compliance" },
  { value: "permit_license", label: "Permit or licence", group: "hoa_compliance" },
  { value: "compliance", label: "Compliance reference", group: "hoa_compliance" },
  { value: "manual", label: "Appliance or property manual", group: "systems_manuals" },
  { value: "hvac_doc", label: "HVAC document", group: "systems_manuals" },
  { value: "warranty", label: "Warranty", group: "systems_manuals" },
  { value: "equipment", label: "Equipment reference", group: "systems_manuals" },
  { value: "access_security", label: "Access & security document (non-secret)", group: "access_security" },
  { value: "measurements", label: "Measurements", group: "onboarding" },
  { value: "design", label: "Design / reference material", group: "onboarding" },
  { value: "onboarding_evidence", label: "Onboarding evidence", group: "onboarding" },
  { value: "assessment", label: "Property assessment", group: "operations" },
  { value: "operations", label: "Operating reference", group: "operations" },
  { value: "maintenance", label: "Maintenance documentation", group: "operations" },
  { value: "media", label: "Property photo or media", group: "media" },
  { value: "reference", label: "Property reference", group: "unfiled" },
  { value: "other", label: "Other property record", group: "unfiled" },
];

export function documentCategoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? null;
}

export function documentGroupFor(value: string | null | undefined): DocumentGroupId {
  return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.group ?? "unfiled";
}

/**
 * Shortcuts pinned above the library. A quick link is only rendered when a
 * document of that category actually exists — never as an empty placeholder.
 */
export const DOCUMENT_QUICK_LINKS: { category: DocumentCategory; label: string }[] = [
  { category: "pma", label: "PMA" },
  { category: "insurance", label: "Insurance" },
  { category: "hoa", label: "HOA" },
  { category: "warranty", label: "Warranty" },
  { category: "manual", label: "Property manual" },
];


/** Exactly what staff and owners may attach. Anything else is refused. */
export const ALLOWED_MIME_TYPES = [
  // photos
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  // video
  "video/mp4",
  "video/quicktime",
  "video/webm",
  // documents
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function kindFor(mime: string): "photo" | "video" | "document" {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ValidationResult = { ok: true } | { ok: false; message: string };

/**
 * One place that decides whether a file may be attached at all.
 * Returns the exact sentence shown to the person uploading.
 */
export function validateFile(input: { name: string; type: string; size: number }): ValidationResult {
  if (!input.name.trim()) return { ok: false, message: "That file has no name Resolve can record." };
  if (input.size <= 0) return { ok: false, message: "That file is empty — nothing to upload." };
  if (input.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `${formatBytes(input.size)} is over the ${formatBytes(MAX_FILE_BYTES)} limit. Trim the clip or upload a smaller copy.`,
    };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.type)) {
    return {
      ok: false,
      message: `Resolve does not accept ${input.type || "that file type"}. Use a photo, a video, a PDF or an Office document.`,
    };
  }
  return { ok: true };
}

/** Strips anything that would make a storage path ambiguous or unsafe. */
export function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/]/g, "-")
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "file").slice(-120);
}

/**
 * `{entity_type}/{entity_id}/{uuid}-{filename}`.
 * The path carries the record, not the person or the status, so a file stays
 * attached through assignment, review, handoff and closure.
 */
export function storagePathFor(entityType: AttachmentEntity, entityId: string, uploadKey: string, filename: string) {
  return `${entityType}/${entityId}/${uploadKey}-${safeFilename(filename)}`;
}
