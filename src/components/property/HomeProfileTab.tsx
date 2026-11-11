/**
 * Home Profile tab: the ten PID sections in Notion's order (register P1).
 *
 * Codes stay encrypted: a code shows only after Show, one at a time, and each
 * Show is logged before the value is released. Search reads every field but
 * never a code. Editing saves through one database function with the person
 * and the time; codes save through the existing credential path.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Eye, EyeOff, ImagePlus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  archiveCredentialFn,
  listCredentialsFn,
  revealCredentialFn,
  saveCredentialFn,
  verifyCredentialFn,
} from "@/lib/credentials.functions";
import { codeCheckedText, pendingCodesLine, showPendingCodes } from "@/lib/pending-codes";
import { attachmentUrlFn, beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { usDateTime } from "@/lib/dates";
import {
  EDITING_NOTE,
  HOME_PROFILE_SECTIONS,
  buildChanges,
  codesFor,
  displayValue,
  editText,
  flagsFor,
  isEditable,
  linkFor,
  photosFor,
  searchProfile,
  visibleItems,
  type CodeCategory,
  type LinkMeta,
  type ProfileContext,
  type ProfileItem,
  type ProfileSection,
  type ProfileChange,
} from "@/lib/home-profile";

const REVEAL_MS = 60_000;

export type HomeProfileData = {
  raw: Record<string, unknown>;
  links: LinkMeta[];
  system: ProfileContext["system"];
};

export function useProfileContext(propertyId: string, profile: HomeProfileData | null) {
  const list = useServerFn(listCredentialsFn);
  const creds = useQuery({
    queryKey: ["property-credentials", propertyId],
    queryFn: () => list({ data: { propertyId } }),
    retry: false,
  });
  const photos = useQuery({
    queryKey: ["home-profile-photos", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_profile_photos")
        .select("id, item_key, document_id, documents(title, original_filename)")
        .eq("property_id", propertyId)
        .is("removed_at", null)
        .order("added_at");
      if (error) throw error;
      return (data ?? []).map((r) => {
        const d = r.documents as unknown as { title: string | null; original_filename: string | null } | null;
        return { id: r.id, itemKey: r.item_key, documentId: r.document_id, name: d?.title || d?.original_filename || "Photo" };
      });
    },
  });
  const ctx: ProfileContext = useMemo(
    () => ({
      property: profile?.raw ?? {},
      links: profile?.links ?? [],
      system: profile?.system ?? {},
      credentials: (creds.data?.rows ?? []).map((r) => ({ id: r.id, category: r.category, label: r.label })),
      photos: photos.data ?? [],
    }),
    [profile, creds.data, photos.data],
  );
  return {
    ctx,
    canManageCodes: creds.data?.canManage === true,
    codeRows: creds.data?.rows ?? [],
    pendingIntake: creds.data?.pendingIntake ?? 0,
    credsError: creds.error,
    loading: creds.isLoading || photos.isLoading,
  };
}

type CodeRow = Awaited<ReturnType<typeof listCredentialsFn>>["rows"][number];

/** Pending codes line: the import's waiting count, Mark current and Archive. Values never show here. */
function PendingCodes({ propertyId, rows, waiting }: { propertyId: string; rows: CodeRow[]; waiting: number }) {
  const qc = useQueryClient();
  const verify = useServerFn(verifyCredentialFn);
  const archive = useServerFn(archiveCredentialFn);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["property-credentials", propertyId] });
  const run = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(done);
      setConfirm(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not save. Try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="rounded-md border border-border p-3" aria-label="Pending codes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">Pending codes</span>
          <span className="text-muted-foreground"> · {pendingCodesLine(waiting)}</span>
        </p>
        <Button size="sm" variant="outline" className="min-h-11" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Review codes"}
        </Button>
      </div>
      {open ? (
        rows.length === 0 ? (
          <p className="pt-2 text-sm text-muted-foreground">Nothing here yet</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.categoryLabel} · {codeCheckedText(r.lastVerifiedOn)}
                  </p>
                </div>
                {confirm === r.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">Archive {r.label}?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="min-h-11"
                      disabled={busy === r.id}
                      onClick={() => void run(r.id, () => archive({ data: { credentialId: r.id } }), "Code archived")}
                    >
                      Archive
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11" disabled={busy === r.id} onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={busy === r.id}
                      aria-label={`Mark ${r.label} current`}
                      onClick={() => void run(r.id, () => verify({ data: { credentialId: r.id } }), "Marked current today")}
                    >
                      Mark current
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={busy === r.id}
                      aria-label={`Archive ${r.label}`}
                      onClick={() => setConfirm(r.id)}
                    >
                      Archive
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/** Scroll to an item (opening its section first). */
export function goToProfileItem(itemKey: string) {
  window.dispatchEvent(new CustomEvent("home-profile:go", { detail: itemKey }));
}

export function HomeProfileTab({
  propertyId,
  profile,
  canEdit,
  readOnly = false,
}: {
  propertyId: string;
  profile: HomeProfileData | null;
  canEdit: boolean;
  /** Viewing as someone else: the Pending codes line stays hidden. */
  readOnly?: boolean;
}) {
  const { ctx, canManageCodes, codeRows, pendingIntake, credsError } = useProfileContext(propertyId, profile);
  const pendingCodes = showPendingCodes({ canManageCodes, readOnly })
    ? <PendingCodes propertyId={propertyId} rows={codeRows} waiting={pendingIntake} />
    : null;
  const [query, setQuery] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(HOME_PROFILE_SECTIONS.map((s) => [s.id, true])),
  );
  const [jump, setJump] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const hits = useMemo(() => searchProfile(query, ctx), [query, ctx]);

  const scrollTo = (id: string) => {
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const goTo = (itemKey: string) => {
    const section = HOME_PROFILE_SECTIONS.find((s) => s.items.some((i) => i.key === itemKey));
    if (!section) return;
    setOpen((o) => ({ ...o, [section.id]: true }));
    setFocusKey(itemKey);
    scrollTo(`hp-item-${itemKey}`);
  };
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  useEffect(() => {
    const onGo = (e: Event) => goToRef.current(String((e as CustomEvent).detail));
    window.addEventListener("home-profile:go", onGo);
    return () => window.removeEventListener("home-profile:go", onGo);
  }, []);

  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="min-h-11 pl-9"
            aria-label="Search this home"
            placeholder="Search this home"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label htmlFor="hp-jump" className="text-sm font-medium">
          Jump to
        </label>
        <Select
          value={jump}
          onValueChange={(v) => {
            setJump("");
            setOpen((o) => ({ ...o, [v]: true }));
            scrollTo(`hp-${v}`);
          }}
        >
          <SelectTrigger id="hp-jump" className="min-h-11 w-60" aria-label="Jump to">
            <SelectValue placeholder="Choose a section" />
          </SelectTrigger>
          <SelectContent>
            {HOME_PROFILE_SECTIONS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Switch checked={showEmpty} onCheckedChange={setShowEmpty} aria-label="Show empty fields" />
          Show empty fields
        </label>
      </div>

      {query.trim().length >= 2 ? (
        <div className="surface p-3" aria-label="Search results">
          {hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing on this home matches.</p>
          ) : (
            <ul className="divide-y divide-border">
              {hits.slice(0, 30).map((h) => (
                <li key={h.itemKey} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{h.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {h.sectionTitle}
                      {h.snippet ? ` · ${h.snippet}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => goTo(h.itemKey)}>
                    Go to it
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {credsError ? (
        <p role="alert" className="text-sm text-destructive">
          Codes could not be loaded right now. Everything else is shown.
        </p>
      ) : null}

      {HOME_PROFILE_SECTIONS.map((section) => (
        <ProfileCard
          key={section.id}
          propertyId={propertyId}
          section={section}
          ctx={ctx}
          showEmpty={showEmpty}
          open={open[section.id] !== false}
          onToggle={() => setOpen((o) => ({ ...o, [section.id]: o[section.id] === false }))}
          canEdit={canEdit}
          canManageCodes={canManageCodes}
          focusKey={focusKey}
          extra={section.id === "entry" ? pendingCodes : null}
        />
      ))}
    </div>
  );
}

function ProfileCard({
  propertyId,
  section,
  ctx,
  showEmpty,
  open,
  onToggle,
  canEdit,
  canManageCodes,
  focusKey,
  extra = null,
}: {
  propertyId: string;
  section: ProfileSection;
  ctx: ProfileContext;
  showEmpty: boolean;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  canManageCodes: boolean;
  focusKey: string | null;
  /** Shown at the top of the open card (the Pending codes line in Entry & Access Details). */
  extra?: ReactNode;
}) {
  const qc = useQueryClient();
  const reveal = useServerFn(revealCredentialFn);
  const saveCode = useServerFn(saveCredentialFn);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [codeOriginal, setCodeOriginal] = useState<Record<string, string>>({});
  const [savedNow, setSavedNow] = useState(false);
  const editable = canEdit && section.items.some((i) => isEditable(i) || flagsFor(i).code || flagsFor(i).photo);

  const items = editing ? section.items : visibleItems(section, ctx, showEmpty);
  const hasCodes = section.items.some((i) => i.src.kind === "code" || i.src.kind === "other_codes");

  async function startEdit() {
    const d: Record<string, string> = {};
    for (const i of section.items) if (isEditable(i)) d[i.key] = editText(i, ctx);
    setDrafts(d);
    setCodeDrafts({});
    setCodeOriginal({});
    setSavedNow(false);
    setEditing(true);
    // Codes are visible while editing; each one is fetched through the logged Show.
    if (hasCodes && canManageCodes) {
      const values: Record<string, string> = {};
      for (const i of section.items) {
        for (const c of codesFor(i, ctx)) {
          try {
            const res = await reveal({ data: { credentialId: c.id, action: "reveal" } });
            values[c.id] = res.value;
          } catch {
            /* a code that cannot be logged is not shown */
          }
        }
      }
      setCodeDrafts(values);
      setCodeOriginal(values);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const changes: ProfileChange[] = buildChanges(section, drafts, ctx);
      // Codes first, through the encrypted path; history lines never hold the value.
      if (canManageCodes) {
        for (const item of section.items) {
          const src = item.src;
          if (src.kind !== "code" && src.kind !== "other_codes") continue;
          const existing = codesFor(item, ctx);
          for (const c of existing) {
            const next = codeDrafts[c.id];
            if (next === undefined || next === codeOriginal[c.id] || !next.trim()) continue;
            await saveCode({
              data: { id: c.id, propertyId, category: c.category as CodeCategory, label: c.label, secret: next.trim() },
            });
            changes.push({ key: item.key, label: item.label, target: "code", value: null });
          }
          const fresh = codeDrafts[`new:${item.key}`];
          if (src.kind === "code" && existing.length === 0 && fresh && fresh.trim()) {
            await saveCode({
              data: { propertyId, category: src.category, label: src.newLabel, secret: fresh.trim() },
            });
            changes.push({ key: item.key, label: item.label, target: "code", value: null });
          }
        }
      }
      if (changes.length === 0) return 0;
      const { error } = await supabase.rpc("save_home_profile_card", {
        _property_id: propertyId,
        _card: section.title,
        _changes: changes as never,
      });
      if (error) throw error;
      return changes.length;
    },
    onSuccess: (n) => {
      setEditing(false);
      setCodeDrafts({});
      setCodeOriginal({});
      setSavedNow(n > 0);
      void qc.invalidateQueries({ queryKey: ["property-hub", propertyId] });
      void qc.invalidateQueries({ queryKey: ["property-credentials", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section id={`hp-${section.id}`} className="surface scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-11 flex-1 items-center gap-2 text-left text-base font-semibold"
        >
          {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          {section.title}
        </button>
        {editable && !editing ? (
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void startEdit()}>
            Edit
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {editing ? <p className="rounded-md bg-muted p-3 text-sm">{EDITING_NOTE}</p> : null}
          {!editing ? extra : null}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <dl className="divide-y divide-border/60">
              {items.map((item) => (
                <ProfileRow
                  key={item.key}
                  propertyId={propertyId}
                  item={item}
                  ctx={ctx}
                  editing={editing}
                  canManageCodes={canManageCodes}
                  draft={drafts[item.key]}
                  onDraft={(v) => setDrafts((d) => ({ ...d, [item.key]: v }))}
                  codeDrafts={codeDrafts}
                  onCodeDraft={(id, v) => setCodeDrafts((d) => ({ ...d, [id]: v }))}
                  focused={focusKey === item.key}
                  onFill={editable ? () => void startEdit() : undefined}
                />
              ))}
            </dl>
          )}
          {editing ? (
            <div className="flex gap-2 pt-2">
              <Button className="min-h-11" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                className="min-h-11"
                variant="outline"
                disabled={save.isPending}
                onClick={() => {
                  setEditing(false);
                  setCodeDrafts({});
                  setCodeOriginal({});
                }}
              >
                Cancel
              </Button>
            </div>
          ) : null}
          {savedNow ? <p className="text-xs text-muted-foreground">Saved just now by you</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function ProfileRow({
  propertyId,
  item,
  ctx,
  editing,
  canManageCodes,
  draft,
  onDraft,
  codeDrafts,
  onCodeDraft,
  focused,
  onFill,
}: {
  propertyId: string;
  item: ProfileItem;
  ctx: ProfileContext;
  editing: boolean;
  canManageCodes: boolean;
  draft: string | undefined;
  onDraft: (v: string) => void;
  codeDrafts: Record<string, string>;
  onCodeDraft: (id: string, v: string) => void;
  focused: boolean;
  /** Opens the card's Edit (Build 16 D: Fill it in on an empty field). */
  onFill?: () => void;
}) {
  const f = flagsFor(item);
  const empty = onFill && isEditable(item) ? (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">Nothing here yet</span>
      <Button size="sm" variant="outline" className="min-h-11" onClick={onFill}>
        Fill it in
      </Button>
    </span>
  ) : (
    <span className="text-muted-foreground">Nothing here yet</span>
  );
  const value = displayValue(item, ctx);
  const codes = codesFor(item, ctx);
  const link = linkFor(item, ctx);
  const sysValue =
    item.src.kind === "system" && (item.src.field === "last_edit" || item.src.field === "added_on") && value
      ? usDateTime(value)
      : value;

  return (
    <div
      id={`hp-item-${item.key}`}
      className={`grid scroll-mt-24 gap-1 py-2 sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:gap-4 ${focused ? "rounded-md bg-primary/5" : ""}`}
    >
      <dt className="text-sm font-medium">
        {item.label}
        {f.required ? (
          <span className="ml-2 inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-xs font-normal">Needed for handoff</span>
        ) : null}
      </dt>
      <dd className="min-w-0 space-y-2 text-sm">
        {f.code ? (
          <CodeValues
            item={item}
            codes={codes}
            editing={editing}
            canManageCodes={canManageCodes}
            codeDrafts={codeDrafts}
            onCodeDraft={onCodeDraft}
          />
        ) : editing && isEditable(item) ? (
          <Input
            className="min-h-11"
            aria-label={item.label}
            value={draft ?? ""}
            onChange={(e) => onDraft(e.target.value)}
            inputMode={item.src.kind !== "link" && "shape" in item.src && item.src.shape === "number" ? "decimal" : undefined}
            placeholder={item.src.kind === "link" ? "https://" : undefined}
          />
        ) : f.link ? (
          link ? (
            <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-primary underline">
              Open {item.label}
            </a>
          ) : (
            empty
          )
        ) : item.src.kind === "photo" ? null : sysValue ? (
          <span className="whitespace-pre-line">{sysValue}</span>
        ) : (
          empty
        )}
        {f.photo ? <ItemPhotos propertyId={propertyId} item={item} ctx={ctx} editing={editing} /> : null}
      </dd>
    </div>
  );
}

function CodeValues({
  item,
  codes,
  editing,
  canManageCodes,
  codeDrafts,
  onCodeDraft,
}: {
  item: ProfileItem;
  codes: { id: string; label: string }[];
  editing: boolean;
  canManageCodes: boolean;
  codeDrafts: Record<string, string>;
  onCodeDraft: (id: string, v: string) => void;
}) {
  const reveal = useServerFn(revealCredentialFn);
  const [shown, setShown] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (editing && canManageCodes) {
    return (
      <div className="space-y-2">
        {codes.map((c) => (
          <Input
            key={c.id}
            className="min-h-11 font-mono"
            aria-label={codes.length > 1 || item.src.kind === "other_codes" ? c.label : item.label}
            autoComplete="off"
            value={codeDrafts[c.id] ?? ""}
            onChange={(e) => onCodeDraft(c.id, e.target.value)}
          />
        ))}
        {codes.length === 0 && item.src.kind === "code" ? (
          <Input
            className="min-h-11 font-mono"
            aria-label={item.label}
            autoComplete="off"
            placeholder="Add the code"
            value={codeDrafts[`new:${item.key}`] ?? ""}
            onChange={(e) => onCodeDraft(`new:${item.key}`, e.target.value)}
          />
        ) : null}
      </div>
    );
  }

  if (codes.length === 0) return <span className="text-muted-foreground">Nothing here yet</span>;
  return (
    <div className="space-y-1">
      {editing && !canManageCodes ? (
        <p className="text-xs text-muted-foreground">Codes are changed by leadership and the onboarding team.</p>
      ) : null}
      {codes.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2">
          {codes.length > 1 || item.src.kind === "other_codes" ? <span className="text-muted-foreground">{c.label}</span> : null}
          <span className="font-mono">{shown[c.id] ?? "••••••"}</span>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={busy === c.id}
            onClick={async () => {
              if (shown[c.id]) {
                setShown((s) => {
                  const n = { ...s };
                  delete n[c.id];
                  return n;
                });
                return;
              }
              setBusy(c.id);
              try {
                const res = await reveal({ data: { credentialId: c.id, action: "reveal" } });
                setShown((s) => ({ ...s, [c.id]: res.value }));
                window.setTimeout(
                  () =>
                    setShown((s) => {
                      const n = { ...s };
                      delete n[c.id];
                      return n;
                    }),
                  REVEAL_MS,
                );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "That code could not be shown.");
              } finally {
                setBusy(null);
              }
            }}
          >
            {shown[c.id] ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            {shown[c.id] ? "Hide" : "Show"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function ItemPhotos({
  propertyId,
  item,
  ctx,
  editing,
}: {
  propertyId: string;
  item: ProfileItem;
  ctx: ProfileContext;
  editing: boolean;
}) {
  const qc = useQueryClient();
  const urlFor = useServerFn(attachmentUrlFn);
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const [upload] = useState(() =>
    createAttachmentUploader(begin, complete, (file, key) => ({
      entityType: "property",
      entityId: propertyId,
      uploadKey: key,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      category: "media",
      fulfilsRequestId: null,
    })),
  );
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const photos = photosFor(item, ctx);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const documentId = await upload(file, () => {}, crypto.randomUUID());
        const { error } = await supabase.rpc("add_home_profile_photo", {
          _property_id: propertyId,
          _item_key: item.key,
          _document_id: documentId,
        });
        if (error) throw error;
      }
      toast.success("Photo saved.");
      void qc.invalidateQueries({ queryKey: ["home-profile-photos", propertyId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The photo could not be saved.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (photos.length === 0 && !editing) {
    return item.src.kind === "photo" ? <span className="text-muted-foreground">Nothing here yet</span> : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {photos.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              try {
                const r = await urlFor({ data: { documentId: p.documentId, download: false } });
                window.open(r.url, "_blank", "noopener,noreferrer");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "That photo could not be opened.");
              }
            }}
          >
            {p.name}
          </Button>
          {editing ? (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={async () => {
                const { error } = await supabase.rpc("remove_home_profile_photo", { _photo_id: p.id });
                if (error) toast.error(error.message);
                void qc.invalidateQueries({ queryKey: ["home-profile-photos", propertyId] });
              }}
            >
              Take off
            </Button>
          ) : null}
        </span>
      ))}
      {editing ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <Button size="sm" variant="outline" className="min-h-11" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden="true" /> {busy ? "Saving…" : "Add photo"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
