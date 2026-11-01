import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRole } from "@/hooks/useRole";
import { loadBreezewaySending, saveBreezewaySending } from "@/lib/breezeway-sending.functions";
import type { BreezewaySending } from "@/lib/pilot-dispatch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
export function BreezewaySendingPanel() {
 const { isAdmin, readOnly } = useRole();
 const load = useServerFn(loadBreezewaySending), save = useServerFn(saveBreezewaySending);
 const client = useQueryClient();
 const query = useQuery({ queryKey: ["breezeway-sending"], queryFn: () => load(), enabled: isAdmin });
 const [draft, setDraft] = useState<BreezewaySending | null>(null), [search, setSearch] = useState("");
 const mutation = useMutation({ mutationFn: (s: BreezewaySending) => save({ data: s }), onSuccess: async () => { setDraft(null); await client.invalidateQueries({ queryKey: ["breezeway-sending"] }); } });
 if (!isAdmin) return null;
 const setting = draft ?? query.data?.setting;
 const disabled = readOnly || query.data?.pending || mutation.isPending;
 return <section className="space-y-4 border-t border-border py-6">
  <h2 className="text-lg font-semibold">Breezeway sending</h2>
  {query.isPending && <p>Loading sending settings...</p>}
  {query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}
  {query.data?.pending && <p className="text-muted-foreground">Sending settings are awaiting approval. All verified homes remain eligible.</p>}
  {setting && <>
   <Select value={setting.mode} disabled={disabled} onValueChange={mode => setDraft({ ...setting, mode: mode as BreezewaySending["mode"] })}><SelectTrigger className="max-w-sm" aria-label="Breezeway sending mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all_verified">All verified homes</SelectItem><SelectItem value="pilot_only">Pilot homes only</SelectItem></SelectContent></Select>
   <Input className="max-w-sm" aria-label="Find pilot homes" placeholder="Find a home" value={search} onChange={e => setSearch(e.target.value)} />
   <div className="max-h-64 overflow-y-auto space-y-3">{query.data?.homes.filter(h => h.label.toLowerCase().includes(search.toLowerCase())).map(h => <label key={h.id} className="flex items-center gap-3 text-sm"><Checkbox disabled={disabled} checked={setting.homeIds.includes(h.id)} onCheckedChange={checked => setDraft({ ...setting, homeIds: checked ? [...setting.homeIds,h.id] : setting.homeIds.filter(id => id !== h.id) })} />{h.label}</label>)}</div>
   <div className="flex gap-2"><Button disabled={disabled || !draft} onClick={() => mutation.mutate(setting)}>Save sending settings</Button><Button variant="outline" disabled={!draft || mutation.isPending} onClick={() => setDraft(null)}>Cancel</Button></div>
  </>}
  {mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
  <h3 className="font-medium">Sending history</h3>
  {(query.data?.history ?? []).map(h => <div key={h.id} className="border-b border-border py-2 text-sm"><time>{new Date(h.created_at).toLocaleString()}</time><span className="ml-3">{h.after_value?.mode === "pilot_only" ? "Pilot homes only" : "All verified homes"} · {h.after_value?.homeIds?.length ?? 0} pilot homes</span></div>)}
 </section>;
}