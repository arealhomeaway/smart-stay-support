import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InquirySourceForm } from "@/components/InquirySourceForm";
import { formatMoney } from "@/lib/pricing";
import { searchSources, type InquirySource } from "@/lib/inquiry-sources";
import { INQUIRY_SOURCE_COLUMNS, mapInquirySource } from "@/lib/inquiry-sources.data";

export const Route = createFileRoute("/_authenticated/inquiry-sources")({
  head: () => ({
    meta: [
      { title: "Inquiry Sources | ARHA Resolve" },
      { name: "description", content: "Booking sources and their standing fee, referral and deposit settings." },
      { property: "og:title", content: "Inquiry Sources | ARHA Resolve" },
      { property: "og:description", content: "Booking sources and their standing fee, referral and deposit settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InquirySourcesPage,
});

export function useInquirySources() {
  return useQuery({
    queryKey: ["inquiry-sources"],
    queryFn: async (): Promise<InquirySource[]> => {
      const { data, error } = await supabase.from("inquiry_sources").select(INQUIRY_SOURCE_COLUMNS).order("name");
      if (error) throw error;
      return (data ?? []).map((row) => mapInquirySource(row as Record<string, unknown>));
    },
  });
}

function amount(value: number | null) {
  return value === null ? <span className="text-muted-foreground">—</span> : formatMoney(value);
}

function InquirySourcesPage() {
  const { can, isLoading } = useRole();
  const allowed = can("work_orders_internal");
  const sources = useInquirySources();
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<InquirySource | null>(null);
  const [adding, setAdding] = useState(false);
  const all = sources.data ?? [];
  const shown = term.trim()
    ? searchSources(all.map((source) => ({ ...source, active: true })), term).map((match) => all.find((source) => source.id === match.id)!)
    : all;

  if (isLoading) return <p role="status" className="p-6">Checking access…</p>;
  if (!allowed) return <p role="alert" className="p-6">Inquiry Sources is for authorized Operations staff only.</p>;

  return <div className="space-y-6 p-4 md:p-6">
    <PageHeader title="Inquiry Sources" description="Every company, portal and partner we take bookings through, with the fees, referral terms and documents that apply. Blank means not recorded; $0 means zero." />
    <div className="flex flex-wrap items-center gap-3">
      <Input className="max-w-sm" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search sources" aria-label="Search sources" />
      <Button onClick={() => setAdding(true)}>Add inquiry source</Button>
    </div>
    {sources.isPending && <p role="status">Loading sources…</p>}
    {sources.error && <p role="alert" className="text-destructive">The sources could not be loaded.</p>}
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-3">Source</th><th className="p-3">Type</th><th className="p-3">Discount</th>
            <th className="p-3">Referral</th><th className="p-3">Cleaning</th><th className="p-3">Application</th>
            <th className="p-3">Deposit</th><th className="p-3">Pet fee</th><th className="p-3">Utilities</th><th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {shown.map((source) => <tr key={source.id} className="border-t align-top">
            <td className="p-3 font-medium">{source.name}{!source.active && <span className="ml-2 text-xs text-muted-foreground">(not in use)</span>}
              {source.pricingFlags && <p className="mt-1 max-w-sm text-xs text-amber-700">{source.pricingFlags}</p>}
            </td>
            <td className="p-3">{source.sourceType ?? "—"}</td>
            <td className="p-3">{source.discountPercent === null ? "—" : `${source.discountPercent}%`}</td>
            <td className="p-3">{source.referralPercent === null && source.referralFee === null ? "—" : [
              source.referralPercent === null ? null : `${source.referralPercent}%/month`,
              source.referralFee === null ? null : `${formatMoney(source.referralFee)}/month`,
            ].filter(Boolean).join(" · ")}
              {source.referralRule && <p className="text-xs text-muted-foreground">{source.referralRule}</p>}
            </td>
            <td className="p-3">{amount(source.cleaningFee)}</td>
            <td className="p-3">{amount(source.applicationFee)}</td>
            <td className="p-3">{amount(source.securityDeposit)}</td>
            <td className="p-3">{formatMoney(source.petFeePerPet)}/pet</td>
            <td className="p-3">{source.utilitiesIncluded === null ? "—" : source.utilitiesIncluded ? "Yes" : "No"}</td>
            <td className="p-3"><Button size="sm" variant="outline" onClick={() => setEditing(source)}>Edit</Button></td>
          </tr>)}
          {!shown.length && !sources.isPending && <tr><td className="p-6 text-muted-foreground" colSpan={10}>No sources match that search.</td></tr>}
        </tbody>
      </table>
    </div>

    <Dialog open={adding || Boolean(editing)} onOpenChange={(open) => { if (!open) { setAdding(false); setEditing(null); } }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : "Add inquiry source"}</DialogTitle></DialogHeader>
        <InquirySourceForm
          {...(editing ? { source: editing } : {})}
          onSaved={() => { setAdding(false); setEditing(null); void sources.refetch(); }}
          onCancel={() => { setAdding(false); setEditing(null); }}
        />
      </DialogContent>
    </Dialog>
  </div>;
}
