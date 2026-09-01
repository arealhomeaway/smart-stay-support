/**
 * Progressive lead capture.
 *
 * Step one is what the person on the phone actually has: a name and a way to
 * reach them. Everything else can be filled in later from the workspace, so a
 * live enquiry is never lost to a long form.
 */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SectionCard } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUserId } from "@/hooks/useTeam";
import { SOURCE_LABELS, type LeadChannel, type LeadSource } from "@/lib/leads";
import type { LeadInsert } from "@/lib/lead-types";

export const Route = createFileRoute("/_authenticated/leads/new")({
  component: NewLead,
});

/** Extra questions worth asking per source — stored as descriptive detail. */
const SOURCE_QUESTIONS: Partial<Record<LeadSource, { key: string; label: string }[]>> = {
  insurance: [
    { key: "carrier", label: "Carrier" },
    { key: "claim_number", label: "Claim number" },
    { key: "adjuster", label: "Adjuster / contact" },
  ],
  relocation: [
    { key: "relocation_company", label: "Relocation company" },
    { key: "coordinator", label: "Coordinator" },
  ],
  corporate: [
    { key: "employer", label: "Employer" },
    { key: "project", label: "Project or assignment" },
  ],
  referral: [{ key: "referred_by", label: "Referred by" }],
  realtor: [{ key: "realtor", label: "Realtor / agency" }],
};

export default function NewLead() {
  const router = useRouter();
  const qc = useQueryClient();
  const userId = useCurrentUserId();

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [channel, setChannel] = useState<LeadChannel>("phone" as LeadChannel);
  const [source, setSource] = useState<LeadSource>("direct");
  const [sourceDetail, setSourceDetail] = useState<Record<string, string>>({});
  const [market, setMarket] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [stayDays, setStayDays] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [budget, setBudget] = useState("");
  const [pets, setPets] = useState(false);
  const [flexible, setFlexible] = useState(false);
  const [requirements, setRequirements] = useState("");
  const [more, setMore] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const payload: LeadInsert = {
        contact_name: contactName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        company: company.trim() || null,
        preferred_channel: channel,
        source,
        source_detail: sourceDetail,
        market: market.trim() || null,
        desired_move_in: moveIn || null,
        length_of_stay_days: stayDays ? Number(stayDays) : null,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        budget_monthly: budget ? Number(budget) : null,
        pets,
        date_flexible: flexible,
        requirements: requirements.trim() || null,
        stage: "new",
        assigned_to: userId,
        created_by: userId,
      };
      const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead captured — it is in your queue.");
      void router.navigate({ to: "/leads" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = contactName.trim().length > 1 && (phone.trim() || email.trim());
  const questions = SOURCE_QUESTIONS[source] ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenant leads"
        title="New lead"
        description="Capture the enquiry in seconds. Anything missing can be added from the lead workspace."
      />

      <SectionCard title="Who is enquiring">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} autoFocus />
          </Field>
          <Field label="Company (optional)">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </Field>
          <Field label="Preferred contact">
            <Select value={channel} onValueChange={(v) => setChannel(v as LeadChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["call", "email", "text", "other"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "call" ? "Phone" : c[0]!.toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Where it came from">
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v as LeadSource);
                setSourceDetail({});
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {questions.map((q) => (
            <Field key={q.key} label={q.label}>
              <Input
                value={sourceDetail[q.key] ?? ""}
                onChange={(e) => setSourceDetail((d) => ({ ...d, [q.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="What they need"
        description="Optional — Resolve will prompt for anything missing when it matters."
        actions={
          <Button variant="ghost" size="sm" className="resolve-press" onClick={() => setMore((m) => !m)}>
            {more ? "Hide details" : "Add details"}
          </Button>
        }
      >
        {more ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Market / area">
              <Input value={market} onChange={(e) => setMarket(e.target.value)} />
            </Field>
            <Field label="Desired move-in">
              <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
            </Field>
            <Field label="Length of stay (days)">
              <Input value={stayDays} onChange={(e) => setStayDays(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Bedrooms">
              <Input value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Monthly budget">
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" />
            </Field>
            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={pets} onCheckedChange={setPets} /> Pets
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={flexible} onCheckedChange={setFlexible} /> Dates flexible
              </label>
            </div>
            <div className="sm:col-span-2">
              <Field label="Requirements / notes">
                <Textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={3} />
              </Field>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Save now and keep the caller moving — stay dates, budget and requirements can be added from the lead.
          </p>
        )}
      </SectionCard>

      <div className="flex gap-2">
        <Button
          className="resolve-press"
          disabled={!canSave || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Saving…" : "Save lead"}
        </Button>
        <Button variant="outline" className="resolve-press" onClick={() => void router.navigate({ to: "/leads" })}>
          Cancel
        </Button>
      </div>
      {!canSave && (
        <p className="text-xs text-muted-foreground">A name plus a phone number or email is enough to save.</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
