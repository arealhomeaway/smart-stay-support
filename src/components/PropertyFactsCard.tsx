import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPropertyFactsFn } from "@/lib/property-facts.functions";
import { AMENITY_LABELS, AMENITY_SPECS, petSummary } from "@/lib/property-facts";

/** Read-only view of the pet and amenity answers published for this home. */
export function PropertyFactsCard({ propertyId }: { propertyId: string }) {
  const load = useServerFn(getPropertyFactsFn);
  const query = useQuery({
    queryKey: ["property-facts", propertyId],
    queryFn: () => load({ data: { propertyId } }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return <Card>
    <CardHeader>
      <CardTitle>Pets &amp; amenities</CardTitle>
      <CardDescription>Published details for this home. Anything not confirmed here is never offered against a guest requirement.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {query.isPending && <Skeleton className="h-24 w-full" />}
      {query.error && <p role="alert" className="text-destructive">These details could not be read right now.</p>}
      {query.data && !query.data.linked && <p className="text-muted-foreground">This home is not linked to a listing yet, so no pet or amenity details are confirmed.</p>}
      {query.data?.linked && <>
        {query.data.unavailableReason && <p className="text-amber-700">{query.data.unavailableReason}</p>}
        <p className="font-medium">{petSummary(query.data.facts)}</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {AMENITY_SPECS.map((spec) => {
            const value = query.data.facts.amenities[spec.key];
            return <li key={spec.key} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
              <span>{AMENITY_LABELS[spec.key]}</span>
              <span className={value === true ? "text-emerald-700 dark:text-emerald-400" : value === false ? "text-muted-foreground" : "text-amber-700"}>
                {value === true ? "Yes" : value === false ? "No" : "Not confirmed"}
              </span>
            </li>;
          })}
        </ul>
      </>}
    </CardContent>
  </Card>;
}
