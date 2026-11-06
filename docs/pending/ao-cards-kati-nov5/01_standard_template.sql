-- STAGED, NOT APPLIED. Approved by Emily Nov 6 (Kati's Active Owner review). Run only with explicit approval to apply.
-- No BEGIN/COMMIT: the migration tool runs the file in one transaction.
-- Standard template (ARHA Onboarding - Standard, 84f3a777-44a8-430a-af7e-8f18dc9a7dae): working rows, then a new published version through the same snapshot the
-- publish_onboarding_template action writes. Versions 1 and 2 and every home already on them are untouched (file 04 moves 624 Daniel Court). Template push stays paused.

DO $do$ BEGIN
  -- Rebuilt Nov 6 on top of Kati's version 2 (published 2026-11-06 16:46 UTC). Version 1 and version 2 stay untouched.
  IF (SELECT max(version) FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae') IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Standard template is no longer on version 2; nothing applied'; END IF;
  IF (SELECT md5(snapshot::text) FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 2) IS DISTINCT FROM '5126f602f39ad15e12ec6a307ae5dc81' THEN
    RAISE EXCEPTION 'Kati''s version 2 snapshot changed since it was read; nothing applied'; END IF;
  -- Working steps must still equal Kati's version 2 exactly (no edits since she published)
  IF (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order),'[]'::jsonb) FROM public.onboarding_template_tasks t WHERE t.template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND t.is_active)
     IS DISTINCT FROM (SELECT snapshot->'steps' FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 2) THEN
    RAISE EXCEPTION 'Standard working steps changed since Kati''s version 2; nothing applied'; END IF;
  IF (SELECT md5((to_jsonb(t) - 'created_at' - 'updated_at')::text) FROM public.onboarding_template_tasks t WHERE id = 'f5b2335f-3aed-44ce-af1a-c119ec66d6c3') IS DISTINCT FROM '311da1ce8e7a0721088055f9486e127f'
     OR (SELECT md5((to_jsonb(t) - 'created_at' - 'updated_at')::text) FROM public.onboarding_template_tasks t WHERE id = '36881d78-d434-489b-bf51-fd35022fe2e3') IS DISTINCT FROM '4be286b2b658ed25c4a9f8f715553cf1'
     OR EXISTS (SELECT 1 FROM public.onboarding_template_tasks WHERE id = '00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f') THEN
    RAISE EXCEPTION 'Kati''s version 2 step edits changed since they were read; nothing applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_template_tasks WHERE id IN ('5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26','5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58')) THEN RAISE EXCEPTION 'New steps already exist; nothing applied'; END IF;
  IF (SELECT count(*) FROM public.onboarding_template_tasks WHERE id IN ('3505c129-1c91-42db-955b-89c7bce75c11','cbb23216-ee09-4301-b0b0-4392a960a145') AND is_active AND template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae') <> 2 THEN
    RAISE EXCEPTION 'Accounting or guest-instructions step changed since capture; nothing applied'; END IF;
END $do$;

-- 2. Upload the floor plans (Design, lead designer); before A26's sharing step (750)
INSERT INTO public.onboarding_template_tasks (id, template_id, stage, title, role, functional_role, sort_order, detail, blocks_handoff, owner_dependency, module, is_required, is_active, evidence_required)
VALUES ('5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26', '84f3a777-44a8-430a-af7e-8f18dc9a7dae', 'Pre-Close', 'Upload the floor plans', 'Lead Designer', 'lead_designer', 385, $t$About this step:
Upload the finished floor plans so the homeowner can review them on the card Review the floor plan.

Instructions:
1. Upload the floor plan files to this step.
2. Mark each file Shared with homeowner so it appears on the owner's card.
3. If you are not the lead designer, submit the step for the lead designer's review. It counts as done once the lead designer approves it.$t$, true, 'none', 'Furnishing Package selected', true, true, true);
-- Lead designer review when someone else completes it (existing step-review rule; reviewer resolves to the Project Team lead designer)
INSERT INTO public.onboarding_step_review_settings (template_task_id, reviewer_roles, time_limit_business_days, alerts_enabled, blocks, blocked_step_ids, blocked_stage, updated_by, updated_at)
VALUES ('5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26', ARRAY['lead_designer'], 1, false, 'nothing', '{}', NULL, '98bd6696-4018-4965-b645-0471c5ae3925', now());

-- 3. Upload the furnishing breakdown and make-ready estimate; carries the Accounting invoice request (folds in step 760)
INSERT INTO public.onboarding_template_tasks (id, template_id, stage, title, role, functional_role, sort_order, detail, blocks_handoff, owner_dependency, is_required, is_active, evidence_required, subtasks)
VALUES ('5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58', '84f3a777-44a8-430a-af7e-8f18dc9a7dae', 'Pre-Close', 'Upload the furnishing breakdown and make-ready estimate', $t$Onboarding Manager$t$, $t$onboarding_manager$t$, 755, $t$About this step:
Upload the furnishing invoice breakdown and the approved make-ready estimate. The homeowner reviews them on the card Review your furnishing breakdown and payment schedule, and Accounting prepares the initial invoices from the same files.

Instructions:
1. Upload the Furnishing Invoice Breakdown and the approved Make Ready Estimate to this step and mark both Shared with homeowner.
2. Send the invoice request to Accounting with both files attached, following the email in the step Send the invoice request to Accounting (now part of this step).
3. Record the date Accounting received the request.

About this step:
Accounting creates the owner's onboarding invoices from the approved furnishing package and Make Ready Estimate so ordering can start right after closing.

Instructions:
1. Confirm the furnishing total matches the Notion onboarding budget and the Make Ready Estimate is approved.
2. Send the email below to the AR/AP Specialist. CC the CEO, CFO, and PM. Attach both source documents.
3. When Accounting sends the QuickBooks link for Invoice 1, add it to the project. Invoice 1 goes out whether or not mood boards are approved. Active Owners also get it as an opportunity (Share the first onboarding invoice with the Active Owner).

Subject: Invoice Setup: {property address} ({owner names})
Hi team,
Can you please create the onboarding invoices for {owner names} at {property address}? Both source documents are attached for reference.
Total onboarding costs:
Furnishing Package: ${amount} (matches Notion)
Make Ready Estimate ({estimate number}, approved): ${amount}
Total: ${amount}
Invoice 1: ${amount}. 50% of the furnishing package (${amount}) plus 50% of the make ready estimate (${amount}). This one can go out {date}.
Invoice 2: ${amount}. Remaining 50% of the furnishing package. Please send in {timing}.
Invoice 3: Make Ready Reconciliation. Remaining 50% of the make ready estimate, currently ${amount}. Please create this as a draft but hold off on sending. We'll review the actual make ready expenses first and send you the final amount once that's done.
Once the invoices are created, please send me the QuickBooks link for Invoice 1 so I can add it to the onboarding task.
Thank you!
{Onboarding Manager}

Done when:
Accounting has the request and both documents, and the Invoice 1 link is on the project once it arrives.$t$, true, 'none', true, true, true,
  ARRAY['Upload the Furnishing Invoice Breakdown and share it with the homeowner','Upload the approved Make Ready Estimate and share it with the homeowner',$t$Send the initial invoice request to Accounting the usual way. The Finance portal in Resolve is under construction; this will become automatic when it's ready.$t$]);
UPDATE public.onboarding_template_tasks SET is_active = false WHERE id = '3505c129-1c91-42db-955b-89c7bce75c11';

-- 12. Guest instructions become card-only (card A59); the plan step is retired from future versions, never deleted
UPDATE public.onboarding_template_tasks SET is_active = false WHERE id = 'cbb23216-ee09-4301-b0b0-4392a960a145';

-- Publish version 3 on top of Kati's version 2 (same snapshot as publish_onboarding_template)
INSERT INTO public.onboarding_template_versions (template_id, version, snapshot, published_by)
SELECT '84f3a777-44a8-430a-af7e-8f18dc9a7dae', 3, jsonb_build_object(
  'stages', coalesce((SELECT jsonb_agg(jsonb_build_object('name',s.name,'sort_order',s.sort_order) ORDER BY s.sort_order)
              FROM public.onboarding_template_stages s WHERE s.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND s.active),'[]'::jsonb),
  'steps', coalesce((SELECT jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order)
              FROM public.onboarding_template_tasks t WHERE t.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND t.is_active
                AND (NOT EXISTS (SELECT 1 FROM public.onboarding_template_stages s WHERE s.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae')
                     OR EXISTS (SELECT 1 FROM public.onboarding_template_stages s WHERE s.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND s.name=t.stage AND s.active))),'[]'::jsonb)),
  '98bd6696-4018-4965-b645-0471c5ae3925';
