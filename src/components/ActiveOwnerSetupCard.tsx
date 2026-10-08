import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enrollActiveOwner } from "@/lib/owner-welcome.functions";

/**
 * One step for staff: enroll the home, find or create the homeowner's account,
 * link it, open participation when a confirmed closing exists, and queue the
 * welcome email. Safe to repeat — nothing is duplicated.
 */
export function ActiveOwnerSetupCard({ homes }: { homes: { id: string; name: string; location?: string | null }[] }) {
  const qc = useQueryClient();
  const enroll = useServerFn(enrollActiveOwner);
  const [propertyId, setPropertyId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const run = useMutation({
    mutationFn: () => enroll({ data: { propertyId, name, email } }),
    onSuccess: (r) => {
      const parts = [
        r.accountCreated ? "Homeowner account created" : "Existing homeowner account used",
        r.participationOpen ? "participation is open" : "participation opens once a closing is confirmed",
        r.welcomeQueued ? "welcome email queued" : "welcome email was already queued",
      ];
      toast.success(`Active Owner set up — ${parts.join(", ")}.`);
      setPropertyId(""); setName(""); setEmail("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ok = propertyId && name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);
  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><UserCheck className="size-4" /> Set up an Active Owner</span>}
      description="Enrolls the home and the homeowner together. An existing account with this email is reused, never duplicated. The welcome email is queued automatically — there is nothing to send by hand."
      bodyClassName="grid gap-4 md:grid-cols-3"
    >
      <div className="space-y-2">
        <Label>Home</Label>
        <Select value={propertyId} onValueChange={setPropertyId}>
          <SelectTrigger><SelectValue placeholder={homes.length ? "Choose a home" : "Every active home is enrolled"} /></SelectTrigger>
          <SelectContent>
            {homes.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}{p.location ? ` · ${p.location}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ao-name">Homeowner name</Label>
        <Input id="ao-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ao-email">Homeowner email</Label>
        <Input id="ao-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
      </div>
      <div className="md:col-span-3">
        <Button disabled={!ok || run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Setting up…" : "Enroll and link homeowner"}
        </Button>
      </div>
    </SectionCard>
  );
}
