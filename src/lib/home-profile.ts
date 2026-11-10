/**
 * Home Profile: the property page organized like the Notion PID (register P1).
 *
 * One registry of the ten sections, their Notion labels in Notion's order, and
 * where each value lives in Resolve. Every rule the Home Profile tab follows
 * (what shows, what is empty, what search may read, what is missing for
 * handoff, what an edit writes) lives here and is pure so it can be tested.
 *
 * Codes are never read here. A code item only knows which encrypted record it
 * points at; its value is fetched one at a time behind a logged Show.
 */

export type TypedColumn =
  | "nickname"
  | "listing_alias"
  | "neighborhood"
  | "tier"
  | "furniture_package"
  | "bedrooms"
  | "bathrooms"
  | "max_guests"
  | "living_area_sqft"
  | "year_built"
  | "instant_book";

export type JsonColumn =
  | "facts"
  | "parking"
  | "access"
  | "utilities"
  | "hvac"
  | "systems"
  | "fireplace"
  | "storm_shelter"
  | "sprinklers"
  | "grounds"
  | "waste"
  | "pool_spa"
  | "hoa"
  | "amenities"
  | "security"
  | "warranty"
  | "compliance";

export type CodeCategory =
  | "wifi"
  | "gate_community"
  | "property_access"
  | "garage"
  | "lockbox"
  | "streaming"
  | "supply_storage"
  | "alarm_security"
  | "other";

export type SystemField =
  | "address"
  | "market"
  | "gps"
  | "status"
  | "handoff_date"
  | "last_edit"
  | "last_edit_by"
  | "added_by"
  | "added_on";

export type ValueShape = "text" | "boolean" | "list" | "date" | "number";

export type ItemSource =
  | { kind: "column"; column: TypedColumn; shape: ValueShape }
  | { kind: "json"; column: JsonColumn; path: string[]; shape: ValueShape }
  | { kind: "code"; category: CodeCategory; labels: string[]; newLabel: string }
  | { kind: "other_codes" }
  | { kind: "link"; sourceField: string; linkKind: string; editable: boolean }
  | { kind: "photo" }
  | { kind: "system"; field: SystemField }
  | { kind: "relation" };

export type ProfileItem = {
  key: string;
  label: string;
  src: ItemSource;
  /** A photo sits next to this item. */
  photo?: boolean;
  /** Marked required for handoff on the board. */
  required?: boolean;
  /** Placed in this section by judgement (not on the board). */
  judged?: boolean;
};

export type ProfileSection = { id: string; title: string; items: ProfileItem[] };

const col = (column: TypedColumn, shape: ValueShape = "text"): ItemSource => ({ kind: "column", column, shape });
const js = (column: JsonColumn, path: string | string[], shape: ValueShape = "text"): ItemSource => ({
  kind: "json",
  column,
  path: Array.isArray(path) ? path : [path],
  shape,
});
const code = (category: CodeCategory, labels: string[], newLabel: string): ItemSource => ({
  kind: "code",
  category,
  labels: labels.map((l) => l.toLowerCase()),
  newLabel,
});
const link = (sourceField: string, linkKind: string, editable = true): ItemSource => ({
  kind: "link",
  sourceField,
  linkKind,
  editable,
});
const sys = (field: SystemField): ItemSource => ({ kind: "system", field });
const PHOTO: ItemSource = { kind: "photo" };
const REL: ItemSource = { kind: "relation" };

