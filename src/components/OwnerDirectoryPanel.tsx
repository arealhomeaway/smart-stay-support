import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOwnerDirectoryStats, syncPrimaryOwners } from "@/lib/owner-directory.functions";
import { usDateTime } from "@/lib/dates";
import { useRole } from "@/hooks/useRole";

/**
 * The general property → designated primary owner directory. Imported
 * read-only from OwnerRez; nothing is ever written back. Active Owner Program
 * enrollment is a separate programme status and is not an owner source.
 */
export function OwnerDirectoryPanel() {
  const qc = useQueryClient();
  const { isSupervisor, readOnly } = useRole();
  const stats = useServerFn(getOwnerDirectoryStats);
  const sync = useServerFn(syncPrimaryOwners);
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["owner-directory-stats"],
    queryFn: () => stats(),
  });

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  async function refresh() {
    setRunning(true);
    const result = await sync();
    setRunning(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    await qc.invalidateQueries({ queryKey: ["owner-directory-stats"] });
    await qc.invalidateQueries({ queryKey: ["property-contact"] });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Home className="size-4" /> Primary owner directory
        </CardTitle>
        <CardDescription>
          The designated primary owner for every home, imported read-only from OwnerRez. Nothing is
          sent back to OwnerRez or Notion, and ambiguous homes are never resolved by guessing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Homes" value={data.properties} />
          <Stat label="Owner on file" value={data.matched} />
          <Stat label="No owner mapped" value={data.missing} />
          <Stat label="Ambiguous" value={data.ambiguous} />
        </div>
        <p className="text-muted-foreground">
          {data.notLinked > 0 && (
            <>
              {data.notLinked} home{data.notLinked === 1 ? " is" : "s are"} not linked to an
              OwnerRez listing, so no owner can be resolved for{" "}
              {data.notLinked === 1 ? "it" : "them"} yet.{" "}
            </>
          )}
          {data.lastSyncedAt
            ? `Last import ${usDateTime(data.lastSyncedAt)}.`
            : "No import has run yet."}
          {data.staleCount > 0 && ` ${data.staleCount} record(s) may be out of date.`}
        </p>
        {isSupervisor && !readOnly && (
          <Button size="sm" onClick={() => void refresh()} disabled={running}>
            <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Importing…" : "Refresh from OwnerRez"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
