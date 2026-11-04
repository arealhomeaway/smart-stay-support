/**
 * Files tab, first version: one read-only list of a home's Resolve documents,
 * photos and saved external links. Reads only; access follows existing rules.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usDate } from "@/lib/dates";
import { fileKind, filterFiles, type FileKind, type FileRow } from "@/lib/property-files";

const KINDS: { id: FileKind | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "document", label: "Documents" },
  { id: "photo", label: "Photos" },
  { id: "link", label: "Saved links" },
];

export function PropertyFilesTab({ propertyId }: { propertyId: string }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<FileKind | "all">("all");
  const files = useQuery({
    queryKey: ["property-files-tab", propertyId],
    queryFn: async (): Promise<FileRow[]> => {
      const [docs, links] = await Promise.all([
        supabase
          .from("documents")
          .select("id, title, original_filename, mime_type, category, created_at, external_url")
          .eq("property_id", propertyId)
          .is("deleted_at", null)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("property_external_links")
          .select("id, label, kind, url, created_at")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (docs.error) throw docs.error;
      if (links.error) throw links.error;
      const rows: FileRow[] = [
        ...(docs.data ?? []).map((d) => ({
          id: `doc-${d.id}`,
          name: d.title || d.original_filename || "Untitled file",
          kind: fileKind({ mime: d.mime_type, filename: d.original_filename }),
          detail: d.category ?? null,
          createdAt: d.created_at,
          url: d.external_url ?? null,
        })),
        ...(links.data ?? []).map((l) => ({
          id: `link-${l.id}`,
          name: l.label || l.url,
          kind: "link" as const,
          detail: l.kind,
          createdAt: l.created_at,
          url: l.url,
        })),
      ];
      return rows;
    },
  });
  const shown = useMemo(() => filterFiles(files.data ?? [], q, kind), [files.data, q, kind]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Every file, photo and saved link for this home in one place. To add or change a file, use
        Documents &amp; media.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          aria-label="Search files"
          placeholder="Search by name or type"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {KINDS.map((k) => (
          <Button
            key={k.id}
            size="sm"
            type="button"
            variant={kind === k.id ? "default" : "outline"}
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </Button>
        ))}
      </div>
      {files.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading files…</p>
      ) : files.error ? (
        <p role="alert" className="text-sm text-destructive">Files could not be loaded. Refresh to try again.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files match.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {shown.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                {f.url ? (
                  <a className="font-medium underline" href={f.url} target="_blank" rel="noreferrer">
                    {f.name}
                  </a>
                ) : (
                  <span className="font-medium">{f.name}</span>
                )}
                {f.detail ? <span className="ml-2 text-xs text-muted-foreground">{f.detail}</span> : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{KINDS.find((k) => k.id === f.kind)?.label.replace(/s$/, "") ?? f.kind}</Badge>
                <span className="text-xs text-muted-foreground">{usDate(f.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
