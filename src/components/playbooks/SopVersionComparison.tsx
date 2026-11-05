import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AuthoredPlaybook } from "@/lib/playbooks";
export function SopVersionComparison({ active, draft }: { active: AuthoredPlaybook; draft: AuthoredPlaybook }) {
 const steps = useQuery({ queryKey: ["sop-compare-steps", active.id, draft.id], queryFn: async () => {
  const result = await supabase.from("playbook_steps").select("playbook_id,instruction,detail,required").in("playbook_id", [active.id,draft.id]).order("position");
  if(result.error) throw result.error; return result.data;
 }});
 return <div className="grid grid-cols-1 gap-4 border-y border-border py-4 sm:grid-cols-2">{[active,draft].map((p,i)=><section key={p.id} className="min-w-0 space-y-2 text-sm"><h3 className="font-medium">{i===0 ? "Active version" : "Suggested draft"} v{p.version}</h3><p>{p.title}</p><p>{p.summary}</p><p className="font-medium">Consider</p>{p.risk_flags.map((r,n)=><p key={n}>{r.title}{r.why ? `: ${r.why}` : ""}</p>)}<p className="font-medium">Do first</p>{p.immediate_actions.map((s,n)=><p key={n}>{s}</p>)}<p className="font-medium">Escalate if</p>{p.escalate_if.map((s,n)=><p key={n}>{s}</p>)}<p className="font-medium">Required evidence</p>{p.required_evidence.map((s,n)=><p key={n}>{s}</p>)}<p className="font-medium">Ordered steps</p>{steps.data?.filter(s=>s.playbook_id===p.id).map((s,n)=><p key={n}>{n+1}. {s.instruction}{s.required ? " (required)" : ""}{s.detail ? `: ${s.detail}` : ""}</p>)}{steps.isError && <p role="alert" className="text-destructive">Could not load comparison steps.</p>}</section>)}</div>;
}
