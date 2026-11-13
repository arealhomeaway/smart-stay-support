/**
 * One home's page in its Onboarding view, Part 3 of 3 (approved by the Admin, Nov 12).
 * Pure rules only: the Home details sections, search, who may edit what, the changed-by
 * line, the six Files folders and Task defaults, vendor option labels and contact links,
 * the Breezeway description, the Add to my homes button and the header tags read from
 * fields. Server functions and the database re-check every save.
 */

/* ------------------------------------------------------------ sections */

export const DETAIL_SECTIONS = [
  { id: "project", title: "Project" },
  { id: "dates", title: "Dates" },
  { id: "team", title: "Team" },
  { id: "owner", title: "Owner record" },
  { id: "utilities", title: "Utilities and systems" },
  { id: "hoa", title: "HOA and compliance" },
  { id: "inspections", title: "Inspections" },
  { id: "pid", title: "From the PID" },
  { id: "operations", title: "Operations view" },
] as const;
export type DetailSection = (typeof DETAIL_SECTIONS)[number]["id"];

/** ?section= opens a section directly; anything else opens Project. */
export function detailSectionFor(raw: unknown): DetailSection {
  return DETAIL_SECTIONS.some((s) => s.id === raw) ? (raw as DetailSection) : "project";
}

/* ---------------------------------------------------------- permissions */

export type DetailsViewer = {
  userId: string | null;
  isAdmin: boolean;
  /** Director of Onboarding. */
  isOnboardingDirector: boolean;
  /** Director of Operations. */
  isOperationsDirector: boolean;
  /** Supervisor (manager app role), who corrects the committed date today (register O3). */
  isSupervisor: boolean;
  /** On this home's team. */
  isHomePm: boolean;
  isHomeDesigner: boolean;
  isHomeUtilities: boolean;
  /** Today's Project Team rule (can_manage_project_team): Admin, Supervisor, the current Director of Onboarding. */
  canManageTeam: boolean;
};

export function onHomeTeam(v: DetailsViewer): boolean {
  return v.isHomePm || v.isHomeDesigner || v.isHomeUtilities;
}

/** View-only: not on the home's team and not Admin or a Director. No Edit buttons. */
export function detailsViewOnly(v: DetailsViewer): boolean {
  return !(v.isAdmin || v.isOnboardingDirector || v.isOperationsDirector || onHomeTeam(v));
}

/** Which kind of field a row is, for the edit rule. */
export type DetailEditKind =
  | "project" // project fields, Telegram, LOA, purchase links
  | "committed_set" // set the Committed Handoff Date once
  | "committed_correct" // correct it after it is set
  | "dates" // other dates
  | "utilities"
  | "hoa"
  | "team_role"
  | "stagers"
  | "owner_record";

/**
 * 3.1 Who edits (server checked):
 * Project fields, Telegram, LOA: PM, Director, Admin. Dates: PM, Director, Admin, and the
 * committed date is set once by PM, Director or Admin. Correcting it stays with the Supervisor
 * and Admin (register O3 wins over the request's "Admin or Director of Operations"). Utilities: Utilities, PM, Director, Admin. HOA: PM, Utilities, Director, Admin.
 * Team and stagers: today's Project Team rule, unchanged (it gives the PM no team edits); stagers
 * stay with the Director of Onboarding and Admin (set_onboarding_project_stagers).
 * Owner record: Director and Admin (Change owner of record).
 */
export function canEditDetail(v: DetailsViewer, kind: DetailEditKind, role?: string | null): boolean {
  if (!v.userId) return false;
  const lead = v.isAdmin || v.isOnboardingDirector;
  switch (kind) {
    case "project":
    case "dates":
    case "committed_set":
      return lead || v.isHomePm;
    case "committed_correct":
      return v.isAdmin || v.isSupervisor;
    case "utilities":
      return lead || v.isHomePm || v.isHomeUtilities;
    case "hoa":
      return lead || v.isHomePm || v.isHomeUtilities;
    case "team_role":
      return v.canManageTeam && role !== "onboarding_director";
    case "stagers":
      return lead;
    case "owner_record":
      return lead;
  }
}

/** Files: move a file between folders (same people who can edit Project, plus the home's Designer and Utilities). */
export function canMoveFiles(v: DetailsViewer): boolean {
  return Boolean(v.userId) && !detailsViewOnly(v);
}

/* ---------------------------------------------------------------- rows */

export type DetailRow = {
  id: string;
  section: DetailSection;
  label: string;
  /** Display text; null is empty. */
  value: string | null;
  /** A secret: label is searchable, the value never is. */
  secret?: boolean;
  /** "Not assigned" for people, "Not set" for everything else. */
  person?: boolean;
};

export function emptyText(row: Pick<DetailRow, "person">): string {
  return row.person ? "Not assigned" : "Not set";
}

