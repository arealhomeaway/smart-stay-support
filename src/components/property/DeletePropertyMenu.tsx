import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { propertyDeleteAccessFn, checkPropertyDeleteFn, deletePropertyFn } from "@/lib/property-delete.functions";
import { canShowPropertyDelete, validPropertyDeleteConfirmation } from "@/lib/property-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function DeletePropertyMenu({ propertyId, lifecycle }: { propertyId: string; lifecycle: string | null }) {
  const { userId, readOnly } = useRole();
  const accessFn = useServerFn(propertyDeleteAccessFn);
  const checkFn = useServerFn(checkPropertyDeleteFn);
  const deleteFn = useServerFn(deletePropertyFn);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const access = useQuery({ queryKey: ["property-delete-access", userId, propertyId], queryFn: () => accessFn({ data: { propertyId } }), enabled: Boolean(userId) && !readOnly && lifecycle === "onboarding" });
  const check = useQuery({ queryKey: ["property-delete-check", propertyId], queryFn: () => checkFn({ data: { propertyId } }), enabled: open, staleTime: 0, retry: false });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { propertyId, address: typed.trim(), reason: reason.trim() } }),
    onSuccess: async () => {
      setOpen(false);
      toast.success("Property deleted. The Audit history entry is saved.");
      await qc.invalidateQueries();
      await navigate({ to: "/onboarding" });
    },
    onError: (error: Error) => { toast.error(error.message); void check.refetch(); },
  });
  if (!canShowPropertyDelete(access.data?.allowed === true, lifecycle, readOnly)) return null;
  const checked = check.data;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" className="min-h-11">More actions <ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-11 text-destructive focus:text-destructive" onSelect={() => { setTyped(""); setReason(""); remove.reset(); setOpen(true); }}><Trash2 className="size-4" />Delete property</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={open} onOpenChange={(next) => { if (!remove.isPending) setOpen(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Delete property</DialogTitle><DialogDescription>This removes the home and its onboarding plan for good. It can't be undone.</DialogDescription></DialogHeader>
        {check.isPending ? <p role="status">Checking this home...</p> : check.isError ? <p role="alert" className="text-destructive">{check.error.message}</p> : checked ? <>
          <p className="break-words font-medium">{checked.address}</p>
          {!checked.allowed ? <div role="alert" className="space-y-2"><ul className="list-disc space-y-1 pl-5">{checked.reasons.map((r) => <li key={r}>{r}</li>)}</ul><p>Use Offboard instead.</p></div> : <>
            <div className="space-y-2"><Label htmlFor="delete-property-address">Type the home's address</Label><Input id="delete-property-address" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={remove.isPending} /></div>
            <div className="space-y-2"><Label htmlFor="delete-property-reason">Reason</Label><Textarea id="delete-property-reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={remove.isPending} /></div>
          </>}
        </> : null}
        <DialogFooter>
          <Button variant="outline" className="min-h-11" disabled={remove.isPending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" className="min-h-11" disabled={!checked?.allowed || !validPropertyDeleteConfirmation(checked.address, typed, reason) || remove.isPending || check.isFetching} onClick={() => remove.mutate()}><Trash2 className="size-4" />{remove.isPending ? "Deleting..." : "Delete property"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}