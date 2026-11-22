import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { getMyTimeZoneFn, setMyTimeZoneFn } from "@/lib/time-zone.functions";

const COMMON = ["America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "America/Tegucigalpa", "America/Mexico_City", "America/Bogota", "Asia/Manila"];

/** Your time zone: daily reminders arrive at 8 AM here. Shown once the setting exists. */
export function TimeZoneField() {
  const get = useServerFn(getMyTimeZoneFn);
  const set = useServerFn(setMyTimeZoneFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-time-zone"], queryFn: () => get() });
  const save = useMutation({
    mutationFn: (timeZone: string) => set({ data: { timeZone } }),
    onSuccess: () => {
      toast.success("Time zone saved.");
      void qc.invalidateQueries({ queryKey: ["my-time-zone"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return [...COMMON, ...all.filter((z) => !COMMON.includes(z))];
  }, []);
  if (!q.data?.ready) return null;
  return (
    <div className="space-y-2">
      <Label htmlFor="account-time-zone">Time zone</Label>
      <select
        id="account-time-zone"
        className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={q.data.timeZone ?? "America/Chicago"}
        disabled={save.isPending}
        onChange={(e) => save.mutate(e.target.value)}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
