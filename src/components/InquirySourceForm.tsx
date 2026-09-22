import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PET_FEE_PER_PET, INQUIRY_SOURCE_TYPES, type InquirySource } from "@/lib/inquiry-sources";

/** Blank stays blank: an empty box is stored as "not recorded", not as zero. */
function numberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: string) {
  return value.trim() ? value.trim() : null;
}

function show(value: number | null) {
  return value === null ? "" : String(value);
}

export type InquirySourceFormProps = {
  source?: InquirySource | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

export function InquirySourceForm({ source, onSaved, onCancel }: InquirySourceFormProps) {
  const [name, setName] = useState(source?.name ?? "");
  const [sourceType, setSourceType] = useState(source?.sourceType ?? "");
  const [corporateHousingExtra, setCorporateHousingExtra] = useState(show(source?.corporateHousingExtra ?? null));
  const [discountPercent, setDiscountPercent] = useState(show(source?.discountPercent ?? null));
  const [referralPercent, setReferralPercent] = useState(show(source?.referralPercent ?? null));
  const [referralFee, setReferralFee] = useState(show(source?.referralFee ?? null));
  const [referralRule, setReferralRule] = useState(source?.referralRule ?? "");
  const [utilities, setUtilities] = useState(source?.utilitiesIncluded === null || source?.utilitiesIncluded === undefined ? "" : source.utilitiesIncluded ? "yes" : "no");
  const [applicationFee, setApplicationFee] = useState(show(source?.applicationFee ?? null));
  const [cleaningFee, setCleaningFee] = useState(show(source?.cleaningFee ?? null));
  const [securityDeposit, setSecurityDeposit] = useState(show(source?.securityDeposit ?? null));
  const [petFee, setPetFee] = useState(String(source?.petFeePerPet ?? DEFAULT_PET_FEE_PER_PET));
  const [petFeeNotes, setPetFeeNotes] = useState(source?.petFeeNotes ?? "");
  const [petDepositNotes, setPetDepositNotes] = useState(source?.petDepositNotes ?? "");
  const [paymentDetails, setPaymentDetails] = useState(source?.paymentDetails ?? "");
  const [bookingDocuments, setBookingDocuments] = useState(source?.bookingDocuments ?? "");
  const [pricingFlags, setPricingFlags] = useState(source?.pricingFlags ?? "");
  const [active, setActive] = useState(source?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError("Enter the company or source name."); return; }
    setSaving(true); setError(null);
    const payload = {
      name: name.trim(),
      source_type: textOrNull(sourceType),
      corporate_housing_extra: numberOrNull(corporateHousingExtra),
      discount_percent: numberOrNull(discountPercent),
      referral_percent: numberOrNull(referralPercent),
      referral_fee: numberOrNull(referralFee),
      referral_rule: textOrNull(referralRule),
      utilities_included: utilities === "" ? null : utilities === "yes",
      application_fee: numberOrNull(applicationFee),
      cleaning_fee: numberOrNull(cleaningFee),
      security_deposit: numberOrNull(securityDeposit),
      pet_fee_per_pet: numberOrNull(petFee) ?? DEFAULT_PET_FEE_PER_PET,
      pet_fee_notes: textOrNull(petFeeNotes),
      pet_deposit_notes: textOrNull(petDepositNotes),
      payment_details: textOrNull(paymentDetails),
      booking_documents: textOrNull(bookingDocuments),
      pricing_flags: textOrNull(pricingFlags),
      active,
    };
    const request = source
      ? supabase.from("inquiry_sources").update(payload).eq("id", source.id).select("id").maybeSingle()
      : supabase.from("inquiry_sources").insert(payload).select("id").maybeSingle();
    const { data, error: saveError } = await request;
    setSaving(false);
    if (saveError || !data) {
      setError(saveError?.message.includes("inquiry_sources_name_key")
        ? "A source with this name already exists."
        : saveError?.message ?? "The source could not be saved.");
      return;
    }
    onSaved(data.id);
  }

  const field = (label: string, value: string, set: (next: string) => void, hint?: string) =>
    <label className="space-y-1 text-sm">{label}
      <Input value={value} onChange={(event) => set(event.target.value)} placeholder={hint ?? ""} />
    </label>;

  return <form onSubmit={(event) => void save(event)} className="space-y-4">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1 text-sm">Company or source name
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="space-y-1 text-sm">Type
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
          <option value="">Not recorded</option>
          {INQUIRY_SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      {field("Corporate Housing Extra ($)", corporateHousingExtra, setCorporateHousingExtra, "leave blank if none")}
      {field("Discount (%)", discountPercent, setDiscountPercent, "leave blank if none")}
      {field("Referral (% per month)", referralPercent, setReferralPercent)}
      {field("Referral flat fee ($ per month)", referralFee, setReferralFee)}
      {field("Referral rule", referralRule, setReferralRule, "10% or $500, whichever is less")}
      <label className="space-y-1 text-sm">Utilities included
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={utilities} onChange={(event) => setUtilities(event.target.value)}>
          <option value="">Not recorded</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      {field("Application fee ($)", applicationFee, setApplicationFee)}
      {field("Cleaning fee ($)", cleaningFee, setCleaningFee)}
      {field("Security deposit ($)", securityDeposit, setSecurityDeposit)}
      {field("Pet fee ($ per pet, per stay, nonrefundable)", petFee, setPetFee)}
    </div>
    <label className="space-y-1 text-sm block">Pet fee notes (reference only)
      <Textarea value={petFeeNotes} onChange={(event) => setPetFeeNotes(event.target.value)} rows={2} />
    </label>
    <label className="space-y-1 text-sm block">Pet deposit notes (reference only)
      <Textarea value={petDepositNotes} onChange={(event) => setPetDepositNotes(event.target.value)} rows={2} />
    </label>
    <label className="space-y-1 text-sm block">Payment details
      <Textarea value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} rows={2} />
    </label>
    <label className="space-y-1 text-sm block">Documents needed for booking
      <Textarea value={bookingDocuments} onChange={(event) => setBookingDocuments(event.target.value)} rows={2} />
    </label>
    <label className="space-y-1 text-sm block">Pricing notes to flag for coordinators
      <Textarea value={pricingFlags} onChange={(event) => setPricingFlags(event.target.value)} rows={2} />
    </label>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />In use
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2">
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : source ? "Save changes" : "Add source"}</Button>
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}
