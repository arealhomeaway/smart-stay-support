/** Row mapping shared by the browser table and the server-side quote builder. */
import { DEFAULT_PET_FEE_PER_PET, type InquirySource } from "./inquiry-sources";

export const INQUIRY_SOURCE_COLUMNS =
  "id,name,source_type,corporate_housing_extra,discount_percent,referral_percent,referral_fee,referral_rule,utilities_included,application_fee,cleaning_fee,security_deposit,pet_fee_per_pet,pet_fee_notes,pet_deposit_notes,payment_details,booking_documents,pricing_flags,active";

type Row = Record<string, unknown>;

/** Blank stays blank: only a real number becomes a number. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function mapInquirySource(row: Row): InquirySource {
  return {
    id: String(row["id"]),
    name: String(row["name"] ?? ""),
    sourceType: text(row["source_type"]),
    corporateHousingExtra: num(row["corporate_housing_extra"]),
    discountPercent: num(row["discount_percent"]),
    referralPercent: num(row["referral_percent"]),
    referralFee: num(row["referral_fee"]),
    referralRule: text(row["referral_rule"]),
    utilitiesIncluded: typeof row["utilities_included"] === "boolean" ? row["utilities_included"] : null,
    applicationFee: num(row["application_fee"]),
    cleaningFee: num(row["cleaning_fee"]),
    securityDeposit: num(row["security_deposit"]),
    petFeePerPet: num(row["pet_fee_per_pet"]) ?? DEFAULT_PET_FEE_PER_PET,
    petFeeNotes: text(row["pet_fee_notes"]),
    petDepositNotes: text(row["pet_deposit_notes"]),
    paymentDetails: text(row["payment_details"]),
    bookingDocuments: text(row["booking_documents"]),
    pricingFlags: text(row["pricing_flags"]),
    active: row["active"] !== false,
  };
}
