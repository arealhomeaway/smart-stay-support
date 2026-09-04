/**
 * Where a vendor works, defined by ZIP code.
 *
 * A territory is the default: paste the ZIPs a company covers for one trade
 * and every ARHA home in those ZIPs is theirs. A single home can still be
 * assigned or excluded on the Coverage tab, and the home always wins.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addVendorServiceArea,
  dropVendorServiceArea,
  vendorCoverageMap,
} from "@/lib/vendors.functions";
import {
  COVERAGE_PRIORITIES,
  COVERAGE_PRIORITY_LABELS,
  SERVICE_CATEGORIES,
  parseZipList,
  type CoveragePriority,
  type ServiceAreaRow,
} from "@/lib/vendors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export function VendorTerritoryPanel({
  orgId,
  areas,
  canManage,
  onChanged,
}: {
  orgId: string;
  areas: ServiceAreaRow[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const addArea = useServerFn(addVendorServiceArea);
  const dropArea = useServerFn(dropVendorServiceArea);
  const loadMap = useServerFn(vendorCoverageMap);

  const [category, setCategory] = useState("");
  const [zipText, setZipText] = useState("");
  const [label, setLabel] = useState("");
  const [priority, setPriority] = useState<CoveragePriority>("primary");
  const [travelNote, setTravelNote] = useState("");

  const preview = useMemo(() => parseZipList(zipText), [zipText]);

  const coverage = useQuery({
    queryKey: ["vendor-coverage-map", orgId],
    queryFn: () => loadMap({ data: { orgId } }),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["vendor-coverage-map", orgId] });
    onChanged();
  };

  const addMutation = useMutation({
    mutationFn: () =>
      addArea({
        data: {
          orgId,
          serviceCategory: category,
          zipText,
          territoryLabel: label || null,
          coveragePriority: priority,
          travelNote: travelNote || null,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `${res.added} ZIP${res.added === 1 ? "" : "s"} added — ${res.homes} home${res.homes === 1 ? "" : "s"} covered.` +
          (res.rejected.length > 0 ? ` Skipped: ${res.rejected.slice(0, 5).join(", ")}.` : ""),
      );
      setZipText("");
      setLabel("");
      setTravelNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dropMutation = useMutation({
    mutationFn: (areaId: string) => dropArea({ data: { areaId } }),
    onSuccess: () => {
      toast.success("ZIP removed from their territory.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceAreaRow[]>();
    for (const area of areas) {
      const key = `${area.serviceCategory}||${area.territoryLabel ?? ""}`;
      map.set(key, [...(map.get(key) ?? []), area]);
    }
    return [...map.entries()];
  }, [areas]);

  const reached = (coverage.data ?? []).filter((r) => r.covered);
  const excluded = (coverage.data ?? []).filter((r) => !r.covered && r.source === "property");

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-medium">
          {reached.length} home{reached.length === 1 ? "" : "s"} reachable
        </p>
        <p className="text-muted-foreground">
          {reached.filter((r) => r.source === "territory").length} by territory,{" "}
          {reached.filter((r) => r.source === "property").length} assigned directly
          {excluded.length > 0 && `, ${excluded.length} excluded at the home`}.
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No territory yet. Paste the ZIP codes this company covers and homes match automatically as
          you add them.
        </p>
      ) : (
        grouped.map(([key, rows]) => {
          const [cat, territoryLabel] = key.split("||");
          const homes = rows.reduce((sum, r) => sum + r.propertyCount, 0);
          return (
            <div key={key} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium">
                    {cat}
                    {territoryLabel ? ` — ${territoryLabel}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {rows.length} ZIP{rows.length === 1 ? "" : "s"} · {homes} ARHA home
                    {homes === 1 ? "" : "s"} ·{" "}
                    {COVERAGE_PRIORITY_LABELS[rows[0]!.coveragePriority as CoveragePriority] ??
                      rows[0]!.coveragePriority}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rows.map((r) => (
                  <Badge
                    key={r.id}
                    variant={r.propertyCount > 0 ? "default" : "secondary"}
                    className="gap-1 font-mono text-xs"
                  >
                    {r.postalCode}
                    {r.propertyCount > 0 && <span className="opacity-80">·{r.propertyCount}</span>}
                    {canManage && (
                      <button
                        type="button"
                        aria-label={`Remove ${r.postalCode}`}
                        onClick={() => dropMutation.mutate(r.id)}
                        className="ml-0.5 opacity-70 hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              {rows[0]!.travelNote && (
                <p className="text-xs text-muted-foreground">Travel: {rows[0]!.travelNote}</p>
              )}
            </div>
          );
        })
      )}

      {canManage && (
        <>
          <Separator />
          <div className="space-y-2 rounded-lg border p-3">
            <Label>Add a territory</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Territory name (optional) — e.g. OKC metro north"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
            />
            <Textarea
              placeholder="Paste ZIP codes — 73003, 73012 73013… commas, spaces or one per line all work."
              value={zipText}
              onChange={(e) => setZipText(e.target.value)}
              rows={4}
            />
            {zipText.trim().length > 0 && (
              <p className="text-xs text-muted-foreground">
                {preview.zips.length} usable ZIP{preview.zips.length === 1 ? "" : "s"}
                {preview.rejected.length > 0 &&
                  ` · ignoring ${preview.rejected.slice(0, 6).join(", ")}`}
              </p>
            )}
            <Select value={priority} onValueChange={(v) => setPriority(v as CoveragePriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COVERAGE_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {COVERAGE_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Travel note (trip charge outside the metro, minimum job size…)"
              value={travelNote}
              onChange={(e) => setTravelNote(e.target.value)}
              maxLength={600}
            />
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!category || preview.zips.length === 0 || addMutation.isPending}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Add {preview.zips.length || ""} ZIP{preview.zips.length === 1 ? "" : "s"}
            </Button>
          </div>
        </>
      )}

      {reached.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Homes this company reaches
          </p>
          {reached.slice(0, 40).map((r) => (
            <div
              key={`${r.propertyId}-${r.serviceCategory}`}
              className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"
            >
              <span>
                {r.propertyName}
                <span className="text-muted-foreground"> · {r.serviceCategory}</span>
              </span>
              <Badge variant={r.source === "property" ? "default" : "secondary"}>
                {r.source === "property" ? "Assigned" : `ZIP ${r.postalCode ?? ""}`}
              </Badge>
            </div>
          ))}
          {reached.length > 40 && (
            <p className="text-xs text-muted-foreground">…and {reached.length - 40} more.</p>
          )}
        </div>
      )}
    </div>
  );
}
