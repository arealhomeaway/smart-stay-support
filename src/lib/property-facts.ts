/**
 * Verified property facts, sourced from OwnerRez structured fields only.
 *
 * Two OwnerRez sources back every fact here:
 *  - /properties  → max_pets (structured pet allowance)
 *  - /listings/{id} → amenity_call_outs + amenity_categories (published amenities)
 *
 * Nothing is inferred from free text typed into Resolve. A fact is either
 * verified true, verified false, or unknown — and a home whose fact is unknown
 * is never offered against a filter that requires it.
 */

export type FactValue = boolean | null;

export type AmenityKey =
  | "wifi"
  | "air_conditioning"
  | "heating"
  | "washer_dryer"
  | "kitchen"
  | "parking"
  | "garage"
  | "pool"
  | "hot_tub"
  | "fenced_yard"
  | "workspace"
  | "self_check_in"
  | "accessible";

type AmenitySpec = {
  key: AmenityKey;
  label: string;
  /** Categories that, when present on the listing, count as evidence either way. */
  evidence: string[];
  match: RegExp;
  /** An explicit published statement that the home does NOT have it. */
  deny?: RegExp;
};

const POPULAR = "PopularAmenityFeatures";

export const AMENITY_SPECS: AmenitySpec[] = [
  { key: "wifi", label: "Wifi", evidence: [POPULAR], match: /\b(internet|wifi|wi-fi)\b/i },
  { key: "air_conditioning", label: "Air conditioning", evidence: [POPULAR], match: /air conditioning/i },
  { key: "heating", label: "Heating", evidence: [POPULAR], match: /heating|furnace/i },
  {
    key: "washer_dryer",
    label: "Washer & dryer",
    evidence: [POPULAR],
    match: /washing machine|washer\b/i,
  },
  { key: "kitchen", label: "Full kitchen", evidence: ["KitchenFeatures"], match: /\bkitchen\b/i },
  {
    key: "parking",
    label: "Parking",
    evidence: ["ParkingFeatures"],
    match: /parking|garage|driveway|carport/i,
  },
  { key: "garage", label: "Garage", evidence: ["ParkingFeatures"], match: /\bgarage\b/i },
  {
    key: "pool",
    label: "Pool",
    evidence: ["PoolSpaFeatures", "OutdoorFeatures"],
    match: /\bpool\b/i,
    deny: /no pool/i,
  },
  {
    key: "hot_tub",
    label: "Hot tub",
    evidence: ["PoolSpaFeatures", "OutdoorFeatures"],
    match: /hot tub|jacuzzi|\bspa\b/i,
  },
  {
    key: "fenced_yard",
    label: "Fenced yard",
    evidence: ["OutdoorFeatures"],
    match: /fenced|privacy fence/i,
  },
  {
    key: "workspace",
    label: "Workspace",
    evidence: ["BusinessFeatures", POPULAR],
    match: /workspace|\bdesk\b|office/i,
  },
  {
    key: "self_check_in",
    label: "Self check-in",
    evidence: ["CheckInType"],
    match: /smart lock|keypad|lockbox|self check/i,
  },
  {
    key: "accessible",
    label: "Step-free access",
    evidence: ["AccessibilityFeatures", "HouseRules"],
    match: /wheelchair accessible|step-free|single level|no stairs/i,
    deny: /wheelchair inaccessible|not wheelchair/i,
  },
];

export const AMENITY_LABELS: Record<AmenityKey, string> = AMENITY_SPECS.reduce(
  (all, spec) => ({ ...all, [spec.key]: spec.label }),
  {} as Record<AmenityKey, string>,
);

/** The shape we read out of OwnerRez; only the fields this module needs. */
export type OwnerRezAmenitySource = {
  amenity_call_outs?: { text?: string | null }[] | null;
  amenity_categories?: { type?: string | null; amenities?: { text?: string | null }[] | null }[] | null;
};

export type PropertyFacts = {
  /** null means OwnerRez does not publish an answer — never treat as "no". */
  petsAllowed: FactValue;
  maxPets: number | null;
  /** Species-level allowance, published by OwnerRez; null when unstated. */
  dogsAllowed: FactValue;
  catsAllowed: FactValue;
  amenities: Record<AmenityKey, FactValue>;
  /** True when the listing published no amenity data at all. */
  amenitiesUnpublished: boolean;
};

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/&ndash;|&amp;|&nbsp;/g, " ").trim();
}

