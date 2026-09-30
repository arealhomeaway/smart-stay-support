import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { createVendor } from "@/lib/vendors.functions";
import { VENDOR_CLASSES, VENDOR_CLASS_LABELS, type VendorClass } from "@/lib/vendors";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorDirectory } from "@/components/vendors/VendorDirectory";
import { VendorDatabase } from "@/components/vendors/VendorDatabase";
import { VendorGoldStandard } from "@/components/vendors/VendorGoldStandard";
import { VendorMarketCoverage } from "@/components/vendors/VendorMarketCoverage";
import { VendorNeedsReview } from "@/components/vendors/VendorNeedsReview";
import { useInvalidateVendors, useVendorWorkspace } from "@/components/vendors/useVendorWorkspace";

const TABS = ["directory", "database", "gold", "coverage", "review"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/vendors/")({
  validateSearch: z.object({ tab: z.enum(TABS).optional() }),
  head: () => ({
    meta: [
      { title: "Vendors — Resolve Operations" },
      {
        name: "description",
        content:
          "ARHA's canonical vendor records: frontline directory, leadership database, Gold Standard gates and market coverage.",
      },
      { property: "og:title", content: "Vendors — Resolve Operations" },
      { property: "og:description", content: "Find the right vendor fast, and keep every vendor record in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VendorsWorkspace,
});

function VendorsWorkspace() {
  const { tab = "directory" } = Route.useSearch();
  const navigate = useNavigate({ from: "/vendors/" });
  const { can, roles, readOnly } = useRole();
  const canManage = can("vendor_admin") && !readOnly;
  const isLead = roles.includes("admin");
  const current: Tab = tab === "database" && !canManage ? "directory" : tab;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Vendors"
        description="One record per vendor. Every tab below is a different view of the same records."
        actions={canManage ? <CreateVendorDialog /> : undefined}
      />
      <Tabs value={current} onValueChange={(v) => void navigate({ search: { tab: v as Tab } })}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="directory">Directory</TabsTrigger>
          {canManage && <TabsTrigger value="database">Database</TabsTrigger>}
          <TabsTrigger value="gold">Gold Standard</TabsTrigger>
          <TabsTrigger value="coverage">Market Coverage</TabsTrigger>
          <TabsTrigger value="review">Needs Review</TabsTrigger>
        </TabsList>
        <TabsContent value="directory" className="pt-4"><VendorDirectory /></TabsContent>
        {canManage && (
          <TabsContent value="database" className="pt-4"><VendorDatabase canManage={canManage} isLead={isLead} /></TabsContent>
        )}
        <TabsContent value="gold" className="pt-4"><VendorGoldStandard /></TabsContent>
        <TabsContent value="coverage" className="pt-4"><VendorMarketCoverage /></TabsContent>
        <TabsContent value="review" className="pt-4"><VendorNeedsReview canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

function CreateVendorDialog() {
  const create = useServerFn(createVendor);
  const invalidate = useInvalidateVendors();
  const ws = useVendorWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cls, setCls] = useState<VendorClass>("company");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emergency, setEmergency] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          displayName: name,
          legalName: name,
          vendorClass: cls,
          serviceCategories: category ? [category] : [],
          markets: [],
          primaryContactName: contact || null,
          primaryContactEmail: email || "",
          primaryContactPhone: phone || null,
          website: null,
          emergencyAvailable: emergency,
          notes: null,
        },
      }),
    onSuccess: () => {
      toast.success("Vendor added as a Candidate.");
      setOpen(false);
      setName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Add vendor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a vendor</DialogTitle>
          <DialogDescription>New vendors start as Candidate and cannot be dispatched until qualified.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="v-name">Company name</Label><Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={cls} onValueChange={(v) => setCls(v as VendorClass)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_CLASSES.map((c) => <SelectItem key={c} value={c}>{VENDOR_CLASS_LABELS[c]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Primary service</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Pick a service" /></SelectTrigger>
              <SelectContent>{(ws.data?.categories ?? []).map((c) => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="v-contact">Contact name</Label><Input id="v-contact" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="v-phone">Phone</Label><Input id="v-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="v-email">Email</Label><Input id="v-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <p className="text-sm font-medium">Available for emergencies</p>
            <Switch checked={emergency} onCheckedChange={setEmergency} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={name.trim().length < 2 || m.isPending}>Create vendor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
