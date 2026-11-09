/**
 * The OwnerRez listing for one home. Moved here from every card on the
 * Properties list (board PropertiesList); it writes the same field the list
 * wrote before.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listOwnerRezListings } from "@/lib/ownerrez.functions";
import { SectionCard } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OwnerRezListingCard({
  propertyId,
  listingId,
  canEdit,
}: {
  propertyId: string;
  listingId: string | null;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const fetchListings = useServerFn(listOwnerRezListings);
  const listings = useQuery({
    queryKey: ["ownerrez-listings"],
    queryFn: () => fetchListings(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: canEdit,
  });

  async function link(next: string) {
    const { error } = await supabase
      .from("properties")
      .update({
        ownerrez_property_id: next === "none" ? null : next,
        ownerrez_synced_at: new Date().toISOString(),
      })
      .eq("id", propertyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next === "none" ? "Unlinked from OwnerRez." : "Linked to OwnerRez.");
    await qc.invalidateQueries({ queryKey: ["property-hub", propertyId] });
    await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
  }

  const data = listings.data;
  const current = data?.ok ? data.data.find((l) => l.id === listingId) : undefined;

  return (
    <SectionCard title="OwnerRez listing">
      {!canEdit ? (
        <p className="text-sm">{listingId ? `Linked (${listingId})` : "Not linked"}</p>
      ) : data?.ok ? (
        <Select value={listingId ?? "none"} onValueChange={(v) => void link(v)}>
          <SelectTrigger className="min-h-11 max-w-md" aria-label="OwnerRez listing">
            <SelectValue placeholder="Not linked">{current ? current.name : listingId ? `Listing ${listingId}` : "Not linked"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not linked</SelectItem>
            {data.data.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
                {l.location ? `, ${l.location}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm text-muted-foreground">
          {data && !data.ok ? data.error : "Checking OwnerRez…"}
        </p>
      )}
    </SectionCard>
  );
}