export function isEmptyValue(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

export type DetailHit = { rowId: string; section: DetailSection; label: string; snippet: string | null };

/** 3.1 search: label or value across every section; a code matches by its label only. */
export function searchDetailRows(rows: DetailRow[], query: string): DetailHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: DetailHit[] = [];
  for (const r of rows) {
    const inLabel = r.label.toLowerCase().includes(q);
    const inValue = !r.secret && !isEmptyValue(r.value) && r.value!.toLowerCase().includes(q);
    if (!inLabel && !inValue) continue;
    out.push({
      rowId: r.id,
      section: r.section,
      label: r.label,
      snippet: r.secret || isEmptyValue(r.value) ? null : r.value!.slice(0, 80),
    });
  }
  return out;
}

export type DetailChange = { by: string | null; at: string };

/** The small gray line under a saved value. */
export function changedLine(c: DetailChange | null | undefined): string | null {
  if (!c) return null;
  const d = new Date(c.at);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
  return `Changed by ${c.by?.trim() || "a teammate"} · ${date}`;
}

/** The plain words a Home details save writes into the project history, matched back by label. */
export function changeNote(label: string): string {
  return `${label} changed`;
}

/** Telegram group link: only a t.me address is kept. */
export function telegramProblem(url: string): string | null {
  const v = url.trim();
  if (!v) return null;
  return /^https:\/\/(t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+$/.test(v) ? null : "Paste the group's t.me link.";
}

export const LOA_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "not_needed", label: "Not needed" },
] as const;

/* --------------------------------------------------------------- files */

export const HOME_FOLDERS = [
  { id: "design", label: "Design", upload: "design" },
  { id: "agreements", label: "Agreements", upload: "agreement" },
  { id: "estimates", label: "Estimates and invoices", upload: "estimate_invoice" },
  { id: "photos", label: "Photos", upload: "media" },
  { id: "inspections", label: "Inspections", upload: "assessment" },
  { id: "other", label: "Other", upload: null },
] as const;
export type HomeFolder = (typeof HOME_FOLDERS)[number]["id"];
/** Folders a new file can go into: never Other. */
export const UPLOAD_FOLDERS = HOME_FOLDERS.filter((f) => f.upload !== null);

/** Design's old six buckets become groups inside Design (and Photos for design photos). */
export const DESIGN_SUBGROUPS = [
  { value: "design_floor_plan", label: "Floor plans" },
  { value: "design_mood_board", label: "Mood boards" },
  { value: "design_pick_list", label: "Pick lists" },
  { value: "design_install", label: "Install instructions" },
  { value: "design_staging", label: "Staging instructions" },
  { value: "design", label: "Design references" },
  { value: "measurements", label: "Measurements" },
] as const;
export const PHOTO_SUBGROUPS = [
  { value: "design_photo", label: "Design photos" },
  { value: "media", label: "Home photos" },
] as const;

export function folderForCategory(category: string | null | undefined): HomeFolder {
  const c = String(category ?? "");
  if (c === "design_photo" || c === "media") return "photos";
  if (DESIGN_SUBGROUPS.some((g) => g.value === c)) return "design";
  if (c === "agreement" || c === "pma") return "agreements";
  if (c === "estimate_invoice") return "estimates";
  if (c === "assessment") return "inspections";
  return "other";
}

/** The category a new upload into a folder (and optional Design or Photos group) is saved with. */
export function uploadCategory(folder: HomeFolder, subgroup?: string | null): string | null {
  if (folder === "other") return null;
  if (folder === "design" && subgroup && DESIGN_SUBGROUPS.some((g) => g.value === subgroup)) return subgroup;
  if (folder === "photos" && subgroup && PHOTO_SUBGROUPS.some((g) => g.value === subgroup)) return subgroup;
  return HOME_FOLDERS.find((f) => f.id === folder)!.upload;
}

/** Every category a folder holds (so a move keeps a file's group when it stays in its folder). */
export function categoriesInFolder(folder: HomeFolder): string[] {
  if (folder === "design") return DESIGN_SUBGROUPS.map((g) => g.value);
  if (folder === "photos") return PHOTO_SUBGROUPS.map((g) => g.value);
  if (folder === "agreements") return ["agreement", "pma"];
  if (folder === "estimates") return ["estimate_invoice"];
  if (folder === "inspections") return ["assessment"];
  return [];
}

/** 3.2: a Task's upload starts in the folder of its kind; none matched means the person picks. */
export function taskDefaultFolder(task: { title?: string | null; stage?: string | null; role?: string | null; task_kind?: string | null }): HomeFolder | null {
  const t = `${task.title ?? ""}`.toLowerCase();
  const role = `${task.role ?? ""}`.toLowerCase();
  if (/inspect|assessment|walkthrough/.test(t)) return "inspections";
  if (/invoice|estimate|quote|receipt/.test(t)) return "estimates";
  if (/agreement|\bpma\b|\bloa\b|contract|signed/.test(t)) return "agreements";
  if (/photo|picture/.test(t)) return "photos";
  if (/design|mood board|floor plan|pick list|staging|install/.test(t) || /design/.test(role)) return "design";
  return null;
}

export type FileLike = { title?: string | null; original_filename?: string | null; category?: string | null; uploaded_by_name?: string | null };
export function searchFiles<F extends FileLike>(files: F[], query: string): F[] {
  const q = query.trim().toLowerCase();
  if (!q) return files;
  return files.filter((f) =>
    [f.original_filename, f.title, f.uploaded_by_name].some((s) => (s ?? "").toLowerCase().includes(q)),
  );
}

