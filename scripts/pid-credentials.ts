/**
 * PID → Resolve credential migration (Guest Access & Credentials).
 *
 * Moves the legitimate operational credentials that were deliberately held
 * back during the main PID import into the encrypted `property_credentials`
 * store, and cleans up the two ways secrets currently sit in ordinary
 * property text:
 *
 *   pass A  narrative fields where the main import left a redaction marker
 *           ("<label>: [removed — credentials are not stored in Resolve]")
 *   pass B  narrative fields where a code was written in plain text and the
 *           importer's pattern did not catch it
 *
 * In both passes the useful narrative survives — only the secret span is
 * replaced, with a pointer to Guest Access & Credentials.
 *
 * Never migrated: owner-held personal streaming accounts, camera account
 * logins, placeholders, and descriptive text that is not a secret.
 * Ambiguous items go to `credential_intake_queue` (encrypted) for review.
 *
 * No credential value is ever printed, logged or written to a report.
 *
 * Usage: bun scripts/pid-credentials.ts [--apply]
 */

import { createClient } from "@supabase/supabase-js";
import { encryptSecret, type CredentialCategory } from "../src/lib/credentials.server";

const APPLY = process.argv.includes("--apply");
const OWENS_OR_ID = "410153";
const POINTER = "See Guest Access & Credentials";
const REDACTION_MARKER = "[removed — credentials are not stored in Resolve]";

const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});

type Json = Record<string, any>;

function orIdOf(row: Json): string | null {
  const raw = plain(row.properties?.["OwnerRez Internal ID"]);
  return raw ? raw.replace(/[^0-9]/g, "") || null : null;
}

function plain(v: any): string | null {
  if (!v) return null;
  if (v.type === "title" || v.type === "rich_text") {
    return v[v.type].map((t: any) => t.plain_text).join("").trim() || null;
  }
  if (v.type === "select") return v.select?.name ?? null;
  if (v.type === "number") return v.number == null ? null : String(v.number);
  return null;
}

const PLACEHOLDER =
  /^(n\/?a\.?|none\.?|no\.?|no code|none needed|not applicable|unknown|tbd|todo|pending|-+|—+|\?+|x+)$/i;

function isPlaceholder(s: string) {
  const t = s.trim();
  return !t || PLACEHOLDER.test(t) || !/[a-z0-9]/i.test(t);
}

/** A value only counts as a secret when it carries a code-like token. */
function looksLikeSecret(s: string, requireDigit: boolean) {
  if (isPlaceholder(s)) return false;
  if (!requireDigit) return true;
  return /\d/.test(s);
}

/* ------------------------------------------------------- dedicated fields */

type FieldRule = {
  field: string;
  category: CredentialCategory;
  label: string;
  usernameField?: string;
  instructionsField?: string;
  /** Descriptive-heavy fields only migrate when a code-like token is present. */
  requireDigit: boolean;
};

const FIELD_RULES: FieldRule[] = [
  {
    field: "WiFi Password",
    category: "wifi",
    label: "Guest WiFi",
    usernameField: "WiFi Network Name",
    requireDigit: false,
  },
  { field: "Gate Code", category: "gate_community", label: "Gate / community code", requireDigit: true },
  { field: "Access Codes", category: "property_access", label: "Property access code", requireDigit: true },
  { field: "Alarm Code", category: "alarm_security", label: "Alarm code", requireDigit: true },
  { field: "Garage Keypad Code", category: "garage", label: "Garage keypad code", requireDigit: true },
  {
    field: "Garage Trim Lockbox Code",
    category: "lockbox",
    label: "Garage trim lockbox code",
    requireDigit: true,
  },
  {
    field: "Closet Supply Box Code",
    category: "supply_storage",
    label: "Closet supply box code",
    instructionsField: "Closet Supply Box Location",
    requireDigit: true,
  },
  {
    field: "Storage Closet/Cabinet Code",
    category: "supply_storage",
    label: "Storage closet / cabinet code",
    instructionsField: "Storage for Supplies",
    requireDigit: true,
  },
  {
    field: "Neighborhood Pool Access Key/Fob",
    category: "property_access",
    label: "Neighborhood pool access",
    requireDigit: true,
  },
];

/** Permanently outside this migration. */
const EXCLUDED_FIELDS = ["Security Camera Feed", "Cameras Monitoring Plan"];

/* ------------------------------------------------------- narrative labels */

