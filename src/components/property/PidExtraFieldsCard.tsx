/**
 * From the PID: PID fields with no place on the property page, read-only, labeled with the date of
 * the copy (src/lib/pid-sync/extras.ts decides which fields). Hidden until the first copy exists.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usCalendarDate } from "@/lib/dates";
import type { ExtraValue } from "@/lib/pid-sync/extras";
import { useFeatureFlags } from "@/lib/feature-flags";
import { LoadError } from "@/components/ui/page";

type Row = { field_name: string; value: ExtraValue; synced_on: string; as_of: string };

export function PidExtraFieldsCard({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(true);
  // The switch row arrives with the staged tables; before that there is nothing to read.
  const setUp = useFeatureFlags().flags.some((f) => f.key === "pid_nightly_sync");
  const q = useQuery({
    queryKey: ["pid-extra-fields", propertyId],
    enabled: setUp,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("property_pid_extra_fields")
        .select("field_name, value, synced_on, as_of")
        .eq("property_id", propertyId)
        .order("field_name");
      if (error) {
        // Table not there yet: nothing to show. Any other failure is shown.
        const code = (error as { code?: string }).code;
        if (code === "42P01" || code === "PGRST205") return null;
        throw error;
      }
      return (data ?? []) as Row[];
    },
  });
  if (q.isError) {
    return (
      <section id="hp-pid" className="surface scroll-mt-24 p-4">
        <p className="mb-2 text-base font-semibold">From the PID</p>
        <LoadError what="This section" onRetry={() => void q.refetch()} />
      </section>
    );
  }
  if (!q.data || q.data.length === 0) return null;
  const synced = q.data.map((r) => r.synced_on).sort().at(-1) ?? null;

  return (
    <section id="hp-pid" className="surface scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-11 flex-1 items-center gap-2 text-left text-base font-semibold"
        >
          {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          From the PID
        </button>
        <span className="text-xs text-muted-foreground">As of {usCalendarDate(synced)}</span>
      </div>
      {open ? (
        <dl className="divide-y divide-border/60 border-t border-border px-4 py-3">
          {q.data.map((r) => (
            <div key={r.field_name} className="grid gap-1 py-2 sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:gap-4">
              <dt className="text-sm font-medium">{r.field_name}</dt>
              <dd className="min-w-0 text-sm">
                <ExtraValueView name={r.field_name} value={r.value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function ExtraValueView({ name, value }: { name: string; value: ExtraValue }) {
  switch (value.type) {
    case "text":
      return <span className="whitespace-pre-line break-words">{value.text}</span>;
    case "list":
      return value.items.length === 1 ? (
        <span className="break-words">{value.items[0]}</span>
      ) : (
        <ul className="list-disc space-y-0.5 pl-5">{value.items.map((x, i) => <li key={i} className="break-words">{x}</li>)}</ul>
      );
    case "url":
      return (
        <a href={value.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-primary underline">
          Open {name}
        </a>
      );
    case "files": {
      const noun = /photo|chip/i.test(name) ? "photo" : "file";
      return <span>{value.count} {noun}{value.count === 1 ? "" : "s"} in the PID</span>;
    }
  }
}
