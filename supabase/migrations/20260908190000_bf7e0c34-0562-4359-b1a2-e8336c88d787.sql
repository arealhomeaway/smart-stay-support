-- Active Owner investor-presentation showcase: Dana Reyes / ZZ QA AO — Willow.
--
-- A dedicated, admin-triggered demo scenario for presenting the 90-Day Owner
-- Participation Program to investors. Kept deliberately separate from
-- seed_demo_owner_program (DEMO Harbor House / DEMO Ridge Cabin) so that
-- resetting the general QA "Demo Mode" environment never touches this
-- record, and this record never touches the general one. Every row carries
-- is_demo = true, the fictional owner is clearly labeled "(not a real
-- person)" with an @example.invalid email, and the property name carries
-- the "ZZ QA" marker recognized by src/lib/test-data.ts. Archive-never-
-- delete, exactly like every other demo scenario in this app.
--
-- Usage: as an authenticated Platform Admin, run
--   select public.seed_demo_active_owner_showcase();
-- to (re)seed, or
--   select public.archive_demo_active_owner_showcase();
-- to archive it without deleting history. Re-running the seed function
-- archives any prior run of this same scenario first, so it is safe to
-- call more than once.

CREATE OR REPLACE FUNCTION public.archive_demo_active_owner_showcase(_actor uuid DEFAULT NULL::uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who uuid := COALESCE(auth.uid(), _actor);
  prog_ids uuid[];
BEGIN
  IF NOT public.has_role(who, 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can manage the demo environment.';
  END IF;

  SELECT array_agg(id) INTO prog_ids
    FROM public.owner_programs
   WHERE is_demo AND owner_name = 'Dana Reyes (not a real person)';

  UPDATE public.owner_reviews SET archived_at = COALESCE(archived_at, now())
   WHERE program_id = ANY(prog_ids) AND archived_at IS NULL;
  UPDATE public.owner_program_properties SET archived_at = COALESCE(archived_at, now())
   WHERE program_id = ANY(prog_ids) AND archived_at IS NULL;
  UPDATE public.owner_programs
     SET archived_at = COALESCE(archived_at, now()),
         archived_by = COALESCE(archived_by, who),
         archive_reason = COALESCE(archive_reason, 'Active Owner investor showcase archived by admin'),
         status = 'closed'
   WHERE id = ANY(prog_ids) AND archived_at IS NULL;
  UPDATE public.tickets
     SET archived_at = COALESCE(archived_at, now()),
         archive_reason = COALESCE(archive_reason, 'Active Owner investor showcase archived by admin'),
         archived_by = COALESCE(archived_by, who)
   WHERE is_demo AND title LIKE 'ZZ QA AO — Willow:%' AND archived_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.seed_demo_active_owner_showcase(_actor uuid DEFAULT NULL::uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who uuid := COALESCE(auth.uid(), _actor);
  -- Program start: 37 days ago, so "today" lands on program day 38 of 90 —
  -- an on-track, mid-onboarding-to-ongoing point in the story.
  d0 date := current_date - 37;
  p_willow uuid;
  prog uuid;
  t_vendor uuid;
  r_misc_id uuid;
  e_misc_a uuid;
BEGIN
  IF NOT public.has_role(who, 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can seed the demo environment.';
  END IF;

  PERFORM public.archive_demo_active_owner_showcase(who);

  -- ============ Property ============
  INSERT INTO public.properties
    (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, is_demo)
  VALUES
    ('ZZ QA AO — Willow','ZZ QA AO — Willow','48 Willow Bend Court','Franklin','TN','37067','demo',false,'active_operations','', true)
  RETURNING id INTO p_willow;

  -- ============ Program ============
  INSERT INTO public.owner_programs
    (property_id, owner_user_id, owner_name, owner_email, owner_phone, status, started_on, ends_on,
     target_hours, activated_at, activated_by, onboarding_lead, operations_lead, dfy_confirmed, dfy_confirmed_at,
     internal_notes, is_demo)
  VALUES
    (NULL, NULL, 'Dana Reyes (not a real person)', 'dana.reyes.qa@example.invalid', '(000) 000-0000', 'active',
     d0, d0 + 89, 100, d0::timestamptz, who, who, who, true, d0::timestamptz,
     'Fictional QA/demo owner for investor and board walkthroughs of the Active Owner participation experience. Not a real person or home — never contact.',
     true)
  RETURNING id INTO prog;

  INSERT INTO public.owner_program_properties
    (program_id, property_id, closing_date, closing_confirmed, added_on, added_by, inclusion_status, onboarding_status, launch_status, last_owner_activity_at, is_demo)
  VALUES
    (prog, p_willow, d0 - 10, true, d0, who, 'included', 'complete', 'launched', (d0 + 37)::timestamptz, true);

  -- ============ A real ticket, linked to a review below ============
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, property_id, created_by, reported_at, response_due_at, due_at, resolved_at, resolution_notes,
     handoff_status, initiator_type, owner_participation_path, owner_submitted, owner_submitted_by, ref, is_demo)
  VALUES
    ('ZZ QA AO — Willow: Hot tub service estimate',
     'Fictional demo matter opened by the QA/demo homeowner on the Consult path — a vendor estimate reviewed before booking.',
     'maintenance','same_day_operations','p3','resolved','ticket','owner','none','vacant',
     false, p_willow, who, (d0 + 22)::timestamptz, (d0 + 22)::timestamptz + interval '4 hours', (d0 + 25)::timestamptz,
     (d0 + 23)::timestamptz, 'Estimate reviewed with the homeowner and approved for scheduling.',
     'not_started','owner','consult', true, who, 900200, true)
  RETURNING id INTO t_vendor;

  -- ============ Participation opportunities (the roadmap / "opportunities" board) ============
  INSERT INTO public.owner_reviews
    (program_id, ticket_id, phase, stage, title, task_type, property_id, recommendation, business_question, impact,
     decision_path, respond_by, status, owner_decision, owner_response, outcome, responded_at,
     source_type, owner_action_type, available_from, staff_context, sort_order, is_demo)
  VALUES
    (prog, NULL, 'onboarding', 'kickoff', 'ZZ QA — Attend the onboarding kickoff call', 'program_wide', NULL,
     'Meet the onboarding lead and walk through the 90-day roadmap.', 'Ready to get started?',
     'Sets shared expectations for the whole 90-day program.', 'inform', d0 + 7, 'answered', NULL,
     'Attended and reviewed the roadmap.', 'Kickoff complete — roadmap confirmed.', (d0 + 2)::timestamptz,
     'onboarding', 'attend', NULL, NULL, 1, true),

    (prog, NULL, 'onboarding', 'assess', 'ZZ QA — Review the property assessment & make-ready scope', 'property_specific', p_willow,
     'Confirm the make-ready scope compiled from the initial walk.', 'Anything missing from this scope?',
     'Keeps the make-ready budget aligned with what the home actually needs.', 'consult', d0 + 9, 'answered', NULL,
     'Reviewed the scope and flagged two items for the punch list.', 'Scope confirmed with two additions.', (d0 + 4)::timestamptz,
     'onboarding', 'review', NULL, NULL, 2, true),

    (prog, NULL, 'onboarding', 'walkthrough', 'ZZ QA — Walk the home with the onboarding lead', 'property_specific', p_willow,
     'Join an on-site walkthrough before make-ready work begins.', NULL,
     'Firsthand context the owner can only get in person.', 'consult', d0 + 11, 'answered', NULL,
     'Walked the full property and agreed the punch list on site.', 'Punch list finalized on the walkthrough.', (d0 + 6)::timestamptz,
     'onboarding', 'attend', NULL, NULL, 3, true),

    (prog, NULL, 'onboarding', 'make_ready', 'ZZ QA — Approve the furnishing & make-ready budget', 'property_specific', p_willow,
     'Approve the proposed furnishing and make-ready budget.', 'Do you approve this budget?',
     'Unlocks ordering so make-ready stays on schedule.', 'approve', d0 + 14, 'answered', 'approve',
     'Approved the proposed budget.', 'Budget approved as recommended.', (d0 + 9)::timestamptz,
     'onboarding', 'approve', NULL, NULL, 4, true),

    (prog, NULL, 'onboarding', 'make_ready', 'ZZ QA — Select furnishings and décor for the primary living areas', 'property_specific', p_willow,
     'Choose between two furniture packages for the living and primary bedroom.', 'Which package do you prefer?',
     'A homeowner-selected look the guest photos will showcase.', 'consult', d0 + 16, 'answered', NULL,
     'Selected furniture package B with two fabric swaps.', 'Package B ordered with the requested swaps.', (d0 + 11)::timestamptz,
     'onboarding', 'document', NULL, NULL, 5, true),

    (prog, NULL, 'onboarding', 'listing', 'ZZ QA — Review the listing copy and photography set', 'property_specific', p_willow,
     'Review the draft listing description and the photo shoot selects.', 'Anything you would change?',
     'The listing is the first thing a guest sees.', 'consult', d0 + 20, 'answered', NULL,
     'Approved with two caption edits.', 'Listing published with the requested caption changes.', (d0 + 15)::timestamptz,
     'onboarding', 'review', NULL, NULL, 6, true),

    (prog, NULL, 'onboarding', 'pricing', 'ZZ QA — Approve the pricing floor for the first season', 'property_specific', p_willow,
     'Set a $219 weekday floor for the first 60 days.', 'Do you approve this floor?',
     'Protects rate integrity while reviews build.', 'approve', d0 + 22, 'answered', 'approve',
     'Approved the recommended floor.', '$219 weekday floor approved for the first 60 days.', (d0 + 17)::timestamptz,
     'onboarding', 'approve', NULL, NULL, 7, true),

    (prog, NULL, 'onboarding', 'standards', 'ZZ QA — Review guest experience & house-rules standards', 'property_specific', p_willow,
     'Review the standard guest communication templates and house rules for this home.', 'Anything specific to add?',
     'Keeps guest experience consistent with the owner''s expectations.', 'inform', d0 + 24, 'answered', NULL,
     'Reviewed and confirmed the standards as written.', 'Standards confirmed, no changes requested.', (d0 + 19)::timestamptz,
     'onboarding', 'review', NULL, NULL, 8, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Confirm the pricing call notes', 'property_specific', p_willow,
     'Confirm the notes from the pricing strategy call before they are logged.', 'Which home did this call cover?',
     'Keeps the participation record accurate.', 'consult', d0 + 25, 'awaiting_owner', NULL, NULL, NULL, NULL,
     'operations', 'document', NULL, 'Returned to the homeowner — the logged entry did not say which property the call covered.', 9, true),

    (prog, NULL, 'ongoing', 'learning', 'ZZ QA — Read the Owner Participation Program guide', 'program_wide', NULL,
     'Reference material: how participation hours are counted and what qualifies.', NULL,
     'Helps the owner report time accurately going forward.', 'inform', d0 + 26, 'answered', NULL,
     'Read the guide and reviewed how hours are counted.', 'Guide reviewed.', (d0 + 21)::timestamptz,
     'program', 'research', NULL, NULL, 10, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Review the year-one operating budget variance', 'property_specific', p_willow,
     'Review where actuals differ from the year-one operating budget.', 'Anything you want the team to revisit?',
     'Keeps the owner informed on how the home is performing financially.', 'inform', d0 + 27, 'answered', NULL,
     'Reviewed the variance and had no follow-up questions.', 'Variance reviewed, no action needed.', (d0 + 22)::timestamptz,
     'operations', 'review', NULL, NULL, 11, true),

    (prog, t_vendor, 'ongoing', 'operations', 'ZZ QA — Review the landscaping & hot tub service estimate', 'property_specific', p_willow,
     'Review the vendor estimate for landscaping and hot tub servicing.', 'Do you want anything added to scope?',
     'Keeps recurring vendor spend visible to the owner.', 'consult', d0 + 28, 'answered', NULL,
     'Reviewed the estimate and approved it for scheduling.', 'Estimate approved for scheduling.', (d0 + 23)::timestamptz,
     'operations', 'review', NULL, NULL, 12, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Review a guest escalation summary and response', 'property_specific', p_willow,
     'Review how a recent guest escalation was handled and the resolution offered.', 'Would you have handled this differently?',
     'Transparency on how guest issues are resolved at the home.', 'consult', d0 + 29, 'answered', NULL,
     'Reviewed the summary and agreed with the resolution.', 'Resolution confirmed with the owner.', (d0 + 24)::timestamptz,
     'operations', 'review', NULL, NULL, 13, true),

    (prog, NULL, 'ongoing', 'learning', 'ZZ QA — Research local short-term rental regulation updates', 'program_wide', NULL,
     'Look into recent short-term rental regulation changes for the market.', NULL,
     'Owner-driven awareness of local compliance changes.', 'inform', d0 + 30, 'answered', NULL,
     'Reviewed the update posted by the local association.', 'No action required at this time.', (d0 + 25)::timestamptz,
     'program', 'research', NULL, NULL, 14, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Attend the local market & comp-set briefing', 'program_wide', NULL,
     'Join the quarterly market and comp-set briefing.', NULL,
     'Owner-facing context behind pricing and demand decisions.', 'inform', d0 + 31, 'answered', NULL,
     'Attended the briefing and asked follow-up questions on comp pricing.', 'Briefing attended.', (d0 + 26)::timestamptz,
     'program', 'attend', NULL, NULL, 15, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Approve a repair estimate over the standing threshold', 'property_specific', p_willow,
     'Approve a repair estimate that exceeds the standing spend threshold.', 'Do you approve this repair?',
     'Keeps owner-approval spend controls working as designed.', 'approve', d0 + 32, 'answered', 'approve',
     'Approved the repair as estimated.', 'Repair approved and scheduled.', (d0 + 27)::timestamptz,
     'operations', 'approve', NULL, NULL, 16, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Approve the replacement appliance package', 'property_specific', p_willow,
     'Approve the replacement package for the kitchen appliances nearing end of life.', 'Do you approve this package?',
     'Keeps the home guest-ready without a mid-season surprise.', 'approve', d0 + 33, 'answered', 'approve',
     'Approved the recommended package.', 'Appliance package approved.', (d0 + 28)::timestamptz,
     'operations', 'approve', NULL, NULL, 17, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Review the first 30 days operations report', 'property_specific', p_willow,
     'Review the first 30 days of operations at the home.', 'Anything you want to see differently?',
     'A regular operating cadence the owner can count on.', 'inform', d0 + 34, 'answered', NULL,
     'Reviewed the report and had no follow-up questions.', 'Report reviewed.', (d0 + 29)::timestamptz,
     'operations', 'review', NULL, NULL, 18, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Review the year-one marketing plan draft', 'program_wide', NULL,
     'Review the draft year-one marketing plan for the home.', 'Anything you want added?',
     'Owner input shapes how the home is marketed for the year ahead.', 'consult', d0 + 35, 'answered', NULL,
     'Reviewed the draft and suggested one seasonal promotion.', 'Plan updated with the suggested promotion.', (d0 + 30)::timestamptz,
     'program', 'review', NULL, NULL, 19, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Participate in the guest review response calibration session', 'program_wide', NULL,
     'Join a session calibrating how guest reviews are responded to.', NULL,
     'Owner voice directly shapes the guest response tone.', 'consult', d0 + 36, 'answered', NULL,
     'Participated and shared two example responses.', 'Calibration session complete.', (d0 + 31)::timestamptz,
     'program', 'participate', NULL, NULL, 20, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Approve the holiday-season rate strategy', 'property_specific', p_willow,
     'Approve the proposed holiday-season rate strategy.', 'Do you approve this strategy?',
     'Captures peak holiday demand at the right price.', 'approve', d0 + 37, 'answered', 'approve',
     'Approved the strategy as proposed.', 'Holiday rate strategy approved.', (d0 + 32)::timestamptz,
     'operations', 'approve', NULL, NULL, 21, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Attend the smart-lock & tech install walkthrough', 'property_specific', p_willow,
     'Join the vendor walkthrough for the smart-lock and tech install.', NULL,
     'Owner sign-off on the new access technology at the home.', 'consult', d0 + 38, 'answered', NULL,
     'Attended and approved the placement of the new devices.', 'Install walkthrough complete.', (d0 + 33)::timestamptz,
     'operations', 'attend', NULL, NULL, 22, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Mid-program check-in call with the operations lead', 'program_wide', NULL,
     'A scheduled mid-program check-in on how the program is going.', NULL,
     'A standing touchpoint independent of any single decision.', 'inform', d0 + 39, 'answered', NULL,
     'Attended the check-in call.', 'Check-in complete; time logged and awaiting internal review.', (d0 + 34)::timestamptz,
     'operations', 'attend', NULL, NULL, 23, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Refresh seasonal décor and guest welcome materials', 'property_specific', p_willow,
     'Refresh seasonal décor and the printed guest welcome materials.', NULL,
     'Keeps the guest arrival experience current for the season.', 'consult', d0 + 40, 'answered', NULL,
     'Selected and delivered new seasonal décor and welcome materials.', 'Refresh complete.', (d0 + 35)::timestamptz,
     'operations', 'document', NULL, NULL, 24, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Approve the winterization & preventive maintenance plan', 'property_specific', p_willow,
     'Approve the winterization and preventive maintenance plan before the cold season.', 'Do you approve this plan?',
     'Protects the home over the winter months.', 'approve', d0 + 41, 'answered', 'approve',
     'Approved the plan as recommended.', 'Winterization plan approved.', (d0 + 36)::timestamptz,
     'operations', 'approve', NULL, NULL, 25, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Weekly operations sync call', 'program_wide', NULL,
     'A standing weekly sync call on operations at the home.', NULL,
     'Regular owner visibility into day-to-day operations.', 'inform', d0 + 42, 'answered', NULL,
     'Attended the weekly sync call.', 'Sync call complete.', (d0 + 37)::timestamptz,
     'operations', 'attend', NULL, NULL, 26, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — On-site day: fall refresh, vendor walkthroughs and guest-ready inspection', 'property_specific', p_willow,
     'A full on-site day covering the fall refresh, vendor walkthroughs and a guest-ready inspection.', NULL,
     'A hands-on day of direct participation at the home.', 'consult', d0 + 42, 'answered', NULL,
     'Spent the day on site for the fall refresh, three vendor walkthroughs and the guest-ready inspection.',
     'Home confirmed guest-ready for the season.', (d0 + 37)::timestamptz,
     'operations', 'document', NULL, NULL, 27, true),

    -- Available now: open opportunities awaiting the homeowner.
    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Review the fall maintenance walkthrough summary', 'property_specific', p_willow,
     'Fall walkthrough complete — furnace, gutters and exterior lighting all checked out.', 'Anything you would like double-checked before winter?',
     'Keeps the owner current on preventive maintenance.', 'inform', current_date + 7, 'awaiting_owner', NULL, NULL, NULL, NULL,
     'operations', 'review', now() - interval '2 days', NULL, 28, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Approve the winter guest-ready rate adjustment', 'property_specific', p_willow,
     'A $15/night winter adjustment starting next month.', 'Do you approve this adjustment?',
     'Keeps pricing aligned with winter demand.', 'approve', current_date + 5, 'awaiting_owner', NULL, NULL, NULL, NULL,
     'operations', 'approve', now() - interval '1 day', NULL, 29, true),

    (prog, NULL, 'ongoing', 'learning', 'ZZ QA — RSVP: Owner Advisory Council welcome session', 'program_wide', NULL,
     'Join the welcome session for ARHA''s Owner Advisory Council.', NULL,
     'Gives the owner a direct voice in future program changes.', 'inform', current_date + 10, 'awaiting_owner', NULL, NULL, NULL, NULL,
     'program', 'attend', now(), NULL, 30, true),

    (prog, NULL, 'ongoing', 'operations', 'ZZ QA — Year-one performance review call', 'program_wide', NULL,
     'A full year-one performance review call covering all participation and results.', NULL,
     'Closes the loop on the first year of the program.', 'inform', current_date + 20, 'awaiting_owner', NULL, NULL, NULL, NULL,
     'program', 'attend', now() + interval '10 days', 'Opens once the fall maintenance and winter rate items are resolved.', 31, true);

  -- ============ Self-reported participation time (the "participation record") ============
  INSERT INTO public.owner_time_entries
    (program_id, review_id, owner_user_id, phase, entry_date, minutes, activity, activity_category, output, comments,
     attested, review_status, reviewed_by, reviewed_at, review_note, is_demo)
  SELECT prog, r.id, who, v.phase, v.entry_date, v.minutes, v.activity, v.category, v.output, v.comments,
         true, v.rstatus,
         CASE WHEN v.rstatus = 'approved' THEN who ELSE NULL END,
         CASE WHEN v.rstatus = 'approved' THEN (v.entry_date + 1)::timestamptz ELSE NULL END,
         v.rnote, true
  FROM (VALUES
    ('ZZ QA — Attend the onboarding kickoff call', 'onboarding', d0 + 2, 90,
     'Attended the onboarding kickoff call with the onboarding lead.', 'Onboarding meeting',
     'Reviewed the 90-day roadmap and confirmed next steps.', NULL::text, 'approved', NULL::text),

    ('ZZ QA — Review the property assessment & make-ready scope', 'onboarding', d0 + 4, 180,
     'Reviewed the property assessment and make-ready scope line by line.', 'Property assessment review',
     'Flagged two items to add to the punch list.', NULL, 'approved', NULL),

    ('ZZ QA — Walk the home with the onboarding lead', 'onboarding', d0 + 6, 240,
     'Walked the full property with the onboarding lead ahead of make-ready work.', 'Property assessment review',
     'Agreed the punch list on site.', NULL, 'approved', NULL),

    ('ZZ QA — Approve the furnishing & make-ready budget', 'onboarding', d0 + 9, 60,
     'Reviewed and approved the furnishing and make-ready budget.', 'Make-ready or furnishing decision',
     'Approved with no changes.', NULL, 'approved', NULL),

    ('ZZ QA — Select furnishings and décor for the primary living areas', 'onboarding', d0 + 11, 300,
     'Researched furniture options and selected the living-room and primary-bedroom packages.', 'Make-ready or furnishing decision',
     'Selected package B with two fabric swaps.', NULL, 'approved', NULL),

    ('ZZ QA — Review the listing copy and photography set', 'onboarding', d0 + 15, 150,
     'Reviewed the draft listing copy and the full photography select set.', 'Listing, photography or pricing review',
     'Approved with two caption edits.', NULL, 'approved', NULL),

    ('ZZ QA — Approve the pricing floor for the first season', 'onboarding', d0 + 17, 75,
     'Reviewed pricing strategy and approved the first-season weekday floor.', 'Listing, photography or pricing review',
     'Approved the $219 floor.', NULL, 'approved', NULL),

    ('ZZ QA — Review guest experience & house-rules standards', 'onboarding', d0 + 19, 105,
     'Reviewed the standard guest communication templates and house rules for the home.', 'Guest experience or standards',
     'Confirmed as written, no changes.', NULL, 'approved', NULL),

    ('ZZ QA — Read the Owner Participation Program guide', 'ongoing', d0 + 21, 45,
     'Read the Owner Participation Program guide end to end.', 'Other participation',
     'Reviewed how participation hours are counted.', NULL, 'approved', NULL),

    ('ZZ QA — Review the year-one operating budget variance', 'ongoing', d0 + 22, 210,
     'Reviewed the year-one operating budget and where actuals differed from plan.', 'Financial or reporting review',
     'No follow-up questions.', NULL, 'approved', NULL),

    ('ZZ QA — Review the landscaping & hot tub service estimate', 'ongoing', d0 + 23, 90,
     'Reviewed the landscaping and hot tub service vendor estimate.', 'Vendor estimate review',
     'Approved for scheduling.', NULL, 'approved', NULL),

    ('ZZ QA — Review a guest escalation summary and response', 'ongoing', d0 + 24, 105,
     'Reviewed a recent guest escalation and how it was resolved.', 'Guest experience or standards',
     'Agreed with the resolution offered.', NULL, 'approved', NULL),

    ('ZZ QA — Research local short-term rental regulation updates', 'ongoing', d0 + 25, 75,
     'Researched recent short-term rental regulation changes for the local market.', 'Other participation',
     'No action required at this time.', NULL, 'approved', NULL),

    ('ZZ QA — Attend the local market & comp-set briefing', 'ongoing', d0 + 26, 120,
     'Attended the quarterly local market and comp-set briefing.', 'Operating decision',
     'Asked follow-up questions on comp pricing.', NULL, 'approved', NULL),

    ('ZZ QA — Approve a repair estimate over the standing threshold', 'ongoing', d0 + 27, 60,
     'Reviewed and approved a repair estimate over the standing spend threshold.', 'Assessment or maintenance review',
     'Approved as estimated.', NULL, 'approved', NULL),

    ('ZZ QA — Approve the replacement appliance package', 'ongoing', d0 + 28, 120,
     'Reviewed and approved the replacement kitchen appliance package.', 'Make-ready or furnishing decision',
     'Approved the recommended package.', NULL, 'approved', NULL),

    ('ZZ QA — Review the first 30 days operations report', 'ongoing', d0 + 29, 150,
     'Reviewed the first 30 days of operations report for the home.', 'Financial or reporting review',
     'No follow-up questions.', NULL, 'approved', NULL),

    ('ZZ QA — Review the year-one marketing plan draft', 'ongoing', d0 + 30, 240,
     'Reviewed the draft year-one marketing plan and researched two seasonal promotion ideas.', 'Operating decision',
     'Suggested one seasonal promotion, added to the plan.', NULL, 'approved', NULL),

    ('ZZ QA — Participate in the guest review response calibration session', 'ongoing', d0 + 31, 105,
     'Participated in the session calibrating guest review response tone.', 'Guest experience or standards',
     'Shared two example responses.', NULL, 'approved', NULL),

    ('ZZ QA — Approve the holiday-season rate strategy', 'ongoing', d0 + 32, 90,
     'Reviewed and approved the proposed holiday-season rate strategy.', 'Listing, photography or pricing review',
     'Approved as proposed.', NULL, 'approved', NULL),

    ('ZZ QA — Attend the smart-lock & tech install walkthrough', 'ongoing', d0 + 33, 210,
     'Attended the vendor walkthrough for the smart-lock and tech install and approved device placement.', 'Vendor estimate review',
     'Approved the placement of the new devices.', NULL, 'approved', NULL),

    ('ZZ QA — Mid-program check-in call with the operations lead', 'ongoing', d0 + 34, 90,
     'Attended the scheduled mid-program check-in call with the operations lead.', 'Operating decision',
     NULL, NULL, 'submitted', NULL),

    ('ZZ QA — Refresh seasonal décor and guest welcome materials', 'ongoing', d0 + 35, 300,
     'Selected and delivered refreshed seasonal décor and printed guest welcome materials.', 'Guest experience or standards',
     'Refresh complete ahead of the season.', NULL, 'approved', NULL),

    ('ZZ QA — Approve the winterization & preventive maintenance plan', 'ongoing', d0 + 36, 90,
     'Reviewed and approved the winterization and preventive maintenance plan.', 'Assessment or maintenance review',
     'Approved as recommended.', NULL, 'approved', NULL),

    ('ZZ QA — On-site day: fall refresh, vendor walkthroughs and guest-ready inspection', 'ongoing', d0 + 37, 390,
     'Spent the day on site for the fall refresh, three vendor walkthroughs and the final guest-ready inspection.', 'Assessment or maintenance review',
     'Home confirmed guest-ready for the season.', NULL, 'approved', NULL)
  ) AS v(review_title, phase, entry_date, minutes, activity, category, output, comments, rstatus, rnote)
  JOIN public.owner_reviews r ON r.program_id = prog AND r.title = v.review_title;

  -- The returned entry: logged, sent back for a missing property reference, not yet resubmitted.
  INSERT INTO public.owner_time_entries
    (program_id, review_id, owner_user_id, phase, entry_date, minutes, activity, activity_category, output,
     attested, review_status, reviewed_by, reviewed_at, review_note, is_demo)
  SELECT prog, r.id, who, 'ongoing', d0 + 20, 45,
     'Call about the winter pricing strategy.', 'Listing, photography or pricing review', 'Decision pending.',
     true, 'returned', who, (d0 + 21)::timestamptz,
     'Please note which property this call covered before we can approve it.', true
  FROM public.owner_reviews r WHERE r.program_id = prog AND r.title = 'ZZ QA — Confirm the pricing call notes';

  -- A correction chain: an entry amended once, so the record shows how corrections work.
  SELECT id INTO r_misc_id FROM public.owner_reviews WHERE program_id = prog AND title = 'ZZ QA — Weekly operations sync call';

  INSERT INTO public.owner_time_entries
    (program_id, review_id, owner_user_id, phase, entry_date, minutes, activity, activity_category, attested, review_status, reviewed_by, reviewed_at, is_demo)
  VALUES
    (prog, r_misc_id, who, 'ongoing', d0 + 37, 30, 'Weekly operations sync call (initial log).', 'Operating decision', true, 'approved', who, (d0 + 37)::timestamptz, true)
  RETURNING id INTO e_misc_a;

  INSERT INTO public.owner_time_entries
    (program_id, review_id, owner_user_id, phase, entry_date, minutes, activity, activity_category, output,
     attested, review_status, reviewed_by, reviewed_at, amends_entry_id, correction_reason, is_demo)
  VALUES
    (prog, r_misc_id, who, 'ongoing', d0 + 37, 60, 'Weekly operations sync call.', 'Operating decision',
     'Confirmed follow-ups with the operations lead.', true, 'approved', who, (d0 + 37)::timestamptz,
     e_misc_a, 'Corrected the call length — the calendar showed 60 minutes, not 30.', true);

  -- Every entry is about this one demo home.
  INSERT INTO public.owner_time_entry_properties (entry_id, property_id)
  SELECT e.id, p_willow FROM public.owner_time_entries e WHERE e.program_id = prog;

  -- ============ Milestones (pre-populated so a staff preview shows them without a live sync) ============
  INSERT INTO public.owner_badges (program_id, code, awarded_at, trigger_rule, supporting)
  VALUES
    (prog, 'first_step', (d0 + 2)::timestamptz, 'First participation entry recorded',
     jsonb_build_object('reportedMinutes', 90)),
    (prog, 'decision_maker', (d0 + 9)::timestamptz, 'First owner decision completed',
     jsonb_build_object('review', 'ZZ QA — Approve the furnishing & make-ready budget')),
    (prog, 'building_momentum', (d0 + 11)::timestamptz, '10 reported hours reached',
     jsonb_build_object('reportedMinutes', 870)),
    (prog, 'consistent_participation', (d0 + 15)::timestamptz, 'Activity reported in 3 separate program weeks',
     jsonb_build_object('weeks', 3)),
    (prog, 'engaged_owner', (d0 + 23)::timestamptz, '25 reported hours reached',
     jsonb_build_object('reportedMinutes', 1545)),
    (prog, 'halfway', (d0 + 35)::timestamptz, '50 reported hours reached',
     jsonb_build_object('reportedMinutes', 3210)),
    (prog, 'onboarding_champion', (d0 + 37)::timestamptz, '60 reported hours with all onboarding activities complete',
     jsonb_build_object('reportedMinutes', 3750));

  -- ============ Program history ============
  INSERT INTO public.owner_program_events (program_id, kind, summary, actor_id, created_at)
  VALUES
    (prog, 'program_created', 'Program created for Dana Reyes (ZZ QA AO — Willow).', who, d0::timestamptz),
    (prog, 'property_added', 'ZZ QA AO — Willow added to the program.', who, d0::timestamptz),
    (prog, 'program_activated', 'Program activated — 100-hour combined participation goal set.', who, d0::timestamptz),
    (prog, 'roadmap_seeded', 'Initial onboarding roadmap of participation opportunities published.', who, (d0 + 1)::timestamptz),
    (prog, 'badge_awarded', 'Badge earned: First Step', who, (d0 + 2)::timestamptz),
    (prog, 'badge_awarded', 'Badge earned: Decision Maker', who, (d0 + 9)::timestamptz),
    (prog, 'badge_awarded', 'Badge earned: Building Momentum', who, (d0 + 11)::timestamptz),
    (prog, 'badge_awarded', 'Badge earned: Consistent Participation', who, (d0 + 15)::timestamptz),
    (prog, 'badge_awarded', 'Badge earned: Engaged Owner', who, (d0 + 23)::timestamptz),
    (prog, 'badge_awarded', 'Badge earned: Halfway Milestone', who, (d0 + 35)::timestamptz),
    (prog, 'badge_awarded', 'Badge earned: Onboarding Champion', who, (d0 + 37)::timestamptz);

  RETURN prog;
END; $$;

REVOKE ALL ON FUNCTION public.seed_demo_active_owner_showcase(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_active_owner_showcase(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.archive_demo_active_owner_showcase(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_demo_active_owner_showcase(uuid) TO service_role;
