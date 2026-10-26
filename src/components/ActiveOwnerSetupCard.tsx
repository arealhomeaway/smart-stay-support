import { useState } from "react";
import { UserCheck } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActiveOwnerEnrollForm } from "./property/ActiveOwnerEnrollForm";

/** The portfolio shortcut opens the same property enrollment window, never a second action. */
export function ActiveOwnerSetupCard({ homes }: { homes: { id: string; name: string; location?: string | null }[] }) {
  const [propertyId, setPropertyId] = useState("");
  const home = homes.find((p) => p.id === propertyId);
  return <SectionCard title={<span className="flex items-center gap-2"><UserCheck className="size-4" /> Set up an Active Owner</span>}>
    <div className="space-y-3"><Select value={propertyId} onValueChange={setPropertyId}>
      <SelectTrigger><SelectValue placeholder={homes.length ? "Choose a home" : "Every active home is enrolled"} /></SelectTrigger>
      <SelectContent>{homes.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.location ? ` · ${p.location}` : ""}</SelectItem>)}</SelectContent>
    </Select>
    {home ? <ActiveOwnerEnrollForm propertyId={home.id} propertyName={home.name} /> : null}</div>
  </SectionCard>;
}
