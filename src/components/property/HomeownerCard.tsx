/**
 * The homeowner on a home — visible wherever staff work the property.
 *
 * One owner data path: the canonical `property_owners` record. Staff can add
 * an owner (search first, create only when no match exists) or edit the one on
 * file, including a second person on the home.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Phone, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OwnerLinkPanel } from "@/components/OwnerLinkPanel";
import { readPropertyOwnerFn, updateOwnerRecordFn } from "@/lib/owner-link.functions";

type Form = {
  name: string;
  email: string;
  phone: string;
  coOwnerName: string;
  coOwnerEmail: string;
  coOwnerPhone: string;
};

const EMPTY: Form = {
  name: "",
  email: "",
  phone: "",
  coOwnerName: "",
  coOwnerEmail: "",
  coOwnerPhone: "",
};

export function HomeownerCard({
  propertyId,
  canManage = true,
}: {
  propertyId: string;
  canManage?: boolean;
}) {
  const qc = useQueryClient();
  const read = useServerFn(readPropertyOwnerFn);
  const update = useServerFn(updateOwnerRecordFn);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  const q = useQuery({
    queryKey: ["property-owner", propertyId],
    queryFn: () => read({ data: { propertyId } }),
  });
  const owner = q.data?.owner ?? null;

  useEffect(() => {
    if (!owner) return;
    setForm({
      name: owner.name ?? "",
      email: owner.email ?? "",
      phone: owner.phone ?? "",
      coOwnerName: owner.coOwnerName ?? "",
      coOwnerEmail: owner.coOwnerEmail ?? "",
      coOwnerPhone: owner.coOwnerPhone ?? "",
    });
  }, [owner?.id, owner?.name, owner?.email, owner?.phone, owner?.coOwnerName]);

  const save = useMutation({
    mutationFn: () => update({ data: { ownerId: owner!.id, ...form } }),
    onSuccess: async () => {
      toast.success("Homeowner details saved.");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["property-owner", propertyId] });
      await qc.invalidateQueries({ queryKey: ["property-hub"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Those details could not be saved."),
  });

  return (
    <section className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <p className="eyebrow">Homeowner</p>
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            {owner && (
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                Edit details
              </Button>
            )}
            <OwnerLinkPanel propertyId={propertyId} hasOwner={Boolean(owner)} />
          </div>
        )}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the homeowner…</p>
      ) : owner ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium">{owner.name ?? "Unnamed owner"}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="size-3.5" />
              {owner.email ?? "No email on file"}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5" />
              {owner.phone ?? "No phone on file"}
            </p>
            {owner.propertyCount > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Owns {owner.propertyCount} homes with ARHA
              </p>
            )}
          </div>
          <div>
            <p className="font-medium">
              {owner.coOwnerName ?? <span className="text-muted-foreground">No second owner</span>}
            </p>
            {owner.coOwnerName && (
              <>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5" />
                  {owner.coOwnerEmail ?? "No email on file"}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="size-3.5" />
                  {owner.coOwnerPhone ?? "No phone on file"}
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <UserPlus className="size-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No homeowner is on file for this home yet. Add one so approvals, emails and the Active
            Owner program have someone to reach.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Homeowner details</DialogTitle>
            <DialogDescription>
              These details are shared by every home this owner has with ARHA.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
            <div className="sm:col-span-2 pt-2 text-sm font-medium">Second owner (optional)</div>
            <Field
              label="Name"
              value={form.coOwnerName}
              onChange={(v) => setForm({ ...form, coOwnerName: v })}
            />
            <Field
              label="Email"
              value={form.coOwnerEmail}
              onChange={(v) => setForm({ ...form, coOwnerEmail: v })}
            />
            <Field
              label="Phone"
              value={form.coOwnerPhone}
              onChange={(v) => setForm({ ...form, coOwnerPhone: v })}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={form.name.trim().length < 2 || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
