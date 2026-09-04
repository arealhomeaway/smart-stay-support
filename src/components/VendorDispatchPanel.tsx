import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { HardHat } from "lucide-react";
import { toast } from "sonner";
import { assignVendor, rankVendors } from "@/lib/vendor.functions";
import { formatKm } from "@/lib/dispatch";
import { TIER_LABEL } from "@/lib/scorecard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  ticketId: string;
  vendorUserId: string | null;
  vendorBrief: string | null;
  vendorStatus: string | null;
  onChanged: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  dispatched: "Sent — waiting on the vendor",
  accepted: "Vendor accepted",
  on_site: "Vendor is on site now",
  completed: "Vendor marked complete",
};

/** Staff-side dispatch: hand a ticket to a vendor and it appears in their portal. */
export function VendorDispatchPanel({
  ticketId,
  vendorUserId,
  vendorBrief,
  vendorStatus,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const rankFn = useServerFn(rankVendors);
  const assignFn = useServerFn(assignVendor);
  const [selected, setSelected] = useState(vendorUserId ?? "");
  const [brief, setBrief] = useState(vendorBrief ?? "");

  const vendors = useQuery({
    queryKey: ["vendors", "ranked", ticketId],
    queryFn: () => rankFn({ data: { ticketId } }),
  });

  const save = useMutation({
    mutationFn: (vars: { vendorUserId: string | null }) =>
      assignFn({ data: { ticketId, vendorUserId: vars.vendorUserId, brief } }),
    onSuccess: () => {
      toast.success("Vendor updated.");
      void qc.invalidateQueries({ queryKey: ["vendors"] });
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the vendor"),
  });

  const list = vendors.data?.candidates ?? [];
  const hasHomePin = vendors.data?.hasHomePin ?? false;
  const best = list[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardHat className="size-4" /> Vendor dispatch
          {vendorStatus && vendorStatus !== "none" && (
            <Badge variant="outline">{STATUS_LABEL[vendorStatus] ?? vendorStatus}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Send this to a vendor and it lands in their portal with the address, access notes and the
          required steps — no separate text thread to chase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vendor logins yet. Have the vendor sign up, then set them to “Vendor” on the Seats
            page.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best fit first — distance, scorecard and current load
              </p>
              {!hasHomePin && (
                <p className="text-xs text-muted-foreground">
                  This home has no map pin yet, so ranking is on scorecard and workload only.
                </p>
              )}
              <div className="space-y-2">
                {list.slice(0, 4).map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelected(v.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selected === v.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{v.name}</span>
                      <span className="flex items-center gap-1">
                        {i === 0 && v.id === best?.id && <Badge>Recommended</Badge>}
                        {v.tier === "gold" && <Badge variant="secondary">Gold Standard</Badge>}
                        {v.tier === "trusted" && (
                          <Badge variant="outline">{TIER_LABEL.trusted}</Badge>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {v.distanceM != null ? `${formatKm(v.distanceM)} away · ` : ""}
                      {v.reasons.slice(1).join(" · ")}
                    </p>
                  </button>
                ))}
              </div>
              {list.length > 4 && (
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger>
                    <SelectValue placeholder="Or pick another vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {list.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="What you need done, what good looks like, and anything not to do — e.g. do not leave the wall open, seal and paint before you leave."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!selected || save.isPending}
                onClick={() => save.mutate({ vendorUserId: selected })}
              >
                {vendorUserId ? "Update dispatch" : "Dispatch to vendor"}
              </Button>
              {vendorUserId && (
                <Button
                  variant="ghost"
                  disabled={save.isPending}
                  onClick={() => {
                    setSelected("");
                    save.mutate({ vendorUserId: null });
                  }}
                >
                  Unassign
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
