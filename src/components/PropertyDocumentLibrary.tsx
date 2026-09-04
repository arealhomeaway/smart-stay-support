/**
 * The property document library.
 *
 * Every file that belongs to this home — filed on the property itself, on a
 * ticket, or on an onboarding task — appears on one of a small number of
 * shelves. Quick links are pinned above, but only when that document actually
 * exists; an empty shelf is never rendered.
 *
 * Secrets are not documents: codes and passwords live only in the encrypted
 * credential vault.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FileText, Film, Image as ImageIcon, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import {
  DOCUMENT_GROUPS,
  DOCUMENT_QUICK_LINKS,
  documentCategoryLabel,
  documentGroupFor,
  type DocumentGroupId,
} from "@/lib/attachments";
import { attachmentUrlFn } from "@/lib/attachments.functions";
import { usDate } from "@/lib/dates";

export type HubDocument = {
  id: string;
  title: string;
  kind: string;
  visibility: string;
  status: string;
  uploadedAt: string | null;
  uploadedByName?: string | null;
  entityType: string;
  entityId: string;
  category: string | null;
  filename?: string | null;
  note?: string | null;
};

export type HubExternalLink = {
  id: string;
  kind: string;
  label: string;
  url: string;
  context: string | null;
  staffOnly: boolean;
  canonical: boolean;
  needsReplacement: boolean;
  legacy: boolean;
  source: string | null;
  note: string | null;
  asOf: string | null;
};

function iconFor(kind: string) {
  if (kind === "photo") return <ImageIcon className="size-4" />;
  if (kind === "video") return <Film className="size-4" />;
  return <FileText className="size-4" />;
}

function sourceLabel(d: HubDocument): string {
  if (d.entityType === "ticket") return "From a ticket";
  if (d.entityType === "onboarding_task") return "From onboarding";
  return "Property record";
}

export function PropertyDocumentLibrary({
  propertyId,
  documents,
  links,
  staff,
}: {
  propertyId: string;
  documents: HubDocument[];
  links: HubExternalLink[];
  staff: boolean;
}) {
  const [query, setQuery] = useState("");
  const [shelf, setShelf] = useState<DocumentGroupId | "all">("all");
  const [opening, setOpening] = useState<string | null>(null);
  const getUrl = useServerFn(attachmentUrlFn);

  const ready = useMemo(() => documents.filter((d) => d.status !== "failed"), [documents]);

  const quickLinks = useMemo(
    () =>
      DOCUMENT_QUICK_LINKS.map((q) => ({
        ...q,
        doc: ready.find((d) => d.category === q.category),
      })).filter((q) => q.doc),
    [ready],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ready.filter((d) => {
      if (shelf !== "all" && documentGroupFor(d.category) !== shelf) return false;
      if (q.length < 2) return true;
      return [d.title, d.filename, d.note, documentCategoryLabel(d.category), sourceLabel(d)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [ready, query, shelf]);

  const shelves = DOCUMENT_GROUPS.map((g) => ({
    ...g,
    docs: filtered.filter((d) => documentGroupFor(d.category) === g.id),
  })).filter((g) => g.docs.length > 0);

  async function open(id: string) {
    setOpening(id);
    try {
      const res = await getUrl({ data: { documentId: id } });
      const url = (res as { url?: string }).url;
      if (!url) throw new Error("That file could not be opened.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That file could not be opened.");
    } finally {
      setOpening(null);
    }
  }

  const visibleLinks = links.filter((l) => staff || !l.staffOnly);

  return (
    <div className="space-y-6">
      {quickLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick links</CardTitle>
            <CardDescription>
              The documents people ask for most, when this home has them.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {quickLinks.map((q) => (
              <Button key={q.category} size="sm" variant="outline" onClick={() => open(q.doc!.id)}>
                {opening === q.doc!.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  iconFor(q.doc!.kind)
                )}
                {q.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by name, type or source"
            aria-label="Search documents"
            className="pl-9"
          />
        </div>
        <Select value={shelf} onValueChange={(v) => setShelf(v as DocumentGroupId | "all")}>
          <SelectTrigger className="sm:w-64" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {DOCUMENT_GROUPS.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shelves.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          {ready.length === 0
            ? "No documents have been filed for this home yet."
            : "No documents match that search."}
        </p>
      ) : (
        shelves.map((g) => (
          <Card key={g.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{g.label}</CardTitle>
              <CardDescription>{g.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {g.docs.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {iconFor(d.kind)}
                      {d.title}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {documentCategoryLabel(d.category) && (
                        <Badge variant="outline">{documentCategoryLabel(d.category)}</Badge>
                      )}
                      <span>{sourceLabel(d)}</span>
                      {d.uploadedAt && <span>· {usDate(d.uploadedAt)}</span>}
                      {d.uploadedByName && <span>· {d.uploadedByName}</span>}
                      {d.visibility === "owner_shared" && (
                        <Badge variant="secondary">Shared with owner</Badge>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={opening === d.id}
                    onClick={() => open(d.id)}
                  >
                    {opening === d.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    Open
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {visibleLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">External links</CardTitle>
            <CardDescription>
              Links that live outside Resolve. Legacy personal-drive links are not canonical and
              will move to the ARHA document library later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleLinks.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 truncate font-medium">
                    <ExternalLink className="size-4" />
                    {l.label}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {l.context && <span>{l.context}</span>}
                    {l.legacy && <Badge variant="outline">Legacy — not canonical</Badge>}
                    {l.needsReplacement && <Badge variant="secondary">Temporary</Badge>}
                    {l.staffOnly && <Badge variant="outline">Staff only</Badge>}
                  </span>
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {staff && (
        <AttachmentsPanel
          entityType="property"
          entityId={propertyId}
          title="Add a property document"
          description="File it on the right shelf so the next person finds it. Never upload codes, passwords or other secrets — those belong in Guest Access & Credentials."
        />
      )}
    </div>
  );
}
