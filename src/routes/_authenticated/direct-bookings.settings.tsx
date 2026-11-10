import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getDirectBookingSettings, saveDirectBookingSettings } from "@/lib/direct-bookings.functions";

export const Route = createFileRoute("/_authenticated/direct-bookings/settings")({
  head: () => ({
    meta: [
      { title: "Direct Bookings settings | ARHA Resolve" },
      { name: "description", content: "Nightly rates, the approval period and the overnight reply clock for Direct Bookings replies." },
      { property: "og:title", content: "Direct Bookings settings | ARHA Resolve" },
      { property: "og:description", content: "Nightly rates and the approval period for Direct Bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="leads_work" title="Direct Bookings settings">
      <SettingsPage />
    </RequireCapability>
  ),
});

const BEDROOMS = ["2", "3", "4", "5"];

function SettingsPage() {
  const get = useServerFn(getDirectBookingSettings);
  const save = useServerFn(saveDirectBookingSettings);
  const { data, refetch } = useQuery({ queryKey: ["direct-booking-settings"], queryFn: () => get() });
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [after, setAfter] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [clockStart, setClockStart] = useState("09:00");
  useEffect(() => {
    if (!data) return;
    setStart(data.settings.approvalStart);
    setEnd(data.settings.approvalEnd);
    setAfter(data.settings.requireApprovalAfterEnd);
    setClockStart(data.settings.overnightClockStart);
    setRates(Object.fromEntries(BEDROOMS.map((b) => [b, data.settings.nightlyRates[b]?.toString() ?? ""])));
  }, [data]);
  const canEdit = Boolean(data?.canEdit);
  return (
    <div className="space-y-5">
      <div><Button variant="outline" className="min-h-11 border-primary px-4 font-semibold text-primary" asChild><Link to="/direct-bookings">Back to Direct Bookings</Link></Button></div>
      <PageHeader title="Direct Bookings settings" description={canEdit ? "The Operations Supervisor, the Director of Operations and Admin can change these." : "Only the Operations Supervisor, the Director of Operations and Admin can change these."} />
      <SectionCard title="Approval period" description="During these dates every reply waits for the Operations Supervisor before it sends.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Starts</Label><Input className="h-11" type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={!canEdit} /></div>
          <div className="space-y-1"><Label>Ends</Label><Input className="h-11" type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!canEdit} /></div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <Switch checked={after} onCheckedChange={setAfter} disabled={!canEdit} />
          Require approval after the period ends
        </label>
        <p className="mt-1 text-xs text-muted-foreground">When this is off, replies send straight away after the period. The Operations Supervisor gets a copy and a daily list.</p>
      </SectionCard>
      <SectionCard title="Nightly rates" description="Monthly rent is the nightly rate times 30. Leave blank if not set; those homes cannot be sent.">
        <div className="grid gap-3 sm:grid-cols-4">
          {BEDROOMS.map((b) => (
            <div key={b} className="space-y-1">
              <Label>{b} bedrooms</Label>
              <Input className="h-11" type="number" value={rates[b] ?? ""} onChange={(e) => setRates((r) => ({ ...r, [b]: e.target.value }))} disabled={!canEdit} placeholder="Not set" />
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Overnight requests" description="For requests that arrive overnight.">
        <div className="max-w-xs space-y-1">
          <Label htmlFor="overnight-clock-start">Overnight reply clock starts at</Label>
          <Input id="overnight-clock-start" className="h-11" type="time" value={clockStart} onChange={(e) => setClockStart(e.target.value)} disabled={!canEdit} />
        </div>
      </SectionCard>
      {canEdit ? (
        <div className="flex justify-end">
          <Button
            className="min-h-11 px-5 font-semibold"
            onClick={async () => {
              try {
                const nightlyRates = Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
                await save({ data: { approvalStart: start, approvalEnd: end, requireApprovalAfterEnd: after, nightlyRates, overnightClockStart: clockStart } });
                toast.success("Saved.");
                refetch();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save.");
              }
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}
