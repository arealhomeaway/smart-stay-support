/**
 * Link a home to its canonical owner record (staff only).
 *
 * One owner data path: `property_owners`. The picker searches existing owner
 * records first so a person who owns several homes stays a single record, and
 * only creates a new record when no match exists.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { linkPropertyOwnerFn, searchOwnerRecordsFn } from "@/lib/owner-link.functions";

export function OwnerLinkPanel({
  propertyId,
  hasOwner,
}: {
  propertyId: string;
  hasOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", state: "" });
  const qc = useQueryClient();

  const search = useServerFn(searchOwnerRecordsFn);
  const link = useServerFn(linkPropertyOwnerFn);

  const owners = useQuery({
    queryKey: ["owner-records", q],
    queryFn: () => search({ data: { query: q } }),
    enabled: open && mode === "existing",
  });

  const save = useMutation({
    mutationFn: (vars: { ownerId?: string }) =>
      link({
        data: {
          propertyId,
          ownerId: vars.ownerId ?? null,
          newOwner: vars.ownerId
            ? null
            : {
                name: form.name,
                email: form.email || null,
                phone: form.phone || null,
                city: form.city || null,
                state: form.state || null,
              },
        },
      }),
    onSuccess: async (res) => {
      toast.success(
        res.created
          ? "New owner record created and linked to this home."
          : res.reused
            ? "Matched an existing owner record — no duplicate was created."
            : "Owner of record linked.",
      );
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["property-hub"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not link the owner."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={hasOwner ? "outline" : "default"} size="sm">
          {hasOwner ? "Change owner of record" : "Link owner of record"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Owner of record</DialogTitle>
          <DialogDescription>
            Search the canonical owner list first. Resolve reuses the same owner record when a person
            owns more than one home, so a duplicate is never created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={mode === "existing" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("existing")}
          >
            Existing owner
          </Button>
          <Button
            variant={mode === "new" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("new")}
          >
            New owner
          </Button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email or phone"
              aria-label="Search owner records"
            />
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {owners.isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
              {owners.data?.owners.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No owner record matches. Use “New owner” to create one.
                </p>
              )}
              {owners.data?.owners.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ ownerId: o.id })}
                >
                  <span className="font-medium">{o.name ?? "Unnamed owner"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[o.email, o.phone].filter(Boolean).join(" · ") || "No contact on file"}
                    {o.propertyCount > 0 ? ` · ${o.propertyCount} home(s)` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({});
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Owner name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["city", "City"],
                  ["state", "State"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`owner-${key}`}>{label}</Label>
                  <Input
                    id={`owner-${key}`}
                    value={form[key]}
                    required={key === "name"}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              If this person already exists in the owner list by email or name, Resolve links that
              record instead of creating a second one.
            </p>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Create and link owner"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