export function folderCounts<F extends FileLike>(files: F[]): Record<HomeFolder, number> {
  const out = Object.fromEntries(HOME_FOLDERS.map((f) => [f.id, 0])) as Record<HomeFolder, number>;
  for (const f of files) out[folderForCategory(f.category)] += 1;
  return out;
}

/** What a file card previews. */
export function previewKind(mime: string | null | undefined, name?: string | null): "image" | "pdf" | "video" | "icon" {
  const m = String(mime ?? "").toLowerCase();
  const n = String(name ?? "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("video/") || /\.(mp4|mov|webm)$/.test(n)) return "video";
  return "icon";
}

/* ------------------------------------------------------------- vendors */

/** Option N from the vendor's recorded ranking; nothing recorded reads Not ranked. */
export function optionLabel(priority: number | null | undefined): string {
  return typeof priority === "number" && Number.isInteger(priority) && priority > 0 ? `Option ${priority}` : "Not ranked";
}

export type ContactMethod = "call" | "text" | "email";
export type VendorContact = { phone: string | null; email: string | null; preferred: ContactMethod | null };

/** Contact buttons, the preferred one first and marked. */
export function vendorContactLinks(c: VendorContact): { method: ContactMethod; label: string; href: string; preferred: boolean }[] {
  const out: { method: ContactMethod; label: string; href: string; preferred: boolean }[] = [];
  const tel = (c.phone ?? "").replace(/[^\d+]/g, "");
  if (tel) {
    out.push({ method: "call", label: "Call", href: `tel:${tel}`, preferred: c.preferred === "call" });
    out.push({ method: "text", label: "Text", href: `sms:${tel}`, preferred: c.preferred === "text" });
  }
  if (c.email?.trim()) out.push({ method: "email", label: "Email", href: `mailto:${c.email.trim()}`, preferred: c.preferred === "email" });
  return out.sort((a, b) => Number(b.preferred) - Number(a.preferred));
}

/** Vendors ranked first, then by name; Not ranked last. */
export function sortVendors<V extends { priority: number | null; name: string }>(rows: V[]): V[] {
  return [...rows].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || a.name.localeCompare(b.name));
}

/** Find a vendor returns only to a home's Onboarding view, never anywhere else. */
export function safeReturnPath(back: string | null | undefined): string | null {
  if (!back) return null;
  return /^\/onboarding\/[0-9a-f-]{36}(\?[^#\s]*)?$/i.test(back) ? back : null;
}

/** The vendor list address for Find a vendor: the home's market, the trade, and the way back. */
export function findVendorSearch(input: { market: string | null; trade: string | null; back: string }) {
  return {
    tab: "directory" as const,
    ...(input.market ? { market: input.market } : {}),
    ...(input.trade ? { trade: input.trade } : {}),
    back: input.back,
  };
}

/* ------------------------------------------------------------ breezeway */

/** 3.8: the full template step description, then the person's note on its own line. */
export function breezewayDescription(stepDescription: string | null | undefined, note: string | null | undefined, author: string | null | undefined): string {
  const base = (stepDescription ?? "").trim();
  const n = (note ?? "").trim();
  if (!n) return base;
  const line = `Note from ${author?.trim() || "the team"}: ${n}`;
  return base ? `${base}\n\n${line}` : line;
}

/** Breezeway takes photos; anything else goes as a link in the description. */
export const BREEZEWAY_PHOTO_MAX = 15 * 1024 * 1024;
export function breezewayFileRoute(file: { mime_type?: string | null; size_bytes?: number | null; original_filename?: string | null }): "upload" | "link" {
  const m = String(file.mime_type ?? "").toLowerCase();
  const ok = ["image/jpeg", "image/png", "image/webp", "image/heic"].includes(m);
  return ok && Number(file.size_bytes ?? 0) <= BREEZEWAY_PHOTO_MAX ? "upload" : "link";
}

/* ------------------------------------------------------------ my homes */

/** 3.5: assigned homes read Yours (no button); others Add or In my homes. */
export function myHomesState(input: { assigned: boolean; following: boolean }): "yours" | "following" | "add" {
  if (input.assigned) return "yours";
  return input.following ? "following" : "add";
}

/* ---------------------------------------------------------------- tags */

export type TagFields = {
  ownerType: string | null;
  risk: string | null;
  projectStatus: string | null;
  greaterArea: string | null;
  scope: string | null;
  labels: string[];
};

/** 3.6: header tags read only from real fields; an empty field shows no tag. */
export function fieldTags(f: TagFields): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const add = (key: string, v: string | null) => {
    if (v && v.trim()) out.push({ key, label: v.trim() });
  };
  add("owner_type", f.ownerType);
  add("risk", f.risk);
  add("project_status", f.projectStatus);
  add("greater_area", f.greaterArea);
  add("scope", f.scope);
  for (const l of f.labels) add(`label:${l}`, l);
  return out;
}
