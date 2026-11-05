// Writes docs/pending/ticket-checklists/02_seed_ticket_checklists.sql from src/lib/ticket-checklist-seed.ts.
import { writeFileSync } from "node:fs";
import { SEED_TEMPLATES } from "../src/lib/ticket-checklist-seed";
import { CHECKLIST_CATEGORIES, templateProblems } from "../src/lib/ticket-checklists";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const lines = [
  "-- Seed data, not a schema change: run with the data tool after 01 is applied.",
  "-- Six version-1 checklists from Emily's draft, plus one switch per category (all off).",
  "SELECT set_config('resolve.checklist_publish', 'on', true);",
];
for (const t of SEED_TEMPLATES) {
  const p = templateProblems(t);
  if (p.length) throw new Error(`${t.category}: ${p.join("; ")}`);
  const body = JSON.stringify({ priority: t.priority, steps: t.steps });
  lines.push(
    `INSERT INTO public.playbooks (category, title, active, playbook_key, version, status, approved_at, effective_on, applies_to, source, source_refs, checklist, checklist_category, sop_url)
SELECT 'checklist', ${q(t.title)}, false, ${q("checklist:" + t.category)}, 1, 'approved', now(), current_date, ARRAY['ticket'], 'imported', ARRAY['Resolve Ticket Checklists: Draft for Review (Nov 4 2026)'], ${q(body)}::jsonb, ${q(t.category)}, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.playbooks WHERE checklist IS NOT NULL AND checklist_category = ${q(t.category)});`,
  );
}
for (const c of CHECKLIST_CATEGORIES.filter((c) => c.flag)) {
  lines.push(
    `INSERT INTO public.feature_flags (key, label, description, enabled) VALUES (${q(c.flag!)}, ${q("Guided checklist: " + c.label)}, ${q("When on, new tickets in this category follow the guided checklist. When off, they use today's flow. Open tickets keep their flow.")}, false) ON CONFLICT (key) DO NOTHING;`,
  );
}
writeFileSync("docs/pending/ticket-checklists/02_seed_ticket_checklists.sql", lines.join("\n\n") + "\n");
console.log("ok", SEED_TEMPLATES.length);
