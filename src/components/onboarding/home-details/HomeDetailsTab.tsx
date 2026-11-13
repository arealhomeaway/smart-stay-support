/**
 * Property page Part 3 (3.1): the Home details tab. A left menu of sections with a search box;
 * one section shows on the right. Each field is one row (label, value, Edit) that edits in
 * place with Save and Cancel, and shows "Changed by <name> · <date>" once saved. Empty values
 * read Not set or Not assigned in red. View-only viewers see no Edit buttons. Codes stay
 * behind the logged Show and are never searched by value. Rules: src/lib/home-details.ts.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Lock, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeValues, useProfileContext, type HomeProfileData } from "@/components/property/HomeProfileTab";
import { CorrectCommittedDate, SetOnceButton } from "@/components/onboarding/board/HomeBoard";
import { getPropertyHubFn } from "@/lib/property-hub.functions";
import { readProjectTeam, setProjectRoleAssignee, setProjectStagingProvider } from "@/lib/onboarding-team.functions";
import { setProjectStagersFn } from "@/lib/onboarding-home.functions";
import { saveCredentialFn } from "@/lib/credentials.functions";
import { homeDetailsHistoryFn, saveHomeDetailFn } from "@/lib/home-details.functions";
import { readPropertyOwnerFn } from "@/lib/owner-link.functions";
import { ownerRow } from "@/lib/onboarding-home-page";
import {
  HOME_PROFILE_SECTIONS,
  buildChanges,
  codesFor,
  displayValue,
  editText,
  flagsFor,
  isEditable,
  linkFor,
  type CodeCategory,
  type ProfileItem,
} from "@/lib/home-profile";
import { NOTION_STATUSES, OWNER_TYPES, PMA_STATUSES, pmaSteps, shortDate } from "@/lib/onboarding-board";
import { stateChip } from "@/lib/semantic";
import { Chip } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import {
  DETAIL_SECTIONS,
  LOA_STATUSES,
  canEditDetail,
  changeNote,
  changedLine,
  detailsViewOnly,
  emptyText,
  isEmptyValue,
  searchDetailRows,
  telegramProblem,
  type DetailChange,
  type DetailRow,
  type DetailSection,
  type DetailsViewer,
} from "@/lib/home-details";


type Option = { value: string; label: string };
type Editor =
  | { kind: "choice"; options: Option[]; save: (v: string | null) => Promise<unknown> }
  | { kind: "text" | "link" | "date"; save: (v: string | null) => Promise<unknown>; check?: (v: string) => string | null }
  | { kind: "multi"; options: Option[]; current: string[]; save: (v: string[]) => Promise<unknown> }
  | { kind: "code"; save: (v: string) => Promise<unknown> }
  | { kind: "custom"; render: (close: () => void) => ReactNode };

type Row = DetailRow & {
  /** The current value as the editor starts it. */
  raw?: string | null;
  editor?: Editor | null;
  change?: DetailChange | null;
  /** Shown instead of the text value (links, codes). */
  view?: ReactNode;
};

export type HomeDetailsProps = {
  propertyId: string;
  section: DetailSection;
  onSection: (s: DetailSection) => void;
  viewer: DetailsViewer;
  canSetStatus: boolean;
  project: {
    id: string | null;
    owner_type: string | null;
    project_status: string | null;
    greater_area: string | null;
    pma_status: string | null;
    furnishing_scope: string | null;
    possession_on: string | null;
    target_handoff_on: string | null;
    committed_handoff_on: string | null;
    inspection_on: string | null;
    telegram_url?: string | null;
    loa_status?: string | null;
    external_refs: Record<string, string>;
    scopeLabel: string;
  };
  dates: { plannedClosingOn: string | null; actualClosingOn: string | null; actualAccessOn: string | null };
  owner: { ownerRezId: string | null; activeOwner: boolean };
  lifecycle: { value: string; label: string; options: Option[]; canEdit: boolean; save: (v: string) => void };
  /** Existing tools that stay with their section, shown under its rows. */
  extras: Partial<Record<DetailSection, ReactNode>>;
  /** Shown when the closing or access date row's Edit opens the existing milestone tool. */
  schedule: ReactNode;
};

const NONE = "__none";

