/** Admin tools: refresh property info and photos from OwnerRez now. It also runs every night. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { syncPropertyEnrichment } from "@/lib/property-enrichment.functions";

export function PropertyRefreshPanel({ disabled = false }: { disabled?: boolean }) {
  const qc = useQueryClient();
  const run = useServerFn(syncPropertyEnrichment);
  const [busy, setBusy] = useState(false);
  return (
    <SectionCard
      title="Property info and photos"
      description="Home facts, listing photos and owner records come from OwnerRez every night at 3 AM Central."
      actions={
        <Button
          className="min-h-11"
          variant="outline"
          disabled={busy || disabled}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await run();
              if (res.ok) toast.success(res.message);
              else toast.error(res.message);
              await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "The refresh did not go through.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Refreshing…" : "Refresh property info and photos"}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">Use this when a home changed in OwnerRez and you need it now.</p>
    </SectionCard>
  );
}
