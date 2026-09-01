/**
 * Property Hub — operational detail grouping (pure, browser-safe).
 *
 * The PID migration landed real ARHA operating information in grouped JSONB
 * columns on `properties`. This module turns those raw structures into the
 * operational sections a staff member actually thinks in ("where is the water
 * shutoff?", "what day is trash?"), with stable ordering, human labels and
 * search keywords.
 *
 * Rules:
 *  - nothing here reads or exposes a credential value; secrets live only in
 *    the encrypted credential vault and its own component.
 *  - every key present in a grouped column is surfaced somewhere; keys that
 *    are not explicitly placed fall through to their owning group, so an
 *    import can never silently hide a field.
 *  - empty values are dropped so an empty section never becomes clutter.
 */

export type PropertyDetailField = {
  key: string;
  label: string;
  value: string;
  /** Lowercased haystack used by the in-property find bar. */
  search: string;
};

export type PropertyDetailGroup = {
  id: string;
  title: string;
  /** Extra words staff might type that do not appear in the values. */
  keywords: string[];
  fields: PropertyDetailField[];
};

type PickSpec = [column: string, key: string, label: string];

type GroupSpec = {
  id: string;
  title: string;
  keywords: string[];
  /** JSONB columns whose remaining keys belong to this group. */
  own?: string[];
  /** Specific keys pulled out of a column (including the flat property row). */
  picks?: PickSpec[];
};

/** The flat `properties` row is addressed with this pseudo-column. */
export const ROW = "property";

export const PROPERTY_DETAIL_GROUPS: GroupSpec[] = [
  {
    id: "arrival_parking",
    title: "Arrival & Parking",
    keywords: ["arrival", "parking", "driveway", "garage", "mailbox", "check in", "check out"],
    own: ["parking"],
    picks: [
      [ROW, "check_in_time", "Check-in time"],
      [ROW, "check_out_time", "Check-out time"],
    ],
  },
  {
    id: "access_security",
    title: "Access & Security",
    keywords: ["access", "gate", "lock", "keypad", "code", "key", "alarm", "camera", "security", "lockbox"],
    own: ["access", "security"],
    picks: [[ROW, "access_notes", "Access notes"]],
  },
  {
    id: "wifi_tech",
    title: "WiFi & Technology",
    keywords: ["wifi", "wi-fi", "internet", "network", "router", "tv", "streaming", "workstation"],
    picks: [
      ["utilities", "wifi_ssid", "Wi-Fi network (SSID)"],
      ["utilities", "router_location", "Router location"],
      ["utilities", "wifi_split_confirmed", "Wi-Fi split confirmed"],
      ["facts", "tv_locations", "TV locations"],
      ["facts", "tv_specs", "TV details"],
      ["facts", "workstation", "Workstation"],
      [ROW, "wifi_notes", "Wi-Fi notes"],
    ],
  },
  {
    id: "hvac",
    title: "HVAC & Filters",
    keywords: ["hvac", "air filter", "furnace", "ac", "air conditioning", "filter", "thermostat"],
    own: ["hvac"],
    picks: [
      ["systems", "fridge_filter", "Refrigerator filter"],
      ["systems", "fridge_filter_5yr", "5-year refrigerator filter"],
    ],
  },
  {
    id: "utilities_shutoffs",
    title: "Utilities & Shutoffs",
    keywords: ["utility", "water shutoff", "shut off", "breaker", "breaker box", "electric", "gas", "panel"],
    own: ["utilities"],
    picks: [
      ["systems", "water_shutoff_indoor", "Water shutoff — indoor"],
      ["systems", "water_shutoff_outdoor", "Water shutoff — outdoor"],
      ["systems", "breaker_panel_location", "Breaker panel location"],
    ],
  },
  {
    id: "safety",
    title: "Safety / Smoke / CO",
    keywords: ["smoke", "detector", "carbon monoxide", "co", "safety", "fire", "storm shelter", "tornado"],
    own: ["storm_shelter"],
    picks: [
      ["systems", "smoke", "Smoke detectors"],
      ["systems", "co", "Carbon monoxide detectors"],
    ],
  },
  {
    id: "fireplace",
    title: "Fireplace",
    keywords: ["fireplace", "gas log", "chimney", "hearth"],
    own: ["fireplace"],
  },
  {
    id: "sprinklers_grounds",
    title: "Sprinklers & Landscaping",
    keywords: ["sprinkler", "irrigation", "mowing", "lawn", "landscaping", "yard", "grounds"],
    own: ["sprinklers", "grounds"],
  },
  {
    id: "waste",
    title: "Trash & Recycling",
    keywords: ["trash", "trash day", "garbage", "recycling", "bin", "cart", "valet"],
    own: ["waste"],
  },
  {
    id: "pool_spa",
    title: "Pool / Hot Tub",
    keywords: ["pool", "hot tub", "spa", "swim", "heater"],
    own: ["pool_spa"],
  },
  {
    id: "hoa",
    title: "HOA & Community Amenities",
    keywords: ["hoa", "community", "amenity", "amenities", "covenant", "permit", "restriction", "compliance"],
    own: ["hoa", "amenities", "compliance"],
  },
  {
    id: "warranty",
    title: "Warranty / Builder",
    keywords: ["warranty", "builder", "claim", "furniture warranty"],
    own: ["warranty"],
  },
  {
    id: "equipment",
    title: "Property Equipment & Supplies",
    keywords: ["supplies", "supply", "grill", "paint", "equipment", "furniture package"],
    picks: [
      ["systems", "supply_storage", "Supply storage"],
      ["systems", "supply_box_location", "Supply box location"],
      ["facts", "grill", "Grill"],
      ["facts", "interior_paint", "Interior paint"],
      [ROW, "furniture_package", "Furniture package"],
    ],
  },
  {
    id: "other_systems",
    title: "Other Systems & Property Facts",
    keywords: ["systems", "facts", "other"],
    own: ["systems", "facts"],
  },
  {
    id: "special_handling",
    title: "Special Handling / Operating Notes",
    keywords: ["special", "handling", "note", "notes", "instruction", "do not"],
    picks: [
      [ROW, "operating_notes", "Operating notes"],
      [ROW, "notes", "Internal notes"],
    ],
  },
];