export const HOME_PROFILE_SECTIONS: ProfileSection[] = [
  {
    id: "inspections",
    title: "Home Inspections & Pending Maintenance",
    items: [
      { key: "inspections_executed", label: "Inspections Executed", src: REL },
      { key: "inspection_schedule", label: "Home Inspection Schedule", src: REL },
      { key: "inspection_requests", label: "Inspection Requests", src: REL },
    ],
  },
  {
    id: "overview",
    title: "Quick Overview",
    items: [
      { key: "address", label: "Property Address", src: sys("address") },
      { key: "nickname", label: "Property Nickname", src: col("nickname") },
      { key: "listing_alias", label: "Airbnb Name", src: col("listing_alias") },
      { key: "bedrooms", label: "Bedrooms", src: col("bedrooms", "number") },
      { key: "bathrooms", label: "Bathrooms", src: col("bathrooms", "number") },
      { key: "living_area_sqft", label: "Square Footage", src: col("living_area_sqft", "number") },
      { key: "year_built", label: "Property Built Year", src: col("year_built", "number") },
      { key: "max_guests", label: "Occupancy Limit", src: col("max_guests", "number") },
      { key: "tier", label: "Property Tier", src: col("tier") },
      { key: "parking", label: "Parking", src: js("parking", "summary") },
      { key: "market", label: "Greater Area", src: sys("market") },
      { key: "instant_book", label: "Instant Book On", src: col("instant_book", "boolean"), judged: true },
      { key: "front_photo", label: "Front Photo", src: PHOTO, judged: true },
      { key: "gps", label: "GPS Coordinates", src: sys("gps"), judged: true },
      { key: "status", label: "Status", src: sys("status"), judged: true },
      { key: "handoff_date", label: "Handoff Date", src: sys("handoff_date"), judged: true },
      { key: "or_link", label: "OR Property Link", src: link("OR Property Link", "system", false), judged: true },
      { key: "bw_link", label: "BW Property Link", src: link("BW Property Link", "system", false), judged: true },
    ],
  },
  {
    id: "entry",
    title: "Entry & Access Details",
    items: [
      { key: "lock_brand", label: "Smart Lock Brand", src: js("access", "lock_brand") },
      { key: "access_codes", label: "Access Codes", src: code("property_access", ["Property access code"], "Property access code") },
      { key: "key_storage", label: "Keys in Garage Lockbox", src: js("access", "key_storage", "list") },
      { key: "garage_trim_code", label: "Garage Trim Lockbox Code", src: code("lockbox", ["Garage trim lockbox code"], "Garage trim lockbox code") },
      { key: "garage_keypad_code", label: "Garage Keypad Code", src: code("garage", ["Garage keypad code"], "Garage keypad code") },
      { key: "gate_code", label: "Gate Code", src: code("gate_community", ["Gate / community code"], "Gate / community code") },
      { key: "emergency_key_access", label: "Key Access Hole for Emergencies", src: js("access", "emergency_key_access") },
      { key: "front_door_lock_photo", label: "Photo Front Door Lock System", src: PHOTO },
      { key: "garage_remote", label: "Garage Remote Brand & Model", src: js("access", "garage_remote"), photo: true, required: true },
      { key: "mailbox_number", label: "Mailbox Number", src: js("parking", "mailbox_number") },
      { key: "mailbox_photo", label: "Mailbox Location Photo", src: PHOTO },
      { key: "cluster_mailbox", label: "Cluster Mailbox?", src: js("parking", "cluster_mailbox", "boolean") },
      { key: "cluster_mailbox_location", label: "Cluster Mailbox Location", src: js("parking", "mailbox_location"), judged: true },
      { key: "supply_storage", label: "Storage for Supplies", src: js("systems", "supply_storage"), judged: true },
      { key: "supply_box_location", label: "Closet Supply Box Location", src: js("systems", "supply_box_location") },
      { key: "supply_box_code", label: "Closet Supply Box Code", src: code("supply_storage", ["Closet supply box code"], "Closet supply box code") },
      { key: "storage_closet_code", label: "Storage Closet/Cabinet Code", src: code("supply_storage", ["Storage closet / cabinet code"], "Storage closet / cabinet code"), judged: true },
      { key: "other_codes", label: "Other codes", src: { kind: "other_codes" }, judged: true },
    ],
  },
  {
    id: "home",
    title: "Home Profile",
    items: [
      { key: "fireplace_present", label: "Home Has Fireplace?", src: js("fireplace", "present", "boolean") },
      { key: "fireplace_type", label: "Fireplace Type", src: js("fireplace", "fuel_type") },
      { key: "fireplace_model", label: "Fireplace Brand & Model Number", src: js("fireplace", "model"), required: true },
      { key: "gas_switch", label: "Gas Fireplace Switch", src: js("fireplace", "gas_switch"), judged: true },
      { key: "gas_switch_location", label: "Gas Fireplace Switch Location", src: js("fireplace", "gas_switch_location"), photo: true },
      { key: "fireplace_instructions", label: "Fireplace Instructions", src: js("fireplace", "instructions") },
      { key: "interior_paint", label: "Interior Paint", src: js("facts", "interior_paint") },
      { key: "grill", label: "Home Grill", src: js("facts", "grill") },
      { key: "workstation", label: "Office or Workstation?", src: js("facts", "workstation") },
      { key: "tv_specs", label: "TV Specs", src: js("facts", "tv_specs") },
      { key: "tv_locations", label: "Location of TVs?", src: js("facts", "tv_locations", "list") },
      { key: "furniture_package", label: "Furniture Package", src: col("furniture_package") },
      { key: "furniture_warranty", label: "Furniture Warranty Expiration Date", src: js("warranty", "furniture_expires_on", "date") },
    ],
  },
  {
    id: "setup",
    title: "Onboarding & Setup",
    items: [
      { key: "wifi_ssid", label: "WiFi Network Name", src: js("utilities", "wifi_ssid") },
      { key: "wifi_password", label: "WiFi Password", src: code("wifi", ["Guest WiFi"], "Guest WiFi") },
      { key: "wifi_split", label: "Confirmed Wifi has a split network", src: js("utilities", "wifi_split_confirmed", "boolean") },
      { key: "router_location", label: "Router Location", src: js("utilities", "router_location"), photo: true },
      { key: "yale_module", label: "Yale Smart Module", src: js("access", "yale_module"), photo: true },
      { key: "yale_live", label: "Yale Integration: Live and Connected in Breezeway", src: js("access", "yale_integration_live", "boolean"), judged: true },
      { key: "yale_calibration", label: "Yale is Not Calibrated", src: js("access", "yale_needs_calibration", "boolean"), judged: true },
      { key: "builder_warranty", label: "Builder Warranty?", src: js("warranty", "builder_present", "boolean") },
      { key: "builder_warranty_expires", label: "Builder Warranty Expiration Date", src: js("warranty", "builder_expires_on", "date") },
      { key: "builder_warranty_claim", label: "Builder Warranty Claim Info", src: js("warranty", "claim_process") },
      { key: "furniture_pick_list", label: "Furniture Pick List Link", src: link("Furniture Pick List Link", "legacy_onedrive") },
    ],
  },
  {
    id: "security",
    title: "Security & Monitoring",
    items: [
      { key: "alarm", label: "Alarm", src: js("security", "alarm") },
      { key: "alarm_code", label: "Alarm Code", src: code("alarm_security", ["Alarm code"], "Alarm code"), required: true },
      { key: "security_cameras", label: "Security Cameras", src: js("security", "devices", "list") },
      { key: "camera_battery", label: "Camera Battery Type", src: js("security", "battery_type", "list"), judged: true },
      { key: "camera_feed", label: "Security Camera Feed", src: link("Security Camera Feed", "camera_portal") },
      { key: "monitoring_plan", label: "Cameras Monitoring Plan", src: js("security", "monitoring_plan", "list") },
      { key: "monitoring_expires", label: "Monitoring Plan Exp. Date", src: js("security", "monitoring_expires_on", "date") },
      { key: "smoke_brand", label: "Smoke Detector Brand", src: js("systems", ["smoke", "brand"]) },
      { key: "smoke_notes", label: "Smoke Detector Notes", src: js("systems", ["smoke", "notes"]), judged: true },
      { key: "smoke_expires", label: "Smoke Detector Expiration", src: js("systems", ["smoke", "expires_on"], "date"), judged: true },
      { key: "smoke_power", label: "Smoke Detectors Power Type", src: js("systems", ["smoke", "power_type"]) },
      { key: "smoke_battery", label: "Smoke Detectors Battery Type", src: js("systems", ["smoke", "battery_type"]) },
      { key: "smoke_batteries_changed", label: "Detectors Batteries Change Date", src: js("systems", ["smoke", "batteries_changed_on"], "date") },
      { key: "smoke_model_photo", label: "Smoke Detector Model Number Photo", src: PHOTO, required: true },
      { key: "co_installed", label: "Carbon Monoxide Detector Installed?", src: js("systems", ["co", "installed"], "boolean") },
      { key: "co_location", label: "Location of Carbon Monoxide Detector", src: js("systems", ["co", "location"]) },
    ],
  },
  {
    id: "systems",
    title: "Home Systems & Features",
    items: [
      { key: "breaker_box", label: "Breaker Box Location", src: js("systems", "breaker_panel_location"), photo: true, required: true },
      { key: "water_indoor", label: "Indoor Water Shutoff Location", src: js("systems", "water_shutoff_indoor"), photo: true },
      { key: "water_outdoor", label: "Outdoor Water Shutoff Location", src: js("systems", "water_shutoff_outdoor"), photo: true },
      { key: "sprinkler_brand", label: "Sprinkler System Brand", src: js("sprinklers", "brand") },
      { key: "sprinkler_location", label: "Sprinkler System Location", src: js("sprinklers", "controller_location") },
      { key: "sprinkler_panel_photo", label: "Sprinkler Control Panel Photo", src: PHOTO },
      { key: "sprinkler_status", label: "Sprinkler System Status", src: js("sprinklers", "status") },
      { key: "sprinkler_season", label: "Sprinkler System Set for Season?", src: js("sprinklers", "set_for_season") },
      { key: "fridge_filter_5yr", label: "House has a 5 Year Old Fridge Water Filter", src: js("systems", "fridge_filter_5yr", "boolean") },
      { key: "fridge_filter", label: "Refrigerator Water Filter", src: js("systems", "fridge_filter") },
      { key: "fridge_filter_photos", label: "Photos of Refrigerator Water Filter and Type", src: PHOTO, required: true },
      { key: "storm_shelter", label: "Storm Shelter Location & Access", src: js("storm_shelter", "location_access"), photo: true },
    ],
  },
  {
    id: "pool",
    title: "Pool and Hot Tub",
    items: [
      { key: "pool_present", label: "Backyard Pool / Hot Tub", src: js("pool_spa", "present") },
      { key: "pool_heated", label: "Heated Pool?", src: js("pool_spa", "heated", "boolean") },
      { key: "pool_heater", label: "Pool Heater Details", src: js("pool_spa", "heater") },
      { key: "pool_heater_photo", label: "Photo of Pool Heater", src: PHOTO },
      { key: "pool_season", label: "Backyard Pool Season", src: js("pool_spa", "season") },
      { key: "pool_service", label: "Backyard Pool Service Schedule", src: js("pool_spa", "service_schedule") },
      { key: "hot_tub_panel", label: "Hot Tub Control Panel Location", src: js("pool_spa", "control_panel_location"), photo: true },
      { key: "pool_tech_form", label: "Pool & Hot Tub Technician Form", src: link("Pool & Hot Tub Technician Form", "fillout_form"), judged: true },
    ],
  },
  {
    id: "neighborhood",
    title: "Property, Vendor, and Neighborhood Details",
    items: [
      { key: "neighborhood", label: "Neighborhood Name", src: col("neighborhood") },
      { key: "hoa_present", label: "HOA?", src: js("hoa", "present", "boolean") },
      { key: "hoa_notes", label: "HOA Notes (General)", src: js("hoa", "notes") },
      { key: "covenants", label: "Covenants", src: link("Covenants", "hoa") },
      { key: "amenities", label: "Neighborhood Amenities?", src: js("amenities", "list", "list") },
      { key: "amenities_access", label: "Neighborhood Amenities Access Information", src: js("amenities", "access_notes") },
      {
        key: "pool_fob_code",
        label: "Neighborhood Pool Access Key/Fob",
        src: code("property_access", ["Neighborhood pool access", "Community / pool access code"], "Neighborhood pool access"),
        judged: true,
      },
      { key: "strict_trash", label: "Strict Trash Rules", src: js("waste", "strict_rules") },
      { key: "trash_day", label: "Trash Day", src: js("waste", "trash_days", "list") },
      { key: "recycling_cart", label: "Recycling Cart?", src: js("waste", "recycling", "boolean"), judged: true },
      { key: "recycling_day", label: "Recycling Day", src: js("waste", "recycling_days") },
      { key: "holiday_trash", label: "Holiday Trash Day", src: js("waste", "holiday_notes") },
      { key: "trash_carts", label: "Number of Trash Carts", src: js("waste", "cart_count", "number") },
      { key: "trash_valet", label: "Trash Valet", src: js("waste", "valet", "boolean"), judged: true },
      { key: "mowing", label: "Mowing", src: js("grounds", "mowing_cadence") },
      { key: "mowing_day", label: "Mowing Day", src: js("grounds", "mowing_days", "list") },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance & Upkeep",
    items: [
      { key: "air_filters", label: "Air Filter Sizes", src: js("hvac", "filter_notes") },
      { key: "last_edit", label: "Last Edit", src: sys("last_edit") },
      { key: "last_edit_by", label: "Last Edit By", src: sys("last_edit_by") },
      { key: "added_by", label: "Added By", src: sys("added_by") },
      { key: "added_on", label: "Added On", src: sys("added_on") },
    ],
  },
];

/** Compliance notes from the PID sit on the Documents and Media tab (board: Compliance card). */
export const COMPLIANCE_ITEMS: ProfileItem[] = [
  { key: "rental_restrictions", label: "Rental Restriction Notes", src: js("compliance", ["rental_restrictions", "text"]), judged: true },
  { key: "permit_status", label: "Permit Review Status & Notes", src: js("compliance", ["permit_status", "text"]), judged: true },
];

export const ALL_PROFILE_ITEMS: ProfileItem[] = HOME_PROFILE_SECTIONS.flatMap((s) => s.items);

export function flagsFor(item: ProfileItem) {
  return {
    code: item.src.kind === "code" || item.src.kind === "other_codes",
    link: item.src.kind === "link",
    photo: item.photo === true || item.src.kind === "photo",
    required: item.required === true,
    system: item.src.kind === "system" || item.src.kind === "relation" || (item.src.kind === "link" && !item.src.editable),
  };
}

/* ------------------------------------------------------------------ */
/* Reading values                                                       */

export type CredentialMeta = { id: string; category: string; label: string };
export type PhotoMeta = { id: string; itemKey: string; documentId: string; name: string };
export type LinkMeta = { id: string; sourceField: string | null; label: string; url: string; kind: string };

export type ProfileContext = {
  property: Record<string, unknown>;
  credentials: CredentialMeta[];
  photos: PhotoMeta[];
  links: LinkMeta[];
  system: Partial<Record<SystemField, string | null>>;
};

function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if ("value" in o) return o["value"];
    if ("text" in o) return o["text"];
  }
  return v;
}

