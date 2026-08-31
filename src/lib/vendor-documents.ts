/**
 * The vendor paperwork ARHA actually handles, and what Resolve is allowed to
 * keep of each kind.
 *
 * Two retention rules, and the difference tickets legally, not cosmetically:
 *   - "store"        the file lives in Resolve, some of it supervisor-only.
 *   - "verify_only"  a person checks the document, records that they checked
 *                    it, and the document is never stored. Identity documents
 *                    (driver's licence, passport, SSN card) are verify-only.
 *                    The database refuses to hold a file for these.
 */

export type DocRetention = "store" | "verify_only";

export type VendorDocType = {
  code: string;
  label: string;
  blurb: string;
  retention: DocRetention;
  /** Restricted files are visible to supervisors and platform owners only. */
  restrictedByDefault: boolean;
  /** Ties the document to a screening requirement, when one exists. */
  requirementCode?: string;
  /** Prompt for an expiry date on upload — renewal is the point. */
  expiryExpected: boolean;
};

export const VENDOR_DOC_TYPES: VendorDocType[] = [
  {
    code: "insurance",
    label: "Certificate of insurance",
    blurb: "General liability, and workers' comp where the crew has employees.",
    retention: "store",
    restrictedByDefault: false,
    requirementCode: "insurance",
    expiryExpected: true,
  },
  {
    code: "license",
    label: "Licence or certification",
    blurb: "Trade licence, pool/pesticide certification, or state registration.",
    retention: "store",
    restrictedByDefault: false,
    requirementCode: "license",
    expiryExpected: true,
  },
  {
    code: "w9",
    label: "W-9",
    blurb: "Carries a tax ID. Supervisors only — never staff, never other vendors.",
    retention: "store",
    restrictedByDefault: true,
    requirementCode: "w9",
    expiryExpected: false,
  },
  {
    code: "service_agreement",
    label: "Service agreement",
    blurb: "Signed scope, term and cancellation terms for recurring service.",
    retention: "store",
    restrictedByDefault: false,
    expiryExpected: true,
  },
  {
    code: "rate_sheet",
    label: "Price list / rate sheet",
    blurb: "Dated pricing. Keep the version the crew quoted against.",
    retention: "store",
    restrictedByDefault: false,
    expiryExpected: true,
  },
  {
    code: "scope_of_work",
    label: "Scope of work",
    blurb: "What is and is not included in a standard visit.",
    retention: "store",
    restrictedByDefault: false,
    expiryExpected: false,
  },
  {
    code: "invoice_sample",
    label: "Sample invoice",
    blurb: "Reference for how this vendor bills, so coding stays consistent.",
    retention: "store",
    restrictedByDefault: false,
    expiryExpected: false,
  },
  {
    code: "attestation",
    label: "Signed ARHA attestation",
    blurb: "Conduct, guest privacy, photo and safety rules, signed by the crew.",
    retention: "store",
    restrictedByDefault: false,
    requirementCode: "attestation",
    expiryExpected: true,
  },
  {
    code: "references",
    label: "Reference notes",
    blurb: "Who was called, when, and what they said.",
    retention: "store",
    restrictedByDefault: false,
    requirementCode: "references",
    expiryExpected: false,
  },
  {
    code: "identity",
    label: "Identity check",
    blurb:
      "A supervisor views a government photo ID, records the check and the expiry, and the image is not kept.",
    retention: "verify_only",
    restrictedByDefault: true,
    requirementCode: "identity",
    expiryExpected: true,
  },
  {
    code: "other",
    label: "Other",
    blurb: "Anything else worth keeping on the company record.",
    retention: "store",
    restrictedByDefault: false,
    expiryExpected: false,
  },
];

export const DOC_TYPE_BY_CODE = new Map(VENDOR_DOC_TYPES.map((d) => [d.code, d]));

export function docTypeLabel(code: string) {
  return DOC_TYPE_BY_CODE.get(code)?.label ?? code;
}

export function isVerifyOnly(code: string) {
  return DOC_TYPE_BY_CODE.get(code)?.retention === "verify_only";
}

/** Ways a supervisor can confirm an identity without Resolve holding the image. */
export const IDENTITY_METHODS = [
  "Photo ID reviewed in person",
  "Photo ID reviewed on a live video call",
  "Third-party background check report reviewed",
  "Verified through the vendor company's own HR record",
] as const;