const LABEL_OVERRIDES: Record<string, string> = {
  ssid: "SSID",
  hoa: "HOA",
  co: "CO",
  tv: "TV",
  hvac: "HVAC",
  arha: "ARHA",
  id: "ID",
  url: "link",
  eo: "EO",
};

/** `water_shutoff_outdoor` → `Water shutoff outdoor`, with known acronyms kept. */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/\+/g, " ")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => LABEL_OVERRIDES[w.toLowerCase()] ?? w);
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/** Import placeholders that carry no information; treated as empty. */
const PLACEHOLDERS = new Set(["not mentioned", "n/a", "na", "none mentioned", "unknown", "tbd", "-", "--"]);

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "" || PLACEHOLDERS.has(v.trim().toLowerCase());
  if (Array.isArray(v)) return v.length === 0 || v.every(isBlank);
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** Presentation of one raw JSON value. Objects are flattened by the caller. */
function formatScalar(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.filter((x) => !isBlank(x)).map((x) => formatScalar(x)).join(", ");
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

const SKIP_SUFFIXES = ["_precision", "_source_text"];

/**
 * Emits one or more display fields from a raw value. Nested objects (smoke,
 * CO) become `Parent — Child` fields so nothing renders as raw JSON.
 * Imprecise dates keep the source text the PID actually recorded.
 */
function fieldsFrom(keyPath: string, label: string, value: unknown, siblings: Record<string, unknown>): PropertyDetailField[] {
  if (isBlank(value)) return [];
  if (SKIP_SUFFIXES.some((s) => keyPath.endsWith(s))) return [];

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return Object.entries(obj).flatMap(([k, v]) => fieldsFrom(`${keyPath}.${k}`, `${label} — ${humanizeKey(k)}`, v, obj));
  }

  const base = keyPath.split(".").pop() ?? keyPath;
  const precision = siblings[`${base}_precision`];
  const sourceText = siblings[`${base}_source_text`];
  let display = formatScalar(value);
  if (typeof precision === "string" && precision !== "day" && typeof sourceText === "string" && sourceText.trim()) {
    display = `${sourceText.trim()} (recorded to the ${precision})`;
  }
  if (!display) return [];
  return [{ key: keyPath, label, value: display, search: `${label} ${display} ${keyPath}`.toLowerCase() }];
}

type RawRow = Record<string, unknown>;

/**
 * Build the operational sections for one property row.
 * `row` is the raw `properties` record; grouped JSONB columns are read as-is.
 */
export function buildPropertyDetailGroups(row: RawRow): PropertyDetailGroup[] {
  const claimed = new Set<string>();
  for (const g of PROPERTY_DETAIL_GROUPS) {
    for (const [col, key] of g.picks ?? []) claimed.add(`${col}.${key}`);
  }

  const groups: PropertyDetailGroup[] = [];
  for (const spec of PROPERTY_DETAIL_GROUPS) {
    const fields: PropertyDetailField[] = [];

    for (const [col, key, label] of spec.picks ?? []) {
      const container = (col === ROW ? row : (row[col] as RawRow | null)) ?? {};
      fields.push(...fieldsFrom(`${col}.${key}`, label, container[key], container));
    }

    for (const col of spec.own ?? []) {
      const container = (row[col] as RawRow | null) ?? {};
      if (typeof container !== "object") continue;
      for (const [key, value] of Object.entries(container)) {
        if (claimed.has(`${col}.${key}`)) continue;
        fields.push(...fieldsFrom(`${col}.${key}`, humanizeKey(key), value, container));
      }
    }

    if (fields.length === 0) continue;
    groups.push({ id: spec.id, title: spec.title, keywords: spec.keywords, fields });
  }
  return groups;
}

/** Words that should take a person to the secure credential component. */
export const CREDENTIAL_SEARCH_TERMS = [
  "wifi password",
  "wi-fi password",
  "gate code",
  "gate",
  "door code",
  "keypad code",
  "lockbox",
  "garage code",
  "alarm code",
  "streaming login",
  "supply storage code",
  "credential",
  "password",
  "code",
];

export function matchesCredentialSearch(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  // Match on a whole credential word ("gate", "wifi password") or on a
  // meaningful prefix of one — never on a stray two-letter overlap.
  return CREDENTIAL_SEARCH_TERMS.some(
    (t) => (t.length >= 4 && q.includes(t)) || (q.length >= 4 && t.startsWith(q)),
  );
}

/**
 * Filter groups for the in-property find bar. A group matches on its own
 * title/keywords (so "pool" keeps the whole Pool section) or on individual
 * fields, in which case only the matching fields remain.
 */
export function filterPropertyDetailGroups(groups: PropertyDetailGroup[], query: string): PropertyDetailGroup[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return groups;
  const out: PropertyDetailGroup[] = [];
  for (const g of groups) {
    const groupHit = g.title.toLowerCase().includes(q) || g.keywords.some((k) => k.includes(q) || (k.length >= 4 && q.includes(k)));
    if (groupHit) {
      out.push(g);
      continue;
    }
    const fields = g.fields.filter((f) => f.search.includes(q));
    if (fields.length > 0) out.push({ ...g, fields });
  }
  return out;
}
