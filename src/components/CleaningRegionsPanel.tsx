import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { cleaningRegions, assignCleaningManager } from "@/lib/quarterly.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const UNASSIGNED = "__none__";

/** Pairs each market with the regional cleaning manager who conducts its inspections. */
export function CleaningRegionsPanel() {
  const qc = useQueryClient();
  const load = useServerFn(cleaningRegions);
  const assign = useServerFn(assignCleaningManager);

  const regions = useQuery({ queryKey: ["cleaning-regions"], queryFn: () => load() });

  const save = useMutation({
    mutationFn: (vars: { market: string; managerId: string | null }) => assign({ data: vars }),
    onSuccess: (r) => {
      toast.success(
        r.managerName
          ? `${r.managerName} will inspect ${r.market}.`
          : `${r.market} has no regional cleaning manager.`,
      );
      void qc.invalidateQueries({ queryKey: ["cleaning-regions"] });
      void qc.invalidateQueries({ queryKey: ["quarterly-reviews"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save that assignment"),
  });

  const staff = regions.data?.staff ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-5" /> Regional cleaning managers
        </CardTitle>
        <CardDescription>
          Every inspection is opened for the manager who covers that market — automatically, as each date arrives.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {regions.isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : (
          (regions.data?.regions ?? []).map((region) => (
            <div
              key={region.market}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div>
                <p className="font-medium">{region.market}</p>
                <p className="text-xs text-muted-foreground">
                  {region.propertyCount} home{region.propertyCount === 1 ? "" : "s"}
                </p>
              </div>
              <Select
                value={region.managerId ?? UNASSIGNED}
                onValueChange={(value) =>
                  save.mutate({ market: region.market, managerId: value === UNASSIGNED ? null : value })
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>No manager assigned</SelectItem>
                  {staff.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
