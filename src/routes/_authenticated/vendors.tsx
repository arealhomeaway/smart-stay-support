import { LaunchStateGate } from "@/components/LaunchStateGate";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createVendor, vendorDirectory } from "@/lib/vendors.functions";
import {
  SERVICE_CATEGORIES,
  VENDOR_CLASSES,
  VENDOR_CLASS_LABELS,
  VENDOR_STATUSES,
  VENDOR_STATUS_LABELS,
  type VendorClass,
  type VendorStatus,
} from "@/lib/vendors";
import { useRole } from "@/hooks/useRole";
import { VendorImportPanel } from "@/components/VendorImportPanel";
import { VendorOrgSheet } from "@/components/VendorOrgSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor management — Resolve Operations" },
      {
        name: "description",
        content:
          "Every ARHA vendor company in one place: screening status, insurance and license verification, property coverage maps and legacy list migration.",
      },
      { property: "og:title", content: "Vendor management — Resolve Operations" },
      {
        property: "og:description",
        content: "Screening, coverage and status for every vendor company ARHA works with.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GatedVendorsPage,
});

const STATUS_TONE: Record<VendorStatus, "default" | "secondary" | "destructive" | "outline"> = {
  potential: "outline",
  screening: "secondary",
  trial: "secondary",
  approved: "default",
  restricted: "destructive",
  paused: "outline",
  removed: "outline",
  legacy: "outline",
};

function GatedVendorsPage() {
  return (
    <LaunchStateGate flag="vendor_portal" title="Vendor management is not part of the Operations beta" description="Vendor sourcing, screening and compliance launch as the Vendor Portal workstream. Vendor context on Tickets and Breezeway Work Orders is unaffected.">
      <VendorsPage />
    </LaunchStateGate>
  );
}

function VendorsPage() {
  const qc = useQueryClient();
  const { can } = useRole();
  const canManage = can("vendor_admin");
  const load = useServerFn(vendorDirectory);
  const create = useServerFn(createVendor);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorStatus | "all">("all");
  const [openOrg, setOpenOrg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [vendorClass, setVendorClass] = useState<VendorClass>("company");
  const [category, setCategory] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [emergency, setEmergency] = useState(false);

  const directory = useQuery({ queryKey: ["vendor-directory"], queryFn: () => load() });

  const properties = useQuery({
    queryKey: ["vendor-coverage-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((p) => ({ id: p.id, label: p.nickname || p.name }));
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          displayName,
          legalName: displayName,
          vendorClass,
          serviceCategories: category ? [category] : [],
          markets: [],
          primaryContactName: contactName || null,
          primaryContactEmail: contactEmail || "",
          primaryContactPhone: contactPhone || null,
          website: website || null,
          emergencyAvailable: emergency,
          notes: null,
        },
      }),
    onSuccess: (r) => {
      toast.success("Vendor created as Potential. Screening comes next.");
      setCreateOpen(false);
      setDisplayName("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setWebsite("");
      setCategory("");
      void qc.invalidateQueries({ queryKey: ["vendor-directory"] });
      setOpenOrg(r.orgId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orgs = directory.data?.orgs ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.displayName.toLowerCase().includes(q) ||
        o.serviceCategories.some((c) => c.toLowerCase().includes(q)) ||
        (o.primaryContactEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [orgs, search, statusFilter]);

  const approved = orgs.filter((o) => o.status === "approved").length;
  const needsScreening = orgs.filter((o) => !o.gatekeeperClear && o.status !== "removed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendor management</h1>
          <p className="text-muted-foreground">
            Companies, not contacts. Screening decides who can be dispatched; the coverage map decides where.
          </p>
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a vendor company</DialogTitle>
                <DialogDescription>
                  New vendors start as Potential. They cannot be dispatched until screening clears.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="v-name">Company name</Label>
                  <Input id="v-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={vendorClass} onValueChange={(v) => setVendorClass(v as VendorClass)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VENDOR_CLASSES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {VENDOR_CLASS_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Primary service</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="v-contact">Contact name</Label>
                    <Input id="v-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="v-phone">Phone</Label>
                    <Input id="v-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="v-email">Email</Label>
                  <Input id="v-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="v-web">Website</Label>
                  <Input id="v-web" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Available for emergencies</p>
                    <p className="text-xs text-muted-foreground">After hours and P1 calls.</p>
                  </div>
                  <Switch checked={emergency} onCheckedChange={setEmergency} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={displayName.trim().length < 2 || createMutation.isPending}
                >
                  Create vendor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vendor companies</CardDescription>
            <CardTitle className="text-3xl">{orgs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved for dispatch</CardDescription>
            <CardTitle className="text-3xl">{approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Screening incomplete</CardDescription>
            <CardTitle className="text-3xl">{needsScreening}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          {canManage && <TabsTrigger value="import">Legacy import</TabsTrigger>}
        </TabsList>

        <TabsContent value="directory" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by company, service or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VendorStatus | "all")}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every status</SelectItem>
                {VENDOR_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {VENDOR_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {directory.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {orgs.length === 0
                    ? "No vendor companies yet. Add one, or paste your legacy list under Legacy import."
                    : "No vendors match that filter."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOpenOrg(o.id)}
                  className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{o.displayName}</span>
                    <Badge variant={STATUS_TONE[o.status]}>{VENDOR_STATUS_LABELS[o.status]}</Badge>
                    {!o.gatekeeperClear && (
                      <Badge variant="outline" className="gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Screening open
                      </Badge>
                    )}
                    {o.emergencyAvailable && <Badge variant="secondary">Emergency</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {o.serviceCategories.length > 0 ? o.serviceCategories.join(", ") : "No services recorded"} ·{" "}
                    {o.coverageCount} home{o.coverageCount === 1 ? "" : "s"} covered · {o.memberCount} team member
                    {o.memberCount === 1 ? "" : "s"} · {o.gatekeeperPassed}/{o.gatekeeperTotal} screening items
                  </p>
                  {o.legacyAllGroups && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Legacy "all groups" permission — markets still need verifying.
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="import" className="pt-4">
            <VendorImportPanel />
          </TabsContent>
        )}
      </Tabs>

      <VendorOrgSheet
        orgId={openOrg}
        onOpenChange={(open) => !open && setOpenOrg(null)}
        properties={properties.data ?? []}
        canManage={canManage}
      />
    </div>
  );
}