/** Plain words for a stored value; null when there is nothing to show. */
export function formatValue(raw: unknown): string | null {
  const v = unwrap(raw);
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  if (Array.isArray(v)) {
    const parts = v.map((x) => formatValue(x)).filter((x): x is string => Boolean(x));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function rawValue(item: ProfileItem, property: Record<string, unknown>): unknown {
  const src = item.src;
  if (src.kind === "column") return property[src.column];
  if (src.kind === "json") {
    let cur: unknown = property[src.column];
    for (const key of src.path) {
      if (!cur || typeof cur !== "object" || Array.isArray(cur)) return null;
      cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
  }
  return null;
}

export function codesFor(item: ProfileItem, ctx: Pick<ProfileContext, "credentials">): CredentialMeta[] {
  const src = item.src;
  if (src.kind === "code") {
    return ctx.credentials.filter(
      (c) => c.category === src.category && src.labels.includes(c.label.trim().toLowerCase()),
    );
  }
  if (src.kind === "other_codes") {
    const claimed = new Set(
      ALL_PROFILE_ITEMS.flatMap((i) => (i.src.kind === "code" ? codesFor(i, ctx).map((c) => c.id) : [])),
    );
    return ctx.credentials.filter((c) => !claimed.has(c.id));
  }
  return [];
}

export function photosFor(item: ProfileItem, ctx: Pick<ProfileContext, "photos">): PhotoMeta[] {
  return ctx.photos.filter((p) => p.itemKey === item.key);
}

export function linkFor(item: ProfileItem, ctx: Pick<ProfileContext, "links">): LinkMeta | null {
  const src = item.src;
  if (src.kind !== "link") return null;
  return ctx.links.find((l) => l.sourceField === src.sourceField) ?? null;
}

/** The text shown for an item. Codes never have text here. */
export function displayValue(item: ProfileItem, ctx: ProfileContext): string | null {
  const src = item.src;
  if (src.kind === "column" || src.kind === "json") return formatValue(rawValue(item, ctx.property));
  if (src.kind === "system") return ctx.system[src.field] ?? null;
  if (src.kind === "link") return linkFor(item, ctx)?.url ?? null;
  return null;
}

/** Does this item hold anything (a value, a code on file, a link or a photo)? */
export function hasContent(item: ProfileItem, ctx: ProfileContext): boolean {
  if (displayValue(item, ctx)) return true;
  if (codesFor(item, ctx).length > 0) return true;
  if (photosFor(item, ctx).length > 0) return true;
  return false;
}

/** Show empty fields off: only items that hold something. */
export function visibleItems(section: ProfileSection, ctx: ProfileContext, showEmpty: boolean): ProfileItem[] {
  return showEmpty ? section.items : section.items.filter((i) => hasContent(i, ctx));
}

/* ------------------------------------------------------------------ */
/* Search                                                               */

export type SearchHit = { sectionId: string; sectionTitle: string; itemKey: string; label: string; snippet: string | null };

/**
 * Searches every field of the home. A code item matches on its label only;
 * its value is never read, so a code can never appear in a result.
 */
export function searchProfile(query: string, ctx: ProfileContext): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const section of HOME_PROFILE_SECTIONS) {
    for (const item of section.items) {
      const f = flagsFor(item);
      const value = f.code ? null : displayValue(item, ctx);
      const photoNames = photosFor(item, ctx).map((p) => p.name);
      const haystack = [item.label, value, ...photoNames].filter(Boolean).join(" ").toLowerCase();
      if (haystack.includes(q)) {
        hits.push({ sectionId: section.id, sectionTitle: section.title, itemKey: item.key, label: item.label, snippet: value });
      }
    }
  }
  return hits;
}

/* ------------------------------------------------------------------ */
/* Required for handoff                                                 */

export const REQUIRED_ITEMS: ProfileItem[] = ALL_PROFILE_ITEMS.filter((i) => i.required);

/** Items marked required for handoff on the board that are still empty. */
export function missingForHandoff(ctx: ProfileContext): { section: ProfileSection; item: ProfileItem }[] {
  const out: { section: ProfileSection; item: ProfileItem }[] = [];
  for (const section of HOME_PROFILE_SECTIONS) {
    for (const item of section.items) {
      if (!item.required) continue;
      const filled =
        item.src.kind === "photo"
          ? photosFor(item, ctx).length > 0
          : item.src.kind === "code"
            ? codesFor(item, ctx).length > 0
            : Boolean(displayValue(item, ctx));
      if (!filled) out.push({ section, item });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Editing                                                              */

export type ProfileChange = {
  key: string;
  label: string;
  target: "column" | "json" | "link" | "code";
  column?: string;
  path?: string[];
  value: unknown;
  link_kind?: string;
};

/** Text shown in the edit box for an item. */
export function editText(item: ProfileItem, ctx: ProfileContext): string {
  const src = item.src;
  if (src.kind === "column" || src.kind === "json") {
    const v = unwrap(rawValue(item, ctx.property));
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (Array.isArray(v)) return v.map((x) => formatValue(x) ?? "").filter(Boolean).join(", ");
    if (typeof v === "object") return "";
    return String(v);
  }
  if (src.kind === "link") return linkFor(item, ctx)?.url ?? "";
  return "";
}

export function isEditable(item: ProfileItem): boolean {
  const src = item.src;
  return src.kind === "column" || src.kind === "json" || (src.kind === "link" && src.editable);
}

function shapeOf(item: ProfileItem, current: unknown): ValueShape {
  const src = item.src;
  if (src.kind !== "column" && src.kind !== "json") return "text";
  const v = unwrap(current);
  if (typeof v === "boolean") return "boolean";
  if (Array.isArray(v)) return "list";
  if (typeof v === "number") return "number";
  return src.shape;
}

/** Turn typed text back into the stored shape. Throws a plain message when it cannot. */
export function parseInput(item: ProfileItem, text: string, current: unknown): unknown {
  const t = text.trim();
  const shape = shapeOf(item, current);
  if (!t) return null;
  if (shape === "boolean") {
    if (/^(yes|y|true)$/i.test(t)) return true;
    if (/^(no|n|false)$/i.test(t)) return false;
    return t;
  }
  if (shape === "list") return t.split(",").map((x) => x.trim()).filter(Boolean);
  if (shape === "number") {
    const n = Number(t.replace(/,/g, ""));
    if (!Number.isFinite(n)) throw new Error(`${item.label} needs a number.`);
    if (item.src.kind === "column" && item.src.column !== "bathrooms" && !Number.isInteger(n))
      throw new Error(`${item.label} needs a whole number.`);
    return n;
  }
  if (shape === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error(`${item.label} needs a date.`);
    return t;
  }
  return t;
}

/** Changes for the items whose text differs from what is stored. */
export function buildChanges(
  section: ProfileSection,
  drafts: Record<string, string>,
  ctx: ProfileContext,
): ProfileChange[] {
  const changes: ProfileChange[] = [];
  for (const item of section.items) {
    if (!isEditable(item) || !(item.key in drafts)) continue;
    const before = editText(item, ctx);
    const after = drafts[item.key] ?? "";
    if (before.trim() === after.trim()) continue;
    const src = item.src;
    if (src.kind === "link") {
      changes.push({ key: item.key, label: item.label, target: "link", value: after.trim() || null, link_kind: src.linkKind });
      continue;
    }
    const current = rawValue(item, ctx.property);
    let value = parseInput(item, after, current);
    // A dated note keeps its shape and records when Resolve changed it.
    if (current && typeof current === "object" && !Array.isArray(current) && "value" in (current as object)) {
      value = { ...(current as Record<string, unknown>), value, as_of: new Date().toISOString(), source: "resolve" };
    }
    if (src.kind === "column") changes.push({ key: item.key, label: item.label, target: "column", column: src.column, value });
    else if (src.kind === "json")
      changes.push({ key: item.key, label: item.label, target: "json", column: src.column, path: src.path, value });
  }
  return changes;
}

export const EDITING_NOTE =
  "You are editing this card. Changes are saved with your name and the time. Codes are visible while you edit, and that is logged.";
