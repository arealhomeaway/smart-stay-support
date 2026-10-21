/**
 * What KIND of work a step is, so its pop-up shows only the tools that step
 * actually needs. A step that files HOA documents should not offer to send a
 * job to Breezeway; a step that dispatches a handyman should.
 *
 * Pure: reads only the step's own title and instructions.
 */

export type TaskKind = "document" | "vendor" | "utility" | "homeowner" | "purchase" | "general";

const DOCUMENT = /document|hoa|covenant|permit|agreement|pma|report|form|file|records?|contract|insurance|save |store /i;
const VENDOR =
  /Work Order|handyman|vendor|installer|cleaner|inspection|painting|landscap|carpet|assembly|staging|install/i;
const UTILITY = /electric|gas service|water\/sewer|trash|internet|cox|utilit|meter/i;
const HOMEOWNER = /owner|mood board|approval|approve|walkthrough w\/? owner/i;
const PURCHASE = /purchase|order |amazon|essentials list|warehouse|pick list/i;

/** Breezeway only belongs on steps that dispatch field work. */
const BREEZEWAY = /breezeway|Work Order/i;

export function taskKind(input: { title: string; detail?: string | null }): TaskKind {
  const title = input.title ?? "";
  // Order matters: a "Work Order for repairs" is vendor work even though the
  // word "report" may appear in its instructions.
  if (VENDOR.test(title)) return "vendor";
  if (UTILITY.test(title)) return "utility";
  if (PURCHASE.test(title)) return "purchase";
  if (DOCUMENT.test(title)) return "document";
  if (HOMEOWNER.test(title)) return "homeowner";
  return "general";
}

/** Does this step dispatch field work, and so deserve the Breezeway panel? */
export function showsBreezeway(input: { title: string; detail?: string | null }): boolean {
  if (taskKind(input) === "document") return false;
  return BREEZEWAY.test(`${input.title ?? ""} ${input.detail ?? ""}`);
}

/** The plain-language heading for the step's own upload area. */
export function uploadTitle(kind: TaskKind): string {
  switch (kind) {
    case "document":
      return "Documents for this step";
    case "vendor":
      return "Job photos & paperwork";
    case "utility":
      return "Account confirmations & meter photos";
    case "purchase":
      return "Receipts & order confirmations";
    case "homeowner":
      return "What the homeowner is looking at";
    default:
      return "Photos & documents";
  }
}

export function uploadHint(kind: TaskKind): string {
  switch (kind) {
    case "document":
      return "Drop the signed or downloaded file here and it stays on this home's record.";
    case "vendor":
      return "Before and after photos, the vendor's quote, the signed job sheet.";
    case "utility":
      return "Confirmation emails, account numbers on paper, meter readings.";
    case "purchase":
      return "Receipts and order confirmations, so the spend is traceable.";
    case "homeowner":
      return "Anything the homeowner needs to see before they answer.";
    default:
      return "Anything that shows what happened on this step.";
  }
}