function listingTexts(listing: OwnerRezAmenitySource | null) {
  const texts: string[] = [];
  const categories = new Set<string>();
  for (const callOut of listing?.amenity_call_outs ?? []) {
    const text = cleanText(callOut?.text);
    if (text) texts.push(text);
  }
  for (const category of listing?.amenity_categories ?? []) {
    const type = cleanText(category?.type);
    if (type) categories.add(type);
    for (const amenity of category?.amenities ?? []) {
      const text = cleanText(amenity?.text);
      if (text) texts.push(text);
    }
  }
  return { texts, categories };
}

export function unknownFacts(): PropertyFacts {
  return {
    petsAllowed: null,
    maxPets: null,
    amenities: AMENITY_SPECS.reduce(
      (all, spec) => ({ ...all, [spec.key]: null }),
      {} as Record<AmenityKey, FactValue>,
    ),
    amenitiesUnpublished: true,
  };
}

/**
 * Builds the verified fact set for one home.
 * `maxPets` comes from the OwnerRez property record, amenities from its listing.
 */
export function factsFromOwnerRez(
  maxPets: number | null | undefined,
  listing: OwnerRezAmenitySource | null,
): PropertyFacts {
  const { texts, categories } = listingTexts(listing);
  const joined = texts.join(" | ");
  const petsWelcome = /pets welcome|allows pets|pet friendly/i.test(joined);
  const petsDenied = /no pets|pets not allowed/i.test(joined);

  let petsAllowed: FactValue = null;
  if (typeof maxPets === "number") petsAllowed = maxPets > 0 || petsWelcome;
  else if (petsWelcome) petsAllowed = true;
  else if (petsDenied) petsAllowed = false;

  const amenities = AMENITY_SPECS.reduce((all, spec) => {
    const hasEvidence = spec.evidence.some((category) => categories.has(category));
    let value: FactValue = null;
    if (spec.deny?.test(joined)) value = false;
    else if (spec.match.test(joined)) value = true;
    else if (hasEvidence) value = false;
    return { ...all, [spec.key]: value };
  }, {} as Record<AmenityKey, FactValue>);

  return {
    petsAllowed,
    maxPets: typeof maxPets === "number" ? maxPets : null,
    amenities,
    amenitiesUnpublished: texts.length === 0,
  };
}

export type MatchRequirements = {
  /** Number of pets travelling; 0 or undefined means pets are not a requirement. */
  pets?: number | undefined;
  amenities?: AmenityKey[] | undefined;
};

export type MatchOutcome = {
  ok: boolean;
  /** Plain-language reasons the home was filtered out. */
  reasons: string[];
};

export function hasRequirements(requirements: MatchRequirements) {
  return Boolean((requirements.pets ?? 0) > 0 || (requirements.amenities ?? []).length);
}

/**
 * Unverified never passes a filter: if OwnerRez does not publish the answer,
 * the home is held back rather than promised.
 */
export function matchesRequirements(
  facts: PropertyFacts,
  requirements: MatchRequirements,
): MatchOutcome {
  const reasons: string[] = [];
  const pets = requirements.pets ?? 0;
  if (pets > 0) {
    if (facts.petsAllowed === null) reasons.push("Pet policy not published by OwnerRez");
    else if (!facts.petsAllowed) reasons.push("Pets are not allowed");
    else if (facts.maxPets !== null && facts.maxPets > 0 && facts.maxPets < pets)
      reasons.push(`Allows up to ${facts.maxPets} pet${facts.maxPets === 1 ? "" : "s"}`);
  }
  for (const key of requirements.amenities ?? []) {
    const value = facts.amenities[key];
    if (value === null) reasons.push(`${AMENITY_LABELS[key]} not published by OwnerRez`);
    else if (!value) reasons.push(`No ${AMENITY_LABELS[key].toLowerCase()}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Amenity keys a home is confirmed to have, for display chips. */
export function confirmedAmenities(facts: PropertyFacts): AmenityKey[] {
  return AMENITY_SPECS.filter((spec) => facts.amenities[spec.key] === true).map((spec) => spec.key);
}

export function petSummary(facts: PropertyFacts): string {
  if (facts.petsAllowed === null) return "Pet policy not published";
  if (!facts.petsAllowed) return "No pets";
  return facts.maxPets && facts.maxPets > 0 ? `Pets welcome (up to ${facts.maxPets})` : "Pets welcome";
}