function classifyNarrative(
  label: string,
  context: string,
): { category: CredentialCategory; label: string } | "ambiguous" | "exclude" {
  const l = label.toLowerCase();
  const c = context.toLowerCase();

  // Owner-held personal streaming accounts stay with the owner.
  if (/do not share|owner'?s (own|personal)|personal account/.test(c) && /netflix|hulu|disney|prime|roku/.test(c)) {
    return "exclude";
  }
  if (/roku|netflix|hulu|disney|prime video|streaming/.test(c)) {
    return { category: "streaming", label: /roku/.test(c) ? "Roku PIN" : "Streaming profile code" };
  }
  if (/portal|billing|payment|invoice|hoa account|login/.test(c) || /login|credential/.test(l)) {
    // An HOA/billing portal login is not guest-support data — a human decides.
    return "ambiguous";
  }
  if (/pool|amenit|community|clubhouse|gate|registration/.test(c)) {
    return { category: "gate_community", label: "Community / pool access code" };
  }
  if (/storm shelter|garage|door|entry|keypad/.test(c)) {
    return { category: "property_access", label: "Property access code" };
  }
  return "ambiguous";
}

/* ------------------------------------------------------------------ walk */

/** Applies fn to every string leaf of a JSON value, returning a new value. */
function mapStrings(value: any, fn: (s: string) => string): any {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out;
  }
  return value;
}

