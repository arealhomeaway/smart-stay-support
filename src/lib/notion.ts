/** Browser-safe Notion sync types and source registry. */

export type NotionSourceKind = "properties" | "management" | "plan_types" | "unknown";

export type NotionSource = {
  /** Stable key used in the UI and in integration_events. */
  key: string;
  label: string;
  /** Notion page or database id (dashless). */
  id: string;
  kind: NotionSourceKind;
  blurb: string;
};

/** The onboarding sources ARHA gave us. Ids are dashless Notion ids. */
export const NOTION_SOURCES: NotionSource[] = [
  {
    key: "onboarding_db_1",
    label: "Onboarding Project Database",
    id: "1d84658d5f4f80c39ef0d99f6403220f",
    kind: "properties",
    blurb: "One row per property being onboarded — the master list Resolve mirrors.",
  },
  {
    key: "onboarding_db_2",
    label: "Onboarding Information Database",
    id: "1e84658d5f4f80c1ae25dc905a6458c9",
    kind: "management",
    blurb: "Reference notes for each onboarding element.",
  },
  {
    key: "properties_onboarding_center",
    label: "Properties Onboarding Center",
    id: "2c84658d5f4f80c9ae6dc14b68e7e895",
    kind: "properties",
    blurb: "Property onboarding hub page.",
  },
  {
    key: "onboarding_home_base",
    label: "Onboarding Management Home Base",
    id: "2d94658d5f4f8054971bcf3561bed68e",
    kind: "management",
    blurb: "Stage and owner management view for the onboarding team.",
  },
  {
    key: "onboarding_plan_types",
    label: "ARHA Onboarding Plan Types",
    id: "3a04658d5f4f8019bf32c1154062305f",
    kind: "plan_types",
    blurb: "Plan definitions that decide which checklist a property follows.",
  },
];


export type NotionProbe = {
  key: string;
  label: string;
  id: string;
  kind: NotionSourceKind;
  blurb: string;
  /** "database" | "page" | "missing" | "error" */
  object: string;
  title: string | null;
  /** Property schema when the object is a database. */
  fields: { name: string; type: string }[];
  shared: boolean;
  error: string | null;
};

export type SyncStatusRow = {
  system: string;
  lastSuccessAt: string | null;
  pending: number;
  failed: number;
  conflicts: number;
};