/** Home Profile items that belong to Utilities and systems and to HOA and compliance. */
const UTILITY_KEYS = new Set([
  "wifi_ssid", "wifi_password", "wifi_split", "router_location", "yale_module", "yale_live", "yale_calibration",
  "lock_brand", "access_codes", "garage_trim_code", "garage_keypad_code", "gate_code", "emergency_key_access", "garage_remote",
  "supply_box_code", "storage_closet_code", "other_codes", "alarm", "alarm_code",
  "breaker_box", "water_indoor", "water_outdoor", "sprinkler_brand", "sprinkler_location", "sprinkler_status", "sprinkler_season", "storm_shelter",
]);
const HOA_KEYS = new Set([
  "hoa_present", "hoa_notes", "covenants", "amenities", "amenities_access", "pool_fob_code",
  "rental_restrictions", "permit_status", "builder_warranty", "builder_warranty_expires", "builder_warranty_claim",
]);

export function HomeDetailsTab(p: HomeDetailsProps) {
  const { propertyId, viewer } = p;
  const qc = useQueryClient();
  const viewOnly = detailsViewOnly(viewer);
  const hubFn = useServerFn(getPropertyHubFn);
  const hub = useQuery({ queryKey: ["property-hub", propertyId], queryFn: () => hubFn({ data: { propertyId } }), retry: false });
  const profile = ((hub.data as { profile?: HomeProfileData } | undefined)?.profile ?? null) as HomeProfileData | null;
  const { ctx, canManageCodes } = useProfileContext(propertyId, profile);
  // The owner of record, read the same way as the header (people split from the legal owner).
  const ownerFn = useServerFn(readPropertyOwnerFn);
  const ownerQ = useQuery({ queryKey: ["property-owner", propertyId], queryFn: () => ownerFn({ data: { propertyId } }) });
  const ownerRec = ownerQ.data?.owner ?? null;
  const ownerLine = ownerRec
    ? ownerRow({ people: ownerRec.people ?? [], legal: ownerRec.name, phone: ownerRec.phone, email: ownerRec.email, telegram: ownerRec.telegram, preferred: ownerRec.preferredMethod })
    : null;
  const historyFn = useServerFn(homeDetailsHistoryFn);
  const history = useQuery({ queryKey: ["home-details-history", propertyId], queryFn: () => historyFn({ data: { propertyId } }), retry: false });
  const teamFn = useServerFn(readProjectTeam);
  const team = useQuery({ queryKey: ["project-team", propertyId], queryFn: () => teamFn({ data: { propertyId } }), retry: false });
  const stagers = useQuery({
    queryKey: ["home-details-stagers", p.project.id],
    enabled: Boolean(p.project.id),
    queryFn: async () => {
      const [linked, pool] = await Promise.all([
        supabase.from("onboarding_project_stagers" as never).select("vendor_org_id, added_at").eq("project_id" as never, p.project.id as never).is("removed_at" as never, null),
        supabase.from("vendor_orgs").select("id, display_name, legal_name").contains("service_categories", ["Staging"]).order("display_name"),
      ]);
      return {
        linked: ((linked.data ?? []) as unknown as { vendor_org_id: string }[]).map((r) => r.vendor_org_id),
        pool: ((pool.data ?? []) as { id: string; display_name: string | null; legal_name: string | null }[]).map((v) => ({ value: v.id, label: v.display_name || v.legal_name || "Vendor" })),
      };
    },
  });
  const pid = useQuery({
    queryKey: ["pid-extra-fields", propertyId, "details"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { order: (c: string) => Promise<{ data: unknown; error: unknown }> } } } })
        .from("property_pid_extra_fields").select("field_name, value, synced_on").eq("property_id", propertyId).order("field_name");
      if (error) return [];
      return (data ?? []) as { field_name: string; value: PidValue; synced_on: string }[];
    },
  });

  const save = useServerFn(saveHomeDetailFn);
  const setRole = useServerFn(setProjectRoleAssignee);
  const setProvider = useServerFn(setProjectStagingProvider);
  const setStagers = useServerFn(setProjectStagersFn);
  const saveCode = useServerFn(saveCredentialFn);
  const refreshAll = () => {
    for (const k of [["onboarding-workspace"], ["onboarding-project"], ["property-hub", propertyId], ["property-credentials", propertyId], ["home-details-history", propertyId], ["project-team", propertyId], ["home-details-stagers", p.project.id], ["project-stagers", p.project.id]])
      void qc.invalidateQueries({ queryKey: k });
  };

  const noteChange = (label: string): DetailChange | null => history.data?.byNote[changeNote(label)] ?? null;
  const itemChange = (key: string): DetailChange | null => history.data?.byItem[key] ?? null;
  const can = (kind: Parameters<typeof canEditDetail>[1], role?: string) => !viewOnly && canEditDetail(viewer, kind, role);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const pr = p.project;
    const opts = (list: readonly string[]): Option[] => list.map((v) => ({ value: v, label: v }));
    const choice = (id: string, label: string, field: "owner_type" | "project_status" | "pma_status" | "greater_area", value: string | null, options: Option[] | null, editable: boolean): Row => ({
      id, section: "project", label, value, raw: value, change: noteChange(label),
      editor: editable
        ? options
          ? { kind: "choice", options, save: (v) => save({ data: { target: "choice", propertyId, field, value: v } }) }
          : { kind: "text", save: (v) => save({ data: { target: "choice", propertyId, field, value: v } }) }
        : null,
    });
    const ref = (id: string, section: "project" | "hoa", label: string, key: "zillow_url" | "property_folder" | "purchase_agreement" | "verified_address" | "builder" | "ccrs_reviewed_on" | "ccrs_note", kind: "text" | "link" | "date"): Row => {
      const v = pr.external_refs[key] ?? null;
      return {
        id, section, label, value: v, raw: v, change: noteChange(label),
        view: kind === "link" && v && /^https?:\/\//i.test(v) ? <a href={v} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 break-all text-primary underline-offset-4 hover:underline">Open <ExternalLink className="size-3.5" aria-hidden="true" /></a> : kind === "date" && v ? shortDate(v) : undefined,
        editor: can(section === "hoa" ? "hoa" : "project") ? { kind, save: (val) => save({ data: { target: "ref", propertyId, key, label, section, value: val } }) } : null,
      };
    };

    // Project
    out.push(choice("owner_type", "Owner Type", "owner_type", pr.owner_type, opts(OWNER_TYPES), can("project")));
    out.push(choice("project_status", "Status", "project_status", pr.project_status, opts(NOTION_STATUSES), can("project") && p.canSetStatus));
    out.push(choice("greater_area", "Greater Area", "greater_area", pr.greater_area, null, can("project")));
    out.push({ id: "scope", section: "project", label: "Scope", value: pr.scopeLabel, change: noteChange("Scope"), editor: null });
    out.push({
      id: "lifecycle", section: "project", label: "Lifecycle", value: p.lifecycle.label, raw: p.lifecycle.value,
      editor: p.lifecycle.canEdit && can("project") ? { kind: "choice", options: p.lifecycle.options, save: async (v) => { if (v) p.lifecycle.save(v); } } : null,
    });
    out.push(choice("pma_status", "PMA status", "pma_status", pr.pma_status, opts(PMA_STATUSES), can("project")));
    out.push({
      id: "loa_status", section: "project", label: "LOA status",
      value: LOA_STATUSES.find((s) => s.value === pr.loa_status)?.label ?? null, raw: pr.loa_status ?? null, change: noteChange("LOA status"),
      editor: can("project") ? { kind: "choice", options: LOA_STATUSES.map((s) => ({ value: s.value, label: s.label })), save: (v) => save({ data: { target: "staged", propertyId, field: "loa_status", value: v } }) } : null,
    });
    out.push({
      id: "telegram_url", section: "project", label: "Telegram group", value: pr.telegram_url ?? null, raw: pr.telegram_url ?? null, change: noteChange("Telegram group"),
      view: pr.telegram_url ? <a href={pr.telegram_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline">Open the group <ExternalLink className="size-3.5" aria-hidden="true" /></a> : undefined,
      editor: can("project") ? { kind: "link", check: telegramProblem, save: (v) => save({ data: { target: "staged", propertyId, field: "telegram_url", value: v } }) } : null,
    });
    out.push(ref("property_folder", "project", "Home folder in SharePoint", "property_folder", "link"));
    out.push(ref("zillow_url", "project", "Zillow link", "zillow_url", "link"));
    out.push(ref("purchase_agreement", "project", "Purchase agreement", "purchase_agreement", "link"));
    out.push(ref("verified_address", "project", "Verified address", "verified_address", "text"));

    // Dates
    const scheduleEditor: Editor | null = can("dates") ? { kind: "custom", render: () => p.schedule } : null;
    out.push({ id: "planned_closing", section: "dates", label: "Planned closing", value: p.dates.plannedClosingOn ? shortDate(p.dates.plannedClosingOn) : null, editor: scheduleEditor });
    out.push({ id: "actual_closing", section: "dates", label: "Actual closing", value: p.dates.actualClosingOn ? shortDate(p.dates.actualClosingOn) : null, editor: scheduleEditor });
    out.push({ id: "actual_access", section: "dates", label: "Access to the home", value: p.dates.actualAccessOn ? shortDate(p.dates.actualAccessOn) : null, editor: scheduleEditor });
    const date = (id: string, label: string, field: "possessionOn" | "targetHandoffOn" | "inspectionOn", v: string | null, section: DetailSection = "dates"): Row => ({
      id, section, label, value: v ? shortDate(v) : null, raw: v, change: noteChange(label),
      editor: can("dates") ? { kind: "date", save: (val) => save({ data: { target: "date", propertyId, field, label, value: val } }) } : null,
    });
    out.push(date("possession", "Possession", "possessionOn", pr.possession_on));
    out.push(date("target_handoff", "Estimated handoff", "targetHandoffOn", pr.target_handoff_on));
    out.push({
      id: "committed_handoff", section: "dates", label: "Committed handoff", value: pr.committed_handoff_on ? shortDate(pr.committed_handoff_on) : null,
      change: noteChange("Committed Handoff Date"),
      view: pr.committed_handoff_on ? (
        <span className="inline-flex items-center gap-1 font-medium"><Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />{shortDate(pr.committed_handoff_on)}</span>
      ) : undefined,
      editor: pr.committed_handoff_on
        ? can("committed_correct") ? { kind: "custom", render: () => <CorrectCommittedDate projectId={pr.id} current={pr.committed_handoff_on!} /> } : null
        : can("committed_set") ? { kind: "custom", render: (close) => <CommittedSetOnce onSet={async (d) => { await save({ data: { target: "committed", propertyId, value: d } }); close(); refreshAll(); }} /> } : null,
    });

    // Team
    for (const r of team.data?.roles ?? []) {
      const assignee = r.pool.find((x) => x.id === r.assignee);
      out.push({
        id: `role:${r.code}`, section: "team", label: r.name, person: true,
        value: r.assignee ? assignee?.full_name || assignee?.email || "Teammate" : null, raw: r.assignee,
        editor: team.data?.canEdit && can("team_role", r.code)
          ? { kind: "choice", options: r.pool.map((x) => ({ value: x.id, label: x.full_name || x.email || "Teammate" })), save: (v) => setRole({ data: { projectId: team.data!.projectId, roleCode: r.code, userId: v, reassignPending: false } }) }
          : null,
      });
    }
    const stagerNames = (stagers.data?.linked ?? []).map((id) => stagers.data?.pool.find((o) => o.value === id)?.label ?? "Vendor");
    out.push({
      id: "stagers", section: "team", label: "Stagers", person: true, value: stagerNames.length ? stagerNames.join(", ") : null, change: noteChange("Stager"),
      editor: can("stagers") && p.project.id
        ? { kind: "multi", options: stagers.data?.pool ?? [], current: stagers.data?.linked ?? [], save: (ids) => setStagers({ data: { projectId: p.project.id!, vendorIds: ids } }) }
        : null,
    });
    if (team.data) {
      out.push({
        id: "staging_provider", section: "team", label: "Staging provider (outside)", value: team.data.stagingProvider, raw: team.data.stagingProvider,
        editor: team.data.canEdit && can("team_role") ? { kind: "text", save: (v) => setProvider({ data: { projectId: team.data!.projectId, provider: v } }) } : null,
      });
    }

    // Owner record
    out.push({ id: "legal_owner", section: "owner", label: "Legal owner", value: ownerLine?.legal || ownerRec?.name || null });
    out.push({ id: "owner_people", section: "owner", label: "People", value: ownerLine?.names || null, person: true });
    out.push({ id: "owner_phone", section: "owner", label: "Phone", value: ownerRec?.phone ?? null });
    out.push({ id: "owner_email", section: "owner", label: "Email", value: ownerRec?.email ?? null });
    out.push({ id: "owner_program", section: "owner", label: "Program", value: p.owner.activeOwner ? "Active Owner" : "Standard" });
    out.push({ id: "ownerrez_id", section: "owner", label: "OwnerRez property", value: p.owner.ownerRezId });

    // Utilities and systems, HOA and compliance (Home Profile items, same history as Operations)
    for (const sec of HOME_PROFILE_SECTIONS) {
      for (const item of sec.items) {
        const target: DetailSection | null = UTILITY_KEYS.has(item.key) ? "utilities" : HOA_KEYS.has(item.key) ? "hoa" : null;
        if (!target || item.src.kind === "photo") continue;
        out.push(profileRow(item, sec.title, target));
      }
    }
    out.push(ref("builder", "hoa", "Builder", "builder", "text"));
    out.push(ref("ccrs_reviewed_on", "hoa", "CC&Rs reviewed", "ccrs_reviewed_on", "date"));
    out.push(ref("ccrs_note", "hoa", "CC&Rs note", "ccrs_note", "text"));

    // Inspections
    out.push(date("inspection_on", "Inspection date", "inspectionOn", pr.inspection_on, "inspections"));

    // From the PID
    for (const f of pid.data ?? []) {
      out.push({ id: `pid:${f.field_name}`, section: "pid", label: f.field_name, value: pidText(f.field_name, f.value), view: pidView(f.field_name, f.value) });
    }
    return out;

    function profileRow(item: ProfileItem, card: string, section: DetailSection): Row {
      const f = flagsFor(item);
      const kind = section === "hoa" ? "hoa" : "utilities";
      if (f.code) {
        const codes = codesFor(item, ctx);
        const single = item.src.kind === "code" && codes.length <= 1;
        return {
          id: `hp:${item.key}`, section, label: item.label, secret: true, value: codes.length ? "Saved" : null, change: itemChange(item.key),
          view: codes.length ? <CodeValues item={item} codes={codes} editing={false} canManageCodes={canManageCodes} codeDrafts={{}} onCodeDraft={() => {}} /> : undefined,
          editor: single && canManageCodes && can(kind)
            ? {
                kind: "code",
                save: async (secret) => {
                  const src = item.src as Extract<ProfileItem["src"], { kind: "code" }>;
                  await saveCode({ data: { id: codes[0]?.id, propertyId, category: src.category as CodeCategory, label: codes[0]?.label ?? src.newLabel, secret } });
                  await save({ data: { target: "profile", propertyId, section: kind, card, changes: [{ key: item.key, label: item.label, target: "code", value: null }] } });
                },
              }
            : null,
        };
      }
      const link = linkFor(item, ctx);
      const value = f.link ? link?.url ?? null : displayValue(item, ctx);
      return {
        id: `hp:${item.key}`, section, label: item.label, value, raw: isEditable(item) ? editText(item, ctx) : value, change: itemChange(item.key),
        view: f.link && link ? <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline">Open <ExternalLink className="size-3.5" aria-hidden="true" /></a> : undefined,
        editor: isEditable(item) && can(kind)
          ? {
              kind: item.src.kind === "link" ? "link" : "text",
              save: async (v) => {
                const changes = buildChanges({ id: "one", title: card, items: [item] }, { [item.key]: v ?? "" }, ctx);
                if (!changes.length) return;
                await save({ data: { target: "profile", propertyId, section: kind, card, changes: changes as never } });
              },
            }
          : null,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.project, p.dates, p.owner, ownerRec, ownerLine?.names, ownerLine?.legal, p.lifecycle, p.canSetStatus, team.data, stagers.data, pid.data, ctx, canManageCodes, history.data, viewer, viewOnly]);

  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const hits = useMemo(() => searchDetailRows(rows, query), [rows, query]);
  const jump = (rowId: string, section: DetailSection) => {
    p.onSection(section);
    setFocus(rowId);
    setQuery("");
    window.setTimeout(() => document.getElementById(`hd-row-${rowId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };
  useEffect(() => {
    if (!focus) return;
    const t = window.setTimeout(() => setFocus(null), 4000);
    return () => window.clearTimeout(t);
  }, [focus]);

  const shown = rows.filter((r) => r.section === p.section);
  const title = DETAIL_SECTIONS.find((s) => s.id === p.section)?.title ?? "";

  return (
    <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
      <nav aria-label="Home details sections" className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="min-h-11 pl-9" aria-label="Find a field" placeholder="Find a field" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query.trim().length >= 2 ? (
          <div className="surface max-h-80 overflow-y-auto p-1" aria-label="Fields found">
            {hits.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Nothing matches.</p>
            ) : (
              <ul>
                {hits.slice(0, 30).map((h) => (
                  <li key={h.rowId}>
                    <button type="button" className="flex min-h-11 w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => jump(h.rowId, h.section)}>
                      <span className="text-sm font-medium">{h.label}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {DETAIL_SECTIONS.find((s) => s.id === h.section)?.title}
                        {h.snippet ? ` · ${h.snippet}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {/* Phone: a dropdown; wider screens: the menu. */}
        <div className="md:hidden">
          <Select value={p.section} onValueChange={(v) => p.onSection(v as DetailSection)}>
            <SelectTrigger className="min-h-11" aria-label="Section"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DETAIL_SECTIONS.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ul className="hidden space-y-0.5 md:block">
          {DETAIL_SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={p.section === s.id ? "page" : undefined}
                onClick={() => p.onSection(s.id)}
                className={cn("flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm", p.section === s.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section id={`home-details-${p.section}`} aria-label={title} className="min-w-0 space-y-4">
        <h2 className="font-display text-xl">{title}</h2>
        {viewOnly ? <p className="text-sm text-muted-foreground">View only. This home's team keeps these up to date.</p> : null}
        {p.section === "operations" ? (
          <div className="surface space-y-2 p-4">
            <p className="text-sm">This home's Operations view keeps the full home profile, tickets and guest work.</p>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/property/$propertyId" params={{ propertyId }}>Open the Operations view</Link>
            </Button>
          </div>
        ) : shown.length === 0 && !p.extras[p.section] ? (
          <p className="surface p-4 text-sm text-muted-foreground">{p.section === "pid" ? "Nothing from the PID for this home yet." : "Nothing here yet."}</p>
        ) : shown.length > 0 ? (
          <dl className="surface divide-y divide-border">
            {shown.map((r) => (
              <DetailRowView key={r.id} row={r} focused={focus === r.id} onSaved={refreshAll} />
            ))}
          </dl>
        ) : null}
        {p.section === "project" && p.project.pma_status !== undefined ? <PmaSteps status={p.project.pma_status} /> : null}
        {p.extras[p.section] ?? null}
      </section>
    </div>
  );
}

function PmaSteps({ status }: { status: string | null }) {
  const steps = pmaSteps(status);
  return (
    <details className="surface">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">PMA steps</summary>
      <ol className="divide-y divide-border border-t border-border" aria-label="PMA Status steps">
        {steps.map((s) => (
          <li key={s.label} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm">
            <span>{s.label}</span>
            <Chip className={stateChip(s.state === "Done" ? "done" : s.state === "Next" ? "active" : "info")}>{s.state}</Chip>
          </li>
        ))}
      </ol>
    </details>
  );
}

function CommittedSetOnce({ onSet }: { onSet: (d: string) => Promise<void> }) {
  const [d, setD] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" value={d} onChange={(e) => setD(e.target.value)} className="h-11 w-44" aria-label="Committed handoff" />
      <SetOnceButton
        disabled={!d || busy}
        onConfirm={() => {
          setBusy(true);
          onSet(d).catch((e: Error) => toast.error(e.message)).finally(() => setBusy(false));
        }}
      />
    </div>
  );
}

function DetailRowView({ row, focused, onSaved }: { row: Row; focused: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [multi, setMulti] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const ed = row.editor ?? null;
  const m = useMutation({
    mutationFn: async () => {
      if (!ed) return;
      if (ed.kind === "multi") return ed.save(multi);
      if (ed.kind === "code") {
        if (!draft.trim()) throw new Error("Type the code first.");
        return ed.save(draft.trim());
      }
      if (ed.kind === "custom") return;
      const v = draft.trim() || null;
      if (ed.kind !== "choice" && ed.check && v) {
        const bad = ed.check(v);
        if (bad) throw new Error(bad);
      }
      return ed.save(v === NONE ? null : v);
    },
    onSuccess: () => {
      setEditing(false);
      toast.success("Saved.");
      onSaved();
    },
    onError: (e: Error) => setProblem(e.message),
  });
  const start = () => {
    setProblem(null);
    setDraft(ed?.kind === "code" ? "" : row.raw ?? (ed?.kind === "choice" ? NONE : ""));
    if (ed?.kind === "multi") setMulti(ed.current);
    setEditing(true);
  };
  const empty = isEmptyValue(row.value);
  const line = changedLine(row.change);
  return (
    <div id={`hd-row-${row.id}`} className={cn("grid scroll-mt-24 gap-1 px-4 py-2 sm:grid-cols-[minmax(9rem,14rem)_1fr_auto] sm:items-start sm:gap-4", focused && "bg-primary/10")}>
      <dt className="pt-2.5 text-sm font-medium">{row.label}</dt>
      <dd className="min-w-0 text-sm">
        {editing && ed ? (
          <div className="space-y-2">
            {ed.kind === "choice" ? (
              <Select value={draft || NONE} onValueChange={setDraft}>
                <SelectTrigger className="min-h-11" aria-label={row.label}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{emptyText(row)}</SelectItem>
                  {ed.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : ed.kind === "multi" ? (
              <ul className="max-h-60 space-y-1 overflow-y-auto" aria-label={row.label}>
                {ed.options.map((o) => (
                  <li key={o.value}>
                    <label className="flex min-h-11 items-center gap-2">
                      <Checkbox checked={multi.includes(o.value)} onCheckedChange={(c) => setMulti((cur) => (c === true ? [...cur, o.value] : cur.filter((x) => x !== o.value)))} />
                      {o.label}
                    </label>
                  </li>
                ))}
              </ul>
            ) : ed.kind === "custom" ? (
              ed.render(() => setEditing(false))
            ) : (
              <Input
                className={cn("min-h-11", ed.kind === "code" && "font-mono")}
                type={ed.kind === "date" ? "date" : "text"}
                autoComplete="off"
                aria-label={row.label}
                placeholder={ed.kind === "link" ? "https://" : ed.kind === "code" ? "Type the new code" : undefined}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            )}
            {problem ? <p role="alert" className="text-sm text-destructive">{problem}</p> : null}
            <div className="flex gap-2">
              {ed.kind !== "custom" ? (
                <Button className="min-h-11" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Save"}</Button>
              ) : null}
              <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="pt-2.5">
            {empty ? (
              <span className="font-medium text-destructive">{emptyText(row)}</span>
            ) : row.view ? (
              row.view
            ) : (
              <span className="whitespace-pre-line break-words">{row.value}</span>
            )}
            {line ? <p className="mt-0.5 text-xs text-muted-foreground">{line}</p> : null}
          </div>
        )}
      </dd>
      <div className="sm:pt-0.5">
        {ed && !editing ? (
          <Button variant="outline" size="sm" className="min-h-11" onClick={start} aria-label={`Edit ${row.label}`}>Edit</Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ PID values */

type PidValue =
  | { type: "text"; text: string }
  | { type: "list"; items: string[] }
  | { type: "url"; url: string }
  | { type: "files"; count: number };

function pidText(name: string, v: PidValue): string | null {
  if (!v) return null;
  if (v.type === "text") return v.text || null;
  if (v.type === "list") return v.items.join(", ") || null;
  if (v.type === "url") return v.url || null;
  const noun = /photo|chip/i.test(name) ? "photo" : "file";
  return `${v.count} ${noun}${v.count === 1 ? "" : "s"} in the PID`;
}
function pidView(name: string, v: PidValue): ReactNode | undefined {
  if (v?.type === "url" && v.url)
    return <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-primary underline">Open {name}</a>;
  return undefined;
}