function collectStrings(value: any, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

const PLAINTEXT_SECRET =
  /\b(pool\s*code|access\s*code|gate\s*code|door\s*code|keypad\s*code|lockbox\s*code|passcode|pass\s*code|password|profile\s*code|roku\s*pin|pin)\b\s*(?:is|are|:|=|-)*\s*([A-Za-z0-9#*]{3,20})\b/gi;

const STOP = new Set([
  "is", "are", "the", "for", "and", "not", "removed", "see", "guest", "available", "listed",
  "below", "above", "same", "none", "with", "code", "pin", "door", "main", "front", "info",
  "will", "use", "using", "from", "when", "stored", "credentials", "provided", "required",
  "needed", "number", "entry", "key", "box", "lock", "set", "can", "you", "staff", "please",
  "also", "they", "there", "their", "this", "that", "each", "via", "all", "any",
]);

/* ------------------------------------------------------------------- main */

const report = {
  mode: APPLY ? "apply" : "dry-run",
  propertiesInScope: 0,
  credentialsCreated: 0,
  credentialsUpdated: 0,
  propertiesWithCredentials: new Set<string>(),
  byCategory: {} as Record<string, number>,
  narrativeSecretsMigrated: 0,
  narrativeFieldsRewritten: 0,
  intakeQueued: 0,
  excluded: {} as Record<string, number>,
  errors: [] as string[],
};

let cameraFieldsSkipped = 0;
const unrecoverable: string[] = [];

function excl(reason: string) {
  report.excluded[reason] = (report.excluded[reason] ?? 0) + 1;
}

async function upsertCredential(input: {
  propertyId: string;
  category: CredentialCategory;
  label: string;
  username?: string | null;
  secret: string;
  instructions?: string | null;
  lastVerifiedOn?: string | null;
}) {
  report.byCategory[input.category] = (report.byCategory[input.category] ?? 0) + 1;
  report.propertiesWithCredentials.add(input.propertyId);
  if (!APPLY) {
    report.credentialsCreated += 1;
    return;
  }
  const { data: existing } = await sb
    .from("property_credentials")
    .select("id")
    .eq("property_id", input.propertyId)
    .eq("source", "notion_pid")
    .eq("label", input.label)
    .maybeSingle();

  const { ciphertext, nonce } = await encryptSecret(input.secret);
  const patch: Json = {
    property_id: input.propertyId,
    category: input.category,
    label: input.label,
    username: input.username ?? null,
    instructions: input.instructions ?? null,
    secret_ciphertext: ciphertext,
    secret_nonce: nonce,
    last_verified_on: input.lastVerifiedOn ?? null,
    source: "notion_pid",
    active: true,
  };

  if (existing?.id) {
    const { error } = await sb.from("property_credentials").update(patch).eq("id", existing.id);
    if (error) report.errors.push(`update ${input.category} on ${input.propertyId}`);
    else report.credentialsUpdated += 1;
  } else {
    const { error } = await sb.from("property_credentials").insert(patch);
    if (error) report.errors.push(`insert ${input.category} on ${input.propertyId}`);
    else report.credentialsCreated += 1;
  }
}

async function queueIntake(propertyId: string, sourceField: string, label: string, secret: string) {
  report.intakeQueued += 1;
  if (!APPLY) return;
  const { data: existing } = await sb
    .from("credential_intake_queue")
    .select("id")
    .eq("property_id", propertyId)
    .eq("source_field", sourceField)
    .eq("status", "pending")
    .maybeSingle();
  if (existing?.id) return;
  const { ciphertext, nonce } = await encryptSecret(secret);
  const { error } = await sb.from("credential_intake_queue").insert({
    property_id: propertyId,
    source_field: sourceField,
    suggested_category: "other",
    suggested_label: label,
    secret_ciphertext: ciphertext,
    secret_nonce: nonce,
    status: "pending",
  });
  if (error) report.errors.push(`intake ${sourceField} on ${propertyId}`);
}

async function main() {
  const pid = JSON.parse(await Bun.file("/tmp/pid/pid.json").text());
  const rows: Json[] = pid.rows;

  const { data: props } = await sb
    .from("properties")
    .select("id, ownerrez_property_id, hoa, amenities, storm_shelter, facts, access, security, access_notes, wifi_notes")
    .eq("is_demo", false)
    .not("ownerrez_property_id", "is", null);

  const byOrId = new Map<string, Json>();
  for (const p of props ?? []) {
    if (p.ownerrez_property_id === OWENS_OR_ID) continue;
    byOrId.set(String(p.ownerrez_property_id), p);
  }

  /* ---------------------------------------- pass 1: dedicated PID fields */

  for (const row of rows) {
    const orId = orIdOf(row);
    if (!orId) continue; // Aziz test row — untouched
    if (orId === OWENS_OR_ID) continue;
    const prop = byOrId.get(String(orId));
    if (!prop) continue;
    report.propertiesInScope += 1;
    const asOf = (row.last_edited_time ?? "").slice(0, 10) || null;

    for (const rule of FIELD_RULES) {
      const raw = plain(row.properties?.[rule.field]);
      if (!raw) {
        excl("blank");
        continue;
      }
      if (isPlaceholder(raw)) {
        excl("placeholder");
        continue;
      }
      if (!looksLikeSecret(raw, rule.requireDigit)) {
        excl("descriptive text, not a secret");
        continue;
      }
      const username = rule.usernameField ? plain(row.properties?.[rule.usernameField]) : null;
      const instructionsRaw = rule.instructionsField
        ? plain(row.properties?.[rule.instructionsField])
        : null;
      const instructions =
        instructionsRaw && !isPlaceholder(instructionsRaw) ? instructionsRaw : null;

      await upsertCredential({
        propertyId: prop.id,
        category: rule.category,
        label: rule.label,
        username: username && !isPlaceholder(username) ? username : null,
        secret: raw,
        instructions,
        lastVerifiedOn: asOf,
      });
    }
    for (const f of EXCLUDED_FIELDS) {
      if (plain(row.properties?.[f])) cameraFieldsSkipped += 1;
    }
  }

  /* ------------------ pass 2: secrets sitting in stored narrative fields */

  const JSON_COLS = ["hoa", "amenities", "storm_shelter", "facts", "access", "security"] as const;
  const TEXT_COLS = ["access_notes", "wifi_notes"] as const;

  for (const [orId, prop] of byOrId) {
    const row = rows.find((r) => orIdOf(r) === orId);
    const asOf = (row?.last_edited_time ?? "").slice(0, 10) || null;
    const pidText = row
      ? Object.entries(row.properties as Json)
          .map(([k, v]) => `${k}: ${plain(v) ?? ""}`)
          .join("\n")
      : "";

    const patch: Json = {};

    const handle = (text: string, sourceField: string): string => {
      let out = text;

      // (a) marker left behind by the main import — recover from PID source
      if (out.includes(REDACTION_MARKER)) {
        const markerRe = new RegExp(
          `([A-Za-z ]{2,20}?):?\\s*${REDACTION_MARKER.replace(/[.*+?^${}()|[\]\\—]/g, "\\$&")}`,
          "g",
        );
        out = out.replace(markerRe, (_m, label: string) => {
          const lbl = label.trim();
          const rx = new RegExp(
            `${lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:is|are|:|=|-)*\\s*([A-Za-z0-9#*]{3,20})`,
            "i",
          );
          let m = rx.exec(pidText);
          let idx = pidText.search(rx);
          if (!m) {
            // The marker sometimes swallowed extra words ("use provided pin");
            // fall back to the trailing keyword of the label.
            const tail = lbl.split(/\s+/).pop() ?? lbl;
            const rx2 = new RegExp(
              `\\b${tail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s*(?:is|are|:|=|-)*\\s*([A-Za-z0-9#*]{3,20})`,
              "i",
            );
            m = rx2.exec(pidText);
            idx = pidText.search(rx2);
          }
          const context = idx >= 0 ? pidText.slice(Math.max(0, idx - 200), idx + 200) : "";
          if (!m) {
            // No secret exists in the source — the import's pattern fired on
            // ordinary prose ("use provided pin to depress button"). Restore
            // the sentence rather than pointing staff at a credential.
            excl("false-positive redaction restored (no secret in source)");
            unrecoverable.push(`${sourceField} / ${lbl}`);
            const line = pidText
              .split("\n")
              .find((ln) => ln.toLowerCase().includes(lbl.toLowerCase()));
            if (line) {
              const at = line.toLowerCase().indexOf(lbl.toLowerCase());
              return line.slice(at).trim();
            }
            return lbl;
          }
          const decision = classifyNarrative(lbl, context);
          if (decision === "exclude") {
            excl("owner-held personal streaming credential");
            return `${lbl}: held by the owner — not stored in Resolve`;
          }
          if (decision === "ambiguous") {
            void queueIntake(prop.id, sourceField, lbl, m[1]!);
            return `${lbl}: ${POINTER}`;
          }
          report.narrativeSecretsMigrated += 1;
          void upsertCredential({
            propertyId: prop.id,
            category: decision.category,
            label: decision.label,
            secret: m[1]!,
            instructions: `Migrated from the property's ${sourceField} notes.`,
            lastVerifiedOn: asOf,
          });
          return `${lbl}: ${POINTER}`;
        });
      }

      // (b) code still sitting in plain text
      out = out.replace(PLAINTEXT_SECRET, (whole, label: string, token: string) => {
        if (STOP.has(token.toLowerCase()) || !/\d/.test(token)) return whole;
        if (whole.includes(POINTER)) return whole;
        const context = out.slice(0, 400);
        const decision = classifyNarrative(label, `${label} ${context}`);
        if (decision === "exclude") {
          excl("owner-held personal streaming credential");
          return `${label}: held by the owner — not stored in Resolve`;
        }
        if (decision === "ambiguous") {
          void queueIntake(prop.id, sourceField, label, token);
          return `${label}: ${POINTER}`;
        }
        report.narrativeSecretsMigrated += 1;
        void upsertCredential({
          propertyId: prop.id,
          category: decision.category,
          label: decision.label,
          secret: token,
          instructions: `Migrated from the property's ${sourceField} notes.`,
          lastVerifiedOn: asOf,
        });
        return `${label}: ${POINTER}`;
      });

      return out;
    };

    for (const col of JSON_COLS) {
      const value = (prop as Json)[col];
      if (!value) continue;
      const before = JSON.stringify(value);
      const next = mapStrings(value, (s) =>
        s.includes(REDACTION_MARKER) || PLAINTEXT_SECRET.test(s) ? handle(s, col) : s,
      );
      PLAINTEXT_SECRET.lastIndex = 0;
      if (JSON.stringify(next) !== before) {
        patch[col] = next;
        report.narrativeFieldsRewritten += 1;
      }
    }
    for (const col of TEXT_COLS) {
      const value = (prop as Json)[col];
      if (typeof value !== "string" || !value) continue;
      PLAINTEXT_SECRET.lastIndex = 0;
      const next = handle(value, col);
      if (next !== value) {
        patch[col] = next;
        report.narrativeFieldsRewritten += 1;
      }
    }

    if (APPLY && Object.keys(patch).length) {
      const { error } = await sb.from("properties").update(patch).eq("id", prop.id);
      if (error) report.errors.push(`narrative rewrite on ${prop.id}`);
    }
  }

  /* ------------------------------------------------------------ verify */

  const leftovers = collectStrings(
    (
      await sb
        .from("properties")
        .select("hoa, amenities, storm_shelter, facts, access, security, access_notes, wifi_notes, notes, operating_notes")
    ).data ?? [],
  ).filter((s) => {
    PLAINTEXT_SECRET.lastIndex = 0;
    if (s.includes(POINTER)) return false;
    let m: RegExpExecArray | null;
    while ((m = PLAINTEXT_SECRET.exec(s))) {
      const tok = m[2]!.toLowerCase();
      if (!STOP.has(tok) && /\d/.test(tok)) return true;
    }
    return false;
  }).length;

  console.log(
    JSON.stringify(
      {
        ...report,
        propertiesWithCredentials: report.propertiesWithCredentials.size,
        cameraFieldsSkipped,
        unrecoverable,
        plaintextSecretsRemainingInPropertyFields: leftovers,
      },
      null,
      2,
    ),
  );
}

await main();
