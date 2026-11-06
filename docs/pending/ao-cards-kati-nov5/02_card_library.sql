-- STAGED, NOT APPLIED. Approved by Emily Nov 6 (Kati's Active Owner review). Run only with explicit approval to apply.
-- No BEGIN/COMMIT: the migration tool runs the file in one transaction.
-- Card library: each edit mirrors ao_card_save / ao_card_set_status (version + 1, history snapshot), attributed to Emily.
-- Optimistic check on the captured version; any mismatch stops the whole file. Released home plan cards keep their pinned version.
-- Requires 01_standard_template.sql (A26 and A58 point at its new steps).

-- A15 Review repair estimates and approve material work (captured v5)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET status = $t$draft$t$, retired_at = NULL, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'A15' AND version = 5 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'A15 changed since capture (expected v5); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A26 Review the floor plan (captured v4)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET linked_template_task_ids = ARRAY['5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26']::uuid[], opens_text = $t$Locked until ARHA uploads the floor plan$t$, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'A26' AND version = 4 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'A26 changed since capture (expected v4); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A31 Attend the handoff meeting and review what carries into go-live (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET what_text = $t$This is the same handoff meeting that is already on your onboarding plan. ARHA invites you to attend it; it is not a separate meeting. ARHA uses the meeting to explain the home's operating information, open items and communication paths. You confirm your understanding and raise any unresolved questions; ARHA assigns internal follow-up.

Why it matters: The handoff sets how the home runs after launch. Clear authority and open items now prevent confusion once guests arrive.

Steps:
1. Before the meeting, review the handoff packet ARHA shares, including open items, guest instructions and communication paths.
2. Write down questions about anything that is unclear or that you expected to be different.
3. Attend the handoff meeting when ARHA invites you, confirm the operating authority and approval thresholds that apply after go-live, and ask your questions.
4. Give any correction or direction on items that need a homeowner decision.
5. Within the deadline, record your takeaways, questions, decisions and the open items carrying into go-live.

What to submit: Meeting notes and takeaways (includes ready-for-booking notice and carry-over items). Answer fields: Takeaways, questions.

What to keep: Retain the reviewed record, the homeowner's questions or analysis and the final written decision.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, how_text = $t$1. Before the meeting, review the handoff packet ARHA shares, including open items, guest instructions and communication paths.
2. Write down questions about anything that is unclear or that you expected to be different.
3. Attend the handoff meeting when ARHA invites you, confirm the operating authority and approval thresholds that apply after go-live, and ask your questions.
4. Give any correction or direction on items that need a homeowner decision.
5. Within the deadline, record your takeaways, questions, decisions and the open items carrying into go-live.$t$, opens_text = $t$Locked until ARHA invites you to the handoff meeting$t$, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'A31' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'A31 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A35 Review operating statements (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET what_text = $t$Use the monthly owner statement you already receive from ARHA. No new or separate statement is created for this card. Review the statement for your home and ask questions through ARHA.

Why it matters: Statements show how the home is performing and surface decisions that need you. Questions are best raised while the month is fresh.

Steps:
1. Open the monthly owner statement you already receive from ARHA and confirm it is for the correct home and month.
2. Review revenue, expenses and any maintenance or repair items listed.
3. Identify any item that needs a homeowner decision, such as a repair approval or a recurring service change.
4. Write specific questions tied to a line item.
5. Submit the statement month and your questions or decisions. Reviewing for personal interest alone is not a decision; note the operating action you are taking, if any.

What to submit: Statement review with questions. Answer fields: Statement month, question.

What to keep: Retain the reviewed record, the homeowner's questions or analysis and the final written decision.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, how_text = $t$1. Open the monthly owner statement you already receive from ARHA and confirm it is for the correct home and month.
2. Review revenue, expenses and any maintenance or repair items listed.
3. Identify any item that needs a homeowner decision, such as a repair approval or a recurring service change.
4. Write specific questions tied to a line item.
5. Submit the statement month and your questions or decisions. Reviewing for personal interest alone is not a decision; note the operating action you are taking, if any.$t$, opens_text = $t$Locked until your monthly owner statement arrives$t$, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'A35' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'A35 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A41 Review onboarding costs and invoices (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET status = $t$draft$t$, documentation_note = $t$Status note: Replaced by Review your furnishing breakdown and payment schedule until revised. Evidence to keep: Retain the reviewed record, the homeowner's questions or analysis and the final written decision. Time: the homeowner enters actual minutes after doing the work; no estimated or prefilled time. Attestation: the homeowner confirms the entry reflects their own time and work for this home.$t$, retired_at = NULL, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'A41' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'A41 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A56 Coordinate a remote third-party home documentation session (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET what_text = $t$This card is optional. It is available after your home goes live and is not part of onboarding. ARHA can coordinate access and an onsite representative when available. The homeowner schedules the independent professional, confirms the requested documentation and obtains their own professional advice about the purpose and use of the session.

Why it matters: Some documentation requires an independent professional and onsite access. Coordinating it early avoids delays.

Steps:
1. Confirm with your independent professional what the session must document and how long it will take.
2. Propose two or three session windows to ARHA so access and an onsite representative can be arranged.
3. Confirm the final date, provider name and access instructions with ARHA.
4. Join remotely if the provider offers it, and answer the provider's property questions.
5. Record the provider, session date and notes. ARHA or vendor time at the session is not your time.

What to submit: Session confirmation and notes. Answer fields: Provider, date, notes.

What to keep: Keep the provider confirmation, the session date and your notes.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, stage_window = $t$operations$t$, lane = $t$flexible$t$, team_needs_this = false, opens_text = $t$Optional. Available after your home goes live, once ARHA schedules the session$t$, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'A56' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'A56 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A57 Document your onboarding planning call (re-read v4: Emily linked the readiness call on Nov 6 16:00 UTC; only the opens text changes now)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET linked_template_task_ids = ARRAY['ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49']::uuid[], opens_text = $t$Locked until the Owner readiness call is held$t$, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'A57' AND version = 4 AND linked_template_task_ids = ARRAY['ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49']::uuid[] RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'A57 changed since capture (expected v4); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- P03 Choose towels, linens and guest supplies (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET what_text = $t$Choose your home's linens, bath items and guest supplies from ARHA's approved standards list, within your home's furnishing budget.

Why it matters: Linens and guest supplies are touched in every stay. The right choices protect reviews and keep turnovers consistent.

Steps:
1. Open ARHA's approved standards list for linens, bath items and guest supplies, and compare it with the home's bed sizes, bathrooms, occupancy and planned guest use.
2. For each category, choose items from the approved standards list.
3. Keep all sheets, duvet covers, bath towels, hand towels and washcloths white.
4. Keep your choices within your home's furnishing budget.
5. If guests need something that is not on the list, write it in the notes. ARHA reviews it, and only approved items are ordered.

What to submit: Choices from ARHA's approved standards list, within the furnishing budget. Answer fields: Category, choice from the approved list, item, quantity, budget, notes.

What to keep: Retain the reviewed record, the homeowner's questions or analysis and the final written decision.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, how_text = $t$1. Open ARHA's approved standards list for linens, bath items and guest supplies, and compare it with the home's bed sizes, bathrooms, occupancy and planned guest use.
2. For each category, choose items from the approved standards list.
3. Keep all sheets, duvet covers, bath towels, hand towels and washcloths white.
4. Keep your choices within your home's furnishing budget.
5. If guests need something that is not on the list, write it in the notes. ARHA reviews it, and only approved items are ordered.$t$, required_output = $t$Choices from ARHA's approved standards list, within the furnishing budget$t$, output_fields = $t$[{"key": "category", "label": "Category", "type": "text"}, {"key": "decision", "label": "Choice from the approved list", "type": "text"}, {"key": "proposed_item", "label": "Item", "type": "text"}, {"key": "quantity", "label": "Quantity", "type": "number"}, {"key": "budget", "label": "Budget", "type": "money_text"}, {"key": "guest_need", "label": "Notes", "type": "text"}]$t$::jsonb, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'P03' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'P03 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- P04 Choose kitchen and household items (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET what_text = $t$Choose your home's kitchen and household items from ARHA's approved standards list, within your home's furnishing budget.

Why it matters: Kitchen and household items decide whether guests can actually live in the home for weeks. Real gaps matter more than extras.

Steps:
1. Open ARHA's approved standards list for kitchen and household items, and compare it with the home's occupancy, kitchen layout, storage and planned guest use.
2. For each category, choose items from the approved standards list.
3. Keep your choices within your home's furnishing budget.
4. Rank each choice as must-have, helpful or optional so ARHA can fit it within the budget.
5. If guests need something that is not on the list, write it in the notes. ARHA reviews it, and only approved items are ordered.

What to submit: Choices from ARHA's approved standards list, within the furnishing budget. Answer fields: Category, choice from the approved list, item, quantity, notes, budget, priority.

What to keep: Retain the reviewed record, the homeowner's questions or analysis and the final written decision.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, how_text = $t$1. Open ARHA's approved standards list for kitchen and household items, and compare it with the home's occupancy, kitchen layout, storage and planned guest use.
2. For each category, choose items from the approved standards list.
3. Keep your choices within your home's furnishing budget.
4. Rank each choice as must-have, helpful or optional so ARHA can fit it within the budget.
5. If guests need something that is not on the list, write it in the notes. ARHA reviews it, and only approved items are ordered.$t$, required_output = $t$Choices from ARHA's approved standards list, within the furnishing budget$t$, output_fields = $t$[{"key": "category", "label": "Category", "type": "text"}, {"key": "decision", "label": "Choice from the approved list", "type": "text"}, {"key": "item", "label": "Item", "type": "text"}, {"key": "quantity", "label": "Quantity", "type": "number"}, {"key": "function", "label": "Notes", "type": "text"}, {"key": "budget", "label": "Budget", "type": "money_text"}, {"key": "priority", "label": "Priority", "type": "text"}]$t$::jsonb, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'P04' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'P04 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- P14 Draft an Instagram launch campaign (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET what_text = $t$Create a six-piece Instagram campaign using feed, story or short-video concepts that communicate the home's real features and local usefulness.

Why it matters: Instagram shows the home visually and can reach local and professional audiences who refer guests.

Steps:
1. Create six concepts covering the property introduction, design or comfort, a key amenity, the local area, an intended stay use and a referral reminder.
2. Write the caption, on-image text if any, asset direction, accessibility description, call to action and suggested posting date for each concept.
3. Create a concise set of relevant location and property tags without using misleading claims.
4. Identify which concepts can use existing MLS or design material and which need final ARHA photos.
5. Finalize the package with ARHA-approved facts, the listing link and your home's marketing photos. Use Download all photos on this card to get your home's marketing photos in one file.

What to submit: Six-post campaign. Answer fields: Post text, photo choice, date.

What to keep: Retain the completed worksheet or draft, source links and any supporting screenshots used to prepare it.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, how_text = $t$1. Create six concepts covering the property introduction, design or comfort, a key amenity, the local area, an intended stay use and a referral reminder.
2. Write the caption, on-image text if any, asset direction, accessibility description, call to action and suggested posting date for each concept.
3. Create a concise set of relevant location and property tags without using misleading claims.
4. Identify which concepts can use existing MLS or design material and which need final ARHA photos.
5. Finalize the package with ARHA-approved facts, the listing link and your home's marketing photos. Use Download all photos on this card to get your home's marketing photos in one file.$t$, opens_text = $t$Draft open on day one; final step unlocks when your marketing photos are ready and ARHA shares the listing link$t$, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'P14' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'P14 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- P15 Prepare messages for friends, family and colleagues (captured v3)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  UPDATE public.ao_library_cards SET what_text = $t$Prepare personal, human outreach that lets the homeowner's existing network know about the furnished home and how to refer an appropriate guest.

Why it matters: Personal outreach from you is one of the most trusted ways a furnished home gets its first referrals.

Steps:
1. Divide the homeowner's existing network into family and friends, professional contacts and community contacts.
2. Draft one short text, one group-message version, one email and one follow-up message using the homeowner's natural voice.
3. Explain the type of stay the home may support without promising a rate, date or booking.
4. Include the ARHA-approved link or inquiry route and a clear request to share it with someone who may need furnished housing. You can add your home's marketing photos. Use Download all photos on this card to get your home's marketing photos in one file.
5. Finalize the messages when the live link is available and record only outreach the homeowner actually sends.

What to submit: Text and email message set. Answer fields: Audience, channel, message.

What to keep: Keep the final message set and a record of the outreach you actually sent.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, how_text = $t$1. Divide the homeowner's existing network into family and friends, professional contacts and community contacts.
2. Draft one short text, one group-message version, one email and one follow-up message using the homeowner's natural voice.
3. Explain the type of stay the home may support without promising a rate, date or booking.
4. Include the ARHA-approved link or inquiry route and a clear request to share it with someone who may need furnished housing. You can add your home's marketing photos. Use Download all photos on this card to get your home's marketing photos in one file.
5. Finalize the messages when the live link is available and record only outreach the homeowner actually sends.$t$, version = version + 1, updated_by = '98bd6696-4018-4965-b645-0471c5ae3925', updated_at = now()
   WHERE code = 'P15' AND version = 3 RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'P15 changed since capture (expected v3); nothing applied'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A58 Review your furnishing breakdown and payment schedule (new, Draft)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  IF EXISTS (SELECT 1 FROM public.ao_library_cards WHERE code = 'A58') THEN RAISE EXCEPTION 'Card A58 already exists; nothing applied'; END IF;
  INSERT INTO public.ao_library_cards (code, status, version, title, card_group, event_triggered, lane, stage_window, team_needs_this, lock_rule,
    linked_template_task_ids, opens_text, deadline_text, deadline_business_days, cutoff_rule, takeover_text, what_text, why_text, how_text,
    required_output, documentation_note, output_fields, est_hours_min, est_hours_max, updated_by)
  VALUES ('A58', 'draft', 1, $t$Review your furnishing breakdown and payment schedule$t$, $t$Guide activity$t$, false, 'critical', 'onboarding_early', false, 'until_linked_step_done',
    ARRAY['5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a58']::uuid[], $t$Locked until ARHA uploads your furnishing breakdown and make-ready estimate$t$, $t$2 business days after it unlocks, due 5:00 pm Central$t$, 2, 'none', '', $t$Review the furnishing invoice breakdown and the make-ready estimate ARHA uploaded for your home, and confirm you understand how billing is split across your payments.

Why it matters: Reviewing these now means there are no surprises when invoices arrive, and it keeps furniture orders, deliveries and repairs on schedule.

Steps:
1. Open the attached furnishing invoice breakdown to see everything included in your furnishing package.
2. Open the attached make-ready estimate and look over the repair and preparation work for your home.
3. Review the payment schedule. Both totals are split in half. Your first payment covers half of the furnishing package and half of the make-ready estimate. Your second payment covers the rest of the furnishing package. Your final payment covers the rest of the make-ready work.
4. Before the final payment is invoiced, ARHA reviews the actual labor and material costs, so that payment may adjust slightly from the estimate.
5. Mark this as reviewed. If anything in the breakdown or payment timing raises a question, write it in the question box and ARHA will follow up before your first payment is due.

What to submit: Acknowledgment of the furnishing breakdown and payment schedule, with any questions. Answer fields: Reviewed, questions.

What to keep: Keep both documents and ARHA's answers to your questions.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, $t$Reviewing these now means there are no surprises when invoices arrive, and it keeps furniture orders, deliveries and repairs on schedule.$t$, $t$1. Open the attached furnishing invoice breakdown to see everything included in your furnishing package.
2. Open the attached make-ready estimate and look over the repair and preparation work for your home.
3. Review the payment schedule. Both totals are split in half. Your first payment covers half of the furnishing package and half of the make-ready estimate. Your second payment covers the rest of the furnishing package. Your final payment covers the rest of the make-ready work.
4. Before the final payment is invoiced, ARHA reviews the actual labor and material costs, so that payment may adjust slightly from the estimate.
5. Mark this as reviewed. If anything in the breakdown or payment timing raises a question, write it in the question box and ARHA will follow up before your first payment is due.$t$,
    $t$Acknowledgment of the furnishing breakdown and payment schedule, with any questions$t$, $t$Evidence to keep: Keep both documents and ARHA's answers to your questions. Time: the homeowner enters actual minutes after doing the work; no estimated or prefilled time. Attestation: the homeowner confirms the entry reflects their own time and work for this home.$t$, $t$[{"key": "reviewed", "label": "Reviewed", "type": "text"}, {"key": "question", "label": "Questions", "type": "text"}]$t$::jsonb, 0.25, 0.5, '98bd6696-4018-4965-b645-0471c5ae3925') RETURNING * INTO r;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;
-- A59 Review your home's guest instructions (new, Draft)
DO $do$ DECLARE r public.ao_library_cards; BEGIN
  IF EXISTS (SELECT 1 FROM public.ao_library_cards WHERE code = 'A59') THEN RAISE EXCEPTION 'Card A59 already exists; nothing applied'; END IF;
  INSERT INTO public.ao_library_cards (code, status, version, title, card_group, event_triggered, lane, stage_window, team_needs_this, lock_rule,
    linked_template_task_ids, opens_text, deadline_text, deadline_business_days, cutoff_rule, takeover_text, what_text, why_text, how_text,
    required_output, documentation_note, output_fields, est_hours_min, est_hours_max, updated_by)
  VALUES ('A59', 'draft', 1, $t$Review your home's guest instructions$t$, $t$Guide activity$t$, false, 'launch', 'onboarding_launch', false, 'until_linked_step_done',
    ARRAY[]::uuid[], $t$Locked until ARHA shares your home's guest instructions$t$, $t$2 business days after it unlocks, due 5:00 pm Central$t$, 2, 'none', '', $t$Review the guest instructions for your home: check in, Wi-Fi, parking, trash, thermostat, appliances, and anything unique to your home.

Why it matters: Guests rely on these instructions from the moment they arrive. You know your home best, so your review helps every stay start smoothly.

Steps:
1. Open the guest instructions below and read each section.
2. Select Acknowledge if everything is right, or leave a note on anything that should change.

What to submit: Acknowledgment of the guest instructions, or notes on what should change. Answer fields: Acknowledged, notes.

What to keep: Keep the guest instructions you reviewed and any notes you sent.

Record only the time you personally spend on this card. Do not include time spent by ARHA, a vendor or another household member.$t$, $t$Guests rely on these instructions from the moment they arrive. You know your home best, so your review helps every stay start smoothly.$t$, $t$1. Open the guest instructions below and read each section.
2. Select Acknowledge if everything is right, or leave a note on anything that should change.$t$,
    $t$Acknowledgment of the guest instructions, or notes on what should change$t$, $t$Evidence to keep: Keep the guest instructions you reviewed and any notes you sent. Time: the homeowner enters actual minutes after doing the work; no estimated or prefilled time. Attestation: the homeowner confirms the entry reflects their own time and work for this home.$t$, $t$[{"key": "acknowledged", "label": "Acknowledged", "type": "text"}, {"key": "notes", "label": "Notes", "type": "text"}]$t$::jsonb, 0.25, 0.5, '98bd6696-4018-4965-b645-0471c5ae3925') RETURNING * INTO r;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (r.id, r.version, to_jsonb(r), '98bd6696-4018-4965-b645-0471c5ae3925');
END $do$;

-- 12. P19 and P20 stay card-only: close the pending step-link suggestions (P19 pointed at the guest-instructions step,
-- P20 at the photo steps). Their live links are already empty; nothing in the Standard template unlocks them.
DO $do$ BEGIN
  UPDATE public.ao_card_step_link_suggestions SET status = 'rejected', decided_by = '98bd6696-4018-4965-b645-0471c5ae3925', decided_at = now(),
    note = note || ' Rejected Nov 6: card-only owner opportunity, no plan step.'
   WHERE card_code IN ('P19','P20') AND status = 'suggested';
  IF (SELECT count(*) FROM public.ao_library_cards WHERE code IN ('P19','P20') AND cardinality(linked_template_task_ids) = 0) <> 2 THEN
    RAISE EXCEPTION 'P19 or P20 gained a linked step since capture; nothing applied'; END IF;
END $do$;

-- 11. Marketing photos: delivered by Download all photos (docs/pending/ao-marketing-photos), no placeholder column.
