import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/hooks/useRole";
import { loadCardHistory, loadLibrary, saveCard, setCardStatus, type LibraryCardRow } from "@/lib/ao-data";
import {
  FIELD_TYPES, NOT_SET_UP, addField, canEditCardLibrary, filterCards, moveField, parseOutputFields, removeField,
  statusActions, type CardFilters, type FieldType, type OutputField,
} from "@/lib/ao-ui";
import { usDate } from "@/lib/ao-format";
import { ExistingItemMatches, SuggestedStepLinks } from "@/components/ao/DedupeReview";

export const Route = createFileRoute("/_authenticated/owner-card-library")({
  head: () => ({
    meta: [
      { title: "Card library | Resolve" },
      { name: "description", content: "Edit, release and retire the Active Owner homeowner plan cards." },
      { property: "og:title", content: "Card library | Resolve" },
      { property: "og:description", content: "The card library behind each home's automated homeowner plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="owner_card_library">
      <LibraryPage />
    </RequireCapability>
  ),
});

const LANES = ["critical", "launch", "flexible", "triggered"];
const STAGES = ["onboarding_early", "onboarding_launch", "anytime", "operations"];
const STATUSES = ["draft", "released", "retired"];
const human = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const TEXT_FIELDS: { key: keyof LibraryCardRow; label: string; long?: boolean }[] = [
  { key: "title", label: "Title" }, { key: "card_group", label: "Group" },
  { key: "what_text", label: "What", long: true }, { key: "why_text", label: "Why", long: true },
  { key: "how_text", label: "How", long: true }, { key: "required_output", label: "Required output", long: true },
  { key: "documentation_note", label: "Documentation note", long: true }, { key: "opens_text", label: "Opens when" },
  { key: "deadline_text", label: "Deadline wording" }, { key: "takeover_text", label: "If the homeowner does not finish", long: true },
];
const NUM_FIELDS: { key: keyof LibraryCardRow; label: string }[] = [
  // Build 18 item 3: hour estimates are hidden everywhere; the stored numbers stay as they are
  // (the save sends no hour fields, so ao_card_save keeps them).
  { key: "deadline_business_days", label: "Deadline, business days" }, { key: "deadline_calendar_days", label: "Deadline, calendar days" },
];

function LibraryPage() {
  const role = useRole();
  const canEdit = !role.readOnly && canEditCardLibrary(role);
  const q = useQuery({ queryKey: ["ao-library"], queryFn: loadLibrary, retry: false });
  const [f, setF] = useState<CardFilters>({ group: "all", lane: "all", stage: "all", status: "all", q: "" });
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = q.data?.available ? q.data.data : [];
  const groups = useMemo(() => [...new Set(rows.map((r) => r.card_group).filter(Boolean))].sort(), [rows]);
  const shown = filterCards(rows, f);

  if (q.isLoading) return <LoadingPage />;
  const header = <PageHeader eyebrow="Active Owner" title="Card library" description="The cards each home's automated homeowner plan is built from." />;
  if (q.error) return <div className="space-y-6">{header}<EmptyState title="Could not load the card library" hint={(q.error as Error).message} /></div>;
  if (!q.data?.available) return <div className="space-y-6">{header}<EmptyState title={NOT_SET_UP} hint="The card library will appear here once it is switched on." /></div>;
  if (!canEditCardLibrary(role)) return <div className="space-y-6">{header}<EmptyState title="Admin and the Onboarding Director manage the card library" /></div>;

  const pick = (label: string, key: keyof CardFilters, opts: string[]) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={f[key]} onValueChange={(v) => setF({ ...f, [key]: v })}>
        <SelectTrigger className="w-44" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {opts.map((o) => <SelectItem key={o} value={o}>{human(o)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {header}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="ao-lib-q">Search</Label>
            <Input id="ao-lib-q" placeholder="Code or title" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="w-56" />
          </div>
          {pick("Group", "group", groups)}
          {pick("Lane", "lane", LANES)}
          {pick("Stage", "stage", STAGES)}
          {pick("Status", "status", STATUSES)}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1 pr-2">Code</th><th className="pr-2">Title</th><th className="pr-2">Group</th><th className="pr-2">Lane</th><th className="pr-2">Stage</th><th className="pr-2">Status</th><th className="pr-2">Version</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpenId(r.id)}>
                  <td className="py-1 pr-2 font-mono">{r.code}</td><td className="pr-2">{r.title}</td><td className="pr-2">{r.card_group}</td>
                  <td className="pr-2">{human(r.lane)}</td><td className="pr-2">{human(r.stage_window)}</td>
                  <td className="pr-2"><Badge variant={r.status === "released" ? "default" : "secondary"}>{human(r.status)}</Badge></td>
                  <td className="pr-2">{r.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No cards match.</p> : null}
        </div>
      </SectionCard>
      <SuggestedStepLinks canEdit={canEdit} />
      <ExistingItemMatches canEdit={canEdit} />
      <Sheet open={openId !== null} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {openId ? <CardEditor key={openId} card={rows.find((r) => r.id === openId)!} canEdit={canEdit} onDone={() => setOpenId(null)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CardEditor({ card, canEdit, onDone }: { card: LibraryCardRow; canEdit: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<LibraryCardRow>(card);
  const [fields, setFields] = useState<OutputField[]>(parseOutputFields(card.output_fields));
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const hist = useQuery({ queryKey: ["ao-card-history", card.id], queryFn: () => loadCardHistory(card.id), retry: false });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["ao-library"] }); void qc.invalidateQueries({ queryKey: ["ao-card-history", card.id] }); };
  const save = useMutation({
    mutationFn: () => {
      const patch: Record<string, unknown> = { output_fields: fields, lane: d.lane, stage_window: d.stage_window, team_needs_this: d.team_needs_this, lock_rule: d.lock_rule };
      for (const t of TEXT_FIELDS) patch[t.key] = d[t.key];
      for (const n of NUM_FIELDS) patch[n.key] = d[n.key] === null || (d[n.key] as unknown) === "" ? null : Number(d[n.key]);
      return saveCard(card.id, patch);
    },
    onSuccess: () => { toast.success("Card saved"); refresh(); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: (s: string) => setCardStatus(card.id, s),
    onSuccess: () => { toast.success("Status changed"); refresh(); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (k: keyof LibraryCardRow, v: unknown) => setD({ ...d, [k]: v });

  return (
    <div className="space-y-4">
      <SheetHeader><SheetTitle>{card.code} {card.title}</SheetTitle></SheetHeader>
      <div className="flex flex-wrap gap-2">
        {statusActions(card.status).map((a) => (
          <Button key={a.to} size="sm" variant="outline" disabled={!canEdit || status.isPending} onClick={() => status.mutate(a.to)}>{a.label}</Button>
        ))}
      </div>
      {TEXT_FIELDS.map((t) => (
        <div key={t.key} className="space-y-1">
          <Label htmlFor={`f-${t.key}`}>{t.label}</Label>
          {t.long
            ? <Textarea id={`f-${t.key}`} value={String(d[t.key] ?? "")} disabled={!canEdit} onChange={(e) => set(t.key, e.target.value)} />
            : <Input id={`f-${t.key}`} value={String(d[t.key] ?? "")} disabled={!canEdit} onChange={(e) => set(t.key, e.target.value)} />}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {NUM_FIELDS.map((n) => (
          <div key={n.key} className="space-y-1">
            <Label htmlFor={`f-${n.key}`}>{n.label}</Label>
            <Input id={`f-${n.key}`} type="number" value={d[n.key] == null ? "" : String(d[n.key])} disabled={!canEdit} onChange={(e) => set(n.key, e.target.value === "" ? null : e.target.value)} />
          </div>
        ))}
        {([["lane", LANES], ["stage_window", STAGES], ["lock_rule", ["none", "until_linked_step_done"]]] as const).map(([k, opts]) => (
          <div key={k} className="space-y-1">
            <Label>{human(k)}</Label>
            <Select value={String(d[k])} onValueChange={(v) => set(k, v)} disabled={!canEdit}>
              <SelectTrigger aria-label={human(k)}><SelectValue /></SelectTrigger>
              <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{human(o)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-6">
          <Switch id="f-team" checked={d.team_needs_this} disabled={!canEdit} onCheckedChange={(v) => set("team_needs_this", v)} />
          <Label htmlFor="f-team">Team needs this</Label>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Homeowner answers</p>
        {fields.map((fl, i) => (
          <div key={fl.key} className="flex items-center gap-2">
            <Input aria-label="Answer label" value={fl.label} disabled={!canEdit} onChange={(e) => setFields(fields.map((x) => x.key === fl.key ? { ...x, label: e.target.value } : x))} />
            <Select value={fl.type} disabled={!canEdit} onValueChange={(v) => setFields(fields.map((x) => x.key === fl.key ? { ...x, type: v as FieldType } : x))}>
              <SelectTrigger className="w-36" aria-label="Answer type"><SelectValue /></SelectTrigger>
              <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" variant="ghost" aria-label="Move up" disabled={!canEdit || i === 0} onClick={() => setFields(moveField(fields, fl.key, -1))}><ArrowUp className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Move down" disabled={!canEdit || i === fields.length - 1} onClick={() => setFields(moveField(fields, fl.key, 1))}><ArrowDown className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Remove" disabled={!canEdit} onClick={() => setFields(removeField(fields, fl.key))}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        {canEdit ? (
          <div className="flex items-center gap-2">
            <Input placeholder="New answer label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <Select value={newType} onValueChange={(v) => setNewType(v as FieldType)}>
              <SelectTrigger className="w-36" aria-label="New answer type"><SelectValue /></SelectTrigger>
              <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={!newLabel.trim()} onClick={() => { setFields(addField(fields, newLabel.trim(), newType)); setNewLabel(""); }}>Add</Button>
          </div>
        ) : null}
      </div>

      {canEdit ? <Button onClick={() => save.mutate()} disabled={save.isPending || !d.title.trim()}>Save card</Button> : null}

      <div>
        <p className="text-sm font-medium">History</p>
        <ul className="text-xs text-muted-foreground">
          {hist.data?.available
            ? hist.data.data.map((h) => <li key={h.id}>Version {h.version}, {usDate(h.changed_at)}</li>)
            : <li>No history yet.</li>}
        </ul>
      </div>
    </div>
  );
}
