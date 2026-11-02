-- Exact undo for wording v1: restores every old value, guarded on the new value.
DO $do$
BEGIN
UPDATE public.onboarding_template_tasks SET title = overlay(title placing $w$Investment Readiness Call$w$ from 52 for 14) WHERE id = '08e85522-4f53-4236-833d-05da550b2f8f' AND md5(title::text) = 'e60bec2c4dc9b93c528948b7c1b055e5';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 08e85522-4f53-4236-833d-05da550b2f8f title'; END IF;
IF (SELECT md5(title::text) FROM public.onboarding_template_tasks WHERE id = '08e85522-4f53-4236-833d-05da550b2f8f') <> '3b1a3d30c5c50ac0ce2298dbfd47bdeb' THEN RAISE EXCEPTION 'result mismatch: 08e85522-4f53-4236-833d-05da550b2f8f title'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$Investment Readiness$w$ from 1178 for 9) placing $w$Investment Readiness Call$w$ from 148 for 14) WHERE id = '08e85522-4f53-4236-833d-05da550b2f8f' AND md5(detail::text) = 'edf7f39fe486dcaf5926203559a6d77c';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 08e85522-4f53-4236-833d-05da550b2f8f detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '08e85522-4f53-4236-833d-05da550b2f8f') <> '3c6d0187407ba2afdbab5be227c8262d' THEN RAISE EXCEPTION 'result mismatch: 08e85522-4f53-4236-833d-05da550b2f8f detail'; END IF;
UPDATE public.onboarding_template_tasks SET title = overlay(title placing $w$Investment Readiness Call invite$w$ from 16 for 21) WHERE id = '8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0' AND md5(title::text) = 'eaf0a6b1f365d181503404b272bcfb7e';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0 title'; END IF;
IF (SELECT md5(title::text) FROM public.onboarding_template_tasks WHERE id = '8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0') <> '7f5bc6e3a264a088c140b0798f375bcc' THEN RAISE EXCEPTION 'result mismatch: 8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0 title'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(detail placing $w$investment$w$ from 905 for 4) placing $w$Investment Readiness Call$w$ from 454 for 14) placing $w$Investment Readiness Call$w$ from 242 for 14) WHERE id = '8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0' AND md5(detail::text) = '38db21f52bfb0298865439253a0b3195';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0') <> '3d3f8ac510d99e85730fe176dd0fb559' THEN RAISE EXCEPTION 'result mismatch: 8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0 detail'; END IF;
UPDATE public.onboarding_template_tasks SET title = overlay(title placing $w$Investment Readiness Call$w$ from 16 for 14) WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49' AND md5(title::text) = '3be2c98726aa11aaae97c61833697de3';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49 title'; END IF;
IF (SELECT md5(title::text) FROM public.onboarding_template_tasks WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49') <> 'b02db491eaeb3cf2eb631e7ffd5762d8' THEN RAISE EXCEPTION 'result mismatch: ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49 title'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hour. Release: as soon as the call is held.$w$ from 1433 for 0) placing $w$investment$w$ from 955 for 6) placing $w$ on this step$w$ from 749 for 0) placing $w$set up in Resolve$w$ from 669 for 27) placing $w$Update this step's$w$ from 201 for 7) WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49' AND md5(detail::text) = 'e2c2ba55d585e3674705131cadc92d28';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49') <> '958ded4f8b0d908d340b1df05952b65a' THEN RAISE EXCEPTION 'result mismatch: ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(overlay(overlay(opportunity::text placing $w$Owner Investment Readiness Call"}$w$ from 539 for 28) placing $w$Owner Investment Readiness Call$w$ from 424 for 26) placing $w$investment$w$ from 196 for 4) placing $w$the length of your call in the time field$w$ from 16 for 24))::jsonb WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49' AND md5(opportunity::text) = '0fddcca8ca940293a3ae2b97244c4a0d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = 'ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49') <> '7959f184d01f86b2d789a4e5d9123352' THEN RAISE EXCEPTION 'result mismatch: ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '027c0af0-277e-4e4c-a682-0f48eef4b7b0' AND md5(detail::text) = '318f96bb8e4d19663c296079cb4745d0';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 027c0af0-277e-4e4c-a682-0f48eef4b7b0 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '027c0af0-277e-4e4c-a682-0f48eef4b7b0') <> 'ddc445b760a3169ff3c53c69782a382b' THEN RAISE EXCEPTION 'result mismatch: 027c0af0-277e-4e4c-a682-0f48eef4b7b0 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'e5e41d29-dcaa-45f8-9e15-9a6199a0ed6e' AND md5(detail::text) = '3a57b133461b7a7488a40bf8d5b99c46';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: e5e41d29-dcaa-45f8-9e15-9a6199a0ed6e detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'e5e41d29-dcaa-45f8-9e15-9a6199a0ed6e') <> '656edd24b5ef32f391b90ce0081e2f51' THEN RAISE EXCEPTION 'result mismatch: e5e41d29-dcaa-45f8-9e15-9a6199a0ed6e detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: as soon as the walkthrough video is filmed.

$w$ from 1013 for 0) WHERE id = '9c26d406-c71f-4802-b14f-36dfe5164839' AND md5(detail::text) = 'fe1644f44b5de6dec9726ce1355b6a5f';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 9c26d406-c71f-4802-b14f-36dfe5164839 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '9c26d406-c71f-4802-b14f-36dfe5164839') <> '3a08b1dc4e2d4a822f3c6b99c03b5c83' THEN RAISE EXCEPTION 'result mismatch: 9c26d406-c71f-4802-b14f-36dfe5164839 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: after Kade has reviewed the covenants.

$w$ from 1457 for 0) WHERE id = '5d5be939-b373-4693-bf33-926f8f7658c4' AND md5(detail::text) = '6f38855e07f9e3292d6af74b6655be09';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 5d5be939-b373-4693-bf33-926f8f7658c4 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '5d5be939-b373-4693-bf33-926f8f7658c4') <> 'ddf57ef7788ba85724c8b8c84cc282aa' THEN RAISE EXCEPTION 'result mismatch: 5d5be939-b373-4693-bf33-926f8f7658c4 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback, Upload / Documentation. Suggested time 1.5 hours. Release: when the inspection report is received.

$w$ from 1389 for 0) WHERE id = '279f478e-a393-43b4-b691-90cdadaa3f5d' AND md5(detail::text) = 'dbb50b5d98c500798369f1dc6e08df8b';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 279f478e-a393-43b4-b691-90cdadaa3f5d detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '279f478e-a393-43b4-b691-90cdadaa3f5d') <> '82ac50a8b99becdd133e6ad09a16ef12' THEN RAISE EXCEPTION 'result mismatch: 279f478e-a393-43b4-b691-90cdadaa3f5d detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Landscaping

$w$ from 1 for 0) WHERE id = 'e1cf0100-6af7-4240-adf2-672f799d2553' AND md5(detail::text) = 'd4588ae811ca118cfcbece98f5770e5d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: e1cf0100-6af7-4240-adf2-672f799d2553 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'e1cf0100-6af7-4240-adf2-672f799d2553') <> '81346f3e6ff4725de4ebe8e547070092' THEN RAISE EXCEPTION 'result mismatch: e1cf0100-6af7-4240-adf2-672f799d2553 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(detail placing $w$Investment Readiness Call$w$ from 481 for 14) placing $w$ once the assessment is done, not a list of things to send$w$ from 158 for 0) placing $w$This step is a$w$ from 103 for 28) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '7c6b189e-e4c7-4ef4-b26a-5c5e2ae623aa' AND md5(detail::text) = 'a3d6d654298010f7c8734f311b3abb19';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 7c6b189e-e4c7-4ef4-b26a-5c5e2ae623aa detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '7c6b189e-e4c7-4ef4-b26a-5c5e2ae623aa') <> 'ea32f369c9877597eb09b3ff454dfe32' THEN RAISE EXCEPTION 'result mismatch: 7c6b189e-e4c7-4ef4-b26a-5c5e2ae623aa detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '387e2082-354b-4314-ab22-42a24cb14654' AND md5(detail::text) = 'd0a1f395c1e834201a16eee5bce506e7';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 387e2082-354b-4314-ab22-42a24cb14654 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '387e2082-354b-4314-ab22-42a24cb14654') <> '9bb69be1277ce0754921f5285bd1c49e' THEN RAISE EXCEPTION 'result mismatch: 387e2082-354b-4314-ab22-42a24cb14654 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Utilities Option 1 or 2

$w$ from 1 for 0) WHERE id = 'bca10155-f463-454b-8bbd-e69b36bbf8d8' AND md5(detail::text) = '8b608f457a904f7d93032513fc35a001';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: bca10155-f463-454b-8bbd-e69b36bbf8d8 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'bca10155-f463-454b-8bbd-e69b36bbf8d8') <> '56daab2e0a12c0aba585b03be599685a' THEN RAISE EXCEPTION 'result mismatch: bca10155-f463-454b-8bbd-e69b36bbf8d8 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$it unassigned$w$ from 334 for 16) placing $w$Applies only when: Utilities Option 1 or 2

$w$ from 1 for 0) WHERE id = '24c89ace-256f-4b47-b9cc-b856e15bf204' AND md5(detail::text) = 'f3e6244a81f41f4b91c5d8f6b42c5c9f';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 24c89ace-256f-4b47-b9cc-b856e15bf204 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '24c89ace-256f-4b47-b9cc-b856e15bf204') <> 'cae255d7c3b93607283e55d08d1c7d79' THEN RAISE EXCEPTION 'result mismatch: 24c89ace-256f-4b47-b9cc-b856e15bf204 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Business Decision. Suggested time 1 hours. Release: at Access Confirmed.

$w$ from 1476 for 0) WHERE id = '3621f91b-80aa-4e90-b92f-f978c7fb6743' AND md5(detail::text) = '7b6f32356f0843a4bf6964fd848bc88c';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 3621f91b-80aa-4e90-b92f-f978c7fb6743 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '3621f91b-80aa-4e90-b92f-f978c7fb6743') <> 'e61c4644e89b4ee2493d417327e18f9e' THEN RAISE EXCEPTION 'result mismatch: 3621f91b-80aa-4e90-b92f-f978c7fb6743 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(opportunity::text placing $w$investment$w$ from 505 for 5) placing $w$[date]$w$ from 297 for 18))::jsonb WHERE id = '3621f91b-80aa-4e90-b92f-f978c7fb6743' AND md5(opportunity::text) = '532c0be50ae408786e2026f14afab428';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 3621f91b-80aa-4e90-b92f-f978c7fb6743 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '3621f91b-80aa-4e90-b92f-f978c7fb6743') <> 'da25bcdc71ee1901d9e8f33f9fe10e04' THEN RAISE EXCEPTION 'result mismatch: 3621f91b-80aa-4e90-b92f-f978c7fb6743 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '312e80da-8d3a-4930-84b9-092b4af0d18a' AND md5(detail::text) = '47d5489ec689924c0d16aef4c588c745';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 312e80da-8d3a-4930-84b9-092b4af0d18a detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '312e80da-8d3a-4930-84b9-092b4af0d18a') <> '5ea830ab372c54b13be2902dcc1cf312' THEN RAISE EXCEPTION 'result mismatch: 312e80da-8d3a-4930-84b9-092b4af0d18a detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '5e506db6-8eaa-4ea0-8491-2b4ef174e46b' AND md5(detail::text) = 'b943302c9ea2cc9968af88ba8bbb1b6d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 5e506db6-8eaa-4ea0-8491-2b4ef174e46b detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '5e506db6-8eaa-4ea0-8491-2b4ef174e46b') <> 'f08ecb9f3710ef63e9844a4186226d00' THEN RAISE EXCEPTION 'result mismatch: 5e506db6-8eaa-4ea0-8491-2b4ef174e46b detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Utilities Option 1 or 2

$w$ from 1 for 0) WHERE id = '16cbd2b8-c5e1-437b-a88a-126fa0092464' AND md5(detail::text) = '5acbe9ba86b4a05cace1ceed9cd1505c';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 16cbd2b8-c5e1-437b-a88a-126fa0092464 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '16cbd2b8-c5e1-437b-a88a-126fa0092464') <> 'b126c2347858b9ca0a3db9402f8d9001' THEN RAISE EXCEPTION 'result mismatch: 16cbd2b8-c5e1-437b-a88a-126fa0092464 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Utilities Option 1 or 2

$w$ from 1 for 0) WHERE id = '555974cf-be85-4819-b71d-ca8fc2bfde74' AND md5(detail::text) = 'cec1aa9ecde6f007399583158303a093';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 555974cf-be85-4819-b71d-ca8fc2bfde74 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '555974cf-be85-4819-b71d-ca8fc2bfde74') <> '514863dddf40a19419866126e61bee36' THEN RAISE EXCEPTION 'result mismatch: 555974cf-be85-4819-b71d-ca8fc2bfde74 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Utilities Option 1 or 2

$w$ from 1 for 0) WHERE id = 'dc580210-fbbf-462d-88d9-086668f43856' AND md5(detail::text) = '2e03bc1f4037a6223e0b38360df647e9';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: dc580210-fbbf-462d-88d9-086668f43856 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'dc580210-fbbf-462d-88d9-086668f43856') <> '0c6f1f42625330b86dd6f45260bdf388' THEN RAISE EXCEPTION 'result mismatch: dc580210-fbbf-462d-88d9-086668f43856 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Utilities Option 1 or 2

$w$ from 1 for 0) WHERE id = '35fe9a3c-57db-4e7a-a4e9-04c20db157a6' AND md5(detail::text) = 'a7b3e01cb1fb8014f367ae879a970d3b';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 35fe9a3c-57db-4e7a-a4e9-04c20db157a6 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '35fe9a3c-57db-4e7a-a4e9-04c20db157a6') <> '4432fb05f071a35ad1eafda27904b1a4' THEN RAISE EXCEPTION 'result mismatch: 35fe9a3c-57db-4e7a-a4e9-04c20db157a6 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 498 for 69) placing $w$exists in Breezeway, unassigned$w$ from 423 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 238 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Cameras

$w$ from 1 for 0) WHERE id = '7f13b627-0b92-4d63-b050-8ce04f521bb4' AND md5(detail::text) = '2675f5cc383ffca37533ae1105f1a1fb';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 7f13b627-0b92-4d63-b050-8ce04f521bb4 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '7f13b627-0b92-4d63-b050-8ce04f521bb4') <> 'b1534bee5576ec72696a8b937585ccdd' THEN RAISE EXCEPTION 'result mismatch: 7f13b627-0b92-4d63-b050-8ce04f521bb4 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Utilities Option 1 or 2

$w$ from 1 for 0) WHERE id = 'f9d6fe0a-6199-4f0c-a836-9f9666c7446c' AND md5(detail::text) = 'c28b8ee33e79ad9a36fedffa48f6fb41';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f9d6fe0a-6199-4f0c-a836-9f9666c7446c detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'f9d6fe0a-6199-4f0c-a836-9f9666c7446c') <> '35d5cf7f332b1ffd5003b7d24f9aec01' THEN RAISE EXCEPTION 'result mismatch: f9d6fe0a-6199-4f0c-a836-9f9666c7446c detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '4f153a95-fdd6-445f-b411-547a88cb0693' AND md5(detail::text) = '074789bc6474f4c7a6efbece93aa79a4';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4f153a95-fdd6-445f-b411-547a88cb0693 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '4f153a95-fdd6-445f-b411-547a88cb0693') <> 'd8929f97256ca54a493ebf8f050453f2' THEN RAISE EXCEPTION 'result mismatch: 4f153a95-fdd6-445f-b411-547a88cb0693 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 546 for 69) placing $w$exists in Breezeway, unassigned$w$ from 471 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 286 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = 'ffe2dea4-0281-48a6-9b30-82882d596248' AND md5(detail::text) = '0d34fef0964d0d4e3403c5f074c85aa6';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ffe2dea4-0281-48a6-9b30-82882d596248 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'ffe2dea4-0281-48a6-9b30-82882d596248') <> '546ea1c410076c36b0c1294b79d9fa78' THEN RAISE EXCEPTION 'result mismatch: ffe2dea4-0281-48a6-9b30-82882d596248 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 526 for 69) placing $w$exists in Breezeway, unassigned$w$ from 451 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 266 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '1755bf2c-2e72-43f7-a27b-64cbb4c16045' AND md5(detail::text) = '2e2ce18c4ffc08ecf361790a9b848c34';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 1755bf2c-2e72-43f7-a27b-64cbb4c16045 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '1755bf2c-2e72-43f7-a27b-64cbb4c16045') <> '6564927ad2aef9cda26d1e8478f4de7b' THEN RAISE EXCEPTION 'result mismatch: 1755bf2c-2e72-43f7-a27b-64cbb4c16045 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 544 for 69) placing $w$exists in Breezeway, unassigned$w$ from 469 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 284 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '20ea3445-8428-486b-9f44-a42405a2dfad' AND md5(detail::text) = '27fe50f845d4d9f8978f93d4a0527c39';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 20ea3445-8428-486b-9f44-a42405a2dfad detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '20ea3445-8428-486b-9f44-a42405a2dfad') <> '6d70f8241f20609041abf1c94e1236bd' THEN RAISE EXCEPTION 'result mismatch: 20ea3445-8428-486b-9f44-a42405a2dfad detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 692 for 69) placing $w$exists in Breezeway, unassigned$w$ from 617 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 432 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Smart lock

$w$ from 1 for 0) WHERE id = '66dc5646-0288-4ce5-8ae3-eb858c2cb8bc' AND md5(detail::text) = '0ba289fdbf3e686734597f2747d6128b';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 66dc5646-0288-4ce5-8ae3-eb858c2cb8bc detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '66dc5646-0288-4ce5-8ae3-eb858c2cb8bc') <> '7813789f67692d2a8356237675835063' THEN RAISE EXCEPTION 'result mismatch: 66dc5646-0288-4ce5-8ae3-eb858c2cb8bc detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 659 for 69) placing $w$exists in Breezeway, unassigned$w$ from 584 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 399 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Cameras

$w$ from 1 for 0) WHERE id = 'd3d12568-5842-4736-98c2-5b21b2464b97' AND md5(detail::text) = 'db0637d5788a6ca642f20a08c746c524';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: d3d12568-5842-4736-98c2-5b21b2464b97 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'd3d12568-5842-4736-98c2-5b21b2464b97') <> '846cdca13cafd2b11d4eaf4587d9d0aa' THEN RAISE EXCEPTION 'result mismatch: d3d12568-5842-4736-98c2-5b21b2464b97 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'd65945dd-ea4b-4a33-a6a7-305b599b55ee' AND md5(detail::text) = 'e3b0640a2ba823cf37f7cef49ef016f1';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: d65945dd-ea4b-4a33-a6a7-305b599b55ee detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'd65945dd-ea4b-4a33-a6a7-305b599b55ee') <> '905cbd3e5323c96fda3cfda4547f67ac' THEN RAISE EXCEPTION 'result mismatch: d65945dd-ea4b-4a33-a6a7-305b599b55ee detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 540 for 69) placing $w$exists in Breezeway, unassigned$w$ from 465 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 280 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = 'c1fbc7bc-8a9d-44a0-a41d-37ca63bca9c0' AND md5(detail::text) = '549c5f829084cd1ffc0bea85a16b2aec';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: c1fbc7bc-8a9d-44a0-a41d-37ca63bca9c0 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'c1fbc7bc-8a9d-44a0-a41d-37ca63bca9c0') <> '92ea1d508a6ed0f788e6b4e165e31fb5' THEN RAISE EXCEPTION 'result mismatch: c1fbc7bc-8a9d-44a0-a41d-37ca63bca9c0 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 605 for 69) placing $w$exists in Breezeway, unassigned$w$ from 530 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 345 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '9d30cf1e-8dae-47b5-ad76-5de144ef22fb' AND md5(detail::text) = 'ca553dfd65055f0dbeb391a59ba3b7de';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 9d30cf1e-8dae-47b5-ad76-5de144ef22fb detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '9d30cf1e-8dae-47b5-ad76-5de144ef22fb') <> '7442ab5d7ff88006887bfe5a861fda1a' THEN RAISE EXCEPTION 'result mismatch: 9d30cf1e-8dae-47b5-ad76-5de144ef22fb detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 608 for 69) placing $w$exists in Breezeway, unassigned$w$ from 533 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 348 for 86) placing $w$with one click the moment$w$ from 62 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '9e6dcf79-221f-415e-98a8-eff6ec1adcb8' AND md5(detail::text) = 'fb121e7e63202e2e35dd9e1c1019204c';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 9e6dcf79-221f-415e-98a8-eff6ec1adcb8 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '9e6dcf79-221f-415e-98a8-eff6ec1adcb8') <> 'a84447f40beb12f2a13cbf7a4d14e105' THEN RAISE EXCEPTION 'result mismatch: 9e6dcf79-221f-415e-98a8-eff6ec1adcb8 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 599 for 69) placing $w$exists in Breezeway, unassigned$w$ from 489 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 304 for 86) placing $w$with one click the moment$w$ from 68 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '7230e418-82ac-4633-9e8b-ebaa9615f46b' AND md5(detail::text) = '2b43b05a5e0bd1167fd12306844b67f7';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 7230e418-82ac-4633-9e8b-ebaa9615f46b detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '7230e418-82ac-4633-9e8b-ebaa9615f46b') <> 'db63fc508655726115edfea56ca482f9' THEN RAISE EXCEPTION 'result mismatch: 7230e418-82ac-4633-9e8b-ebaa9615f46b detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 698 for 69) placing $w$exists in Breezeway, unassigned$w$ from 588 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 403 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '4dab5286-4811-413c-9b86-e6f2ac51ee6d' AND md5(detail::text) = 'f12329b9824239a965c2b37a5021154b';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4dab5286-4811-413c-9b86-e6f2ac51ee6d detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '4dab5286-4811-413c-9b86-e6f2ac51ee6d') <> '8465904416baddd65f388821c5a64072' THEN RAISE EXCEPTION 'result mismatch: 4dab5286-4811-413c-9b86-e6f2ac51ee6d detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 540 for 69) placing $w$exists in Breezeway, unassigned$w$ from 430 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 245 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = 'cc5ba7ab-4f1e-4fd6-934a-05ffb22866a9' AND md5(detail::text) = '04e03cf2e7e8ae58c5099cb6231b86de';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: cc5ba7ab-4f1e-4fd6-934a-05ffb22866a9 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'cc5ba7ab-4f1e-4fd6-934a-05ffb22866a9') <> 'cf7e1e3b929ad2d93ac8c25b100fe564' THEN RAISE EXCEPTION 'result mismatch: cc5ba7ab-4f1e-4fd6-934a-05ffb22866a9 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 643 for 69) placing $w$exists in Breezeway, unassigned$w$ from 533 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 348 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Landscaping

$w$ from 1 for 0) WHERE id = '4d405ddc-89ad-46e1-a83e-d2a0eeaaa19b' AND md5(detail::text) = '4bd517ef9a0b54118c22bc1ff8ed20c2';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4d405ddc-89ad-46e1-a83e-d2a0eeaaa19b detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '4d405ddc-89ad-46e1-a83e-d2a0eeaaa19b') <> 'dcb4f38f0087953c9e83c45e3fc4ea69' THEN RAISE EXCEPTION 'result mismatch: 4d405ddc-89ad-46e1-a83e-d2a0eeaaa19b detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 653 for 69) placing $w$exists in Breezeway, unassigned$w$ from 578 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 393 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'ecd8830d-3aca-4be3-954f-7d93e2109586' AND md5(detail::text) = 'b8a4f0e46001785f0f271f0083e018dc';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ecd8830d-3aca-4be3-954f-7d93e2109586 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'ecd8830d-3aca-4be3-954f-7d93e2109586') <> 'a11228a2622bc856cc2d232f80a48349' THEN RAISE EXCEPTION 'result mismatch: ecd8830d-3aca-4be3-954f-7d93e2109586 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 636 for 69) placing $w$exists in Breezeway, unassigned$w$ from 561 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 376 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'c0f6fd38-690e-4989-82b5-c79d2dfa6d20' AND md5(detail::text) = 'b745f236358d47c55f94ac19bfa81b0a';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: c0f6fd38-690e-4989-82b5-c79d2dfa6d20 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'c0f6fd38-690e-4989-82b5-c79d2dfa6d20') <> '50cfba0dd28660c66f4ab4ae65467dce' THEN RAISE EXCEPTION 'result mismatch: c0f6fd38-690e-4989-82b5-c79d2dfa6d20 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 619 for 69) placing $w$exists in Breezeway, unassigned$w$ from 544 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 359 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '81d5c0a3-a786-4e6e-8edb-e3be58980079' AND md5(detail::text) = 'f09b453b2d971253beeef74f7ec3edab';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 81d5c0a3-a786-4e6e-8edb-e3be58980079 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '81d5c0a3-a786-4e6e-8edb-e3be58980079') <> 'e1c88cb0a65d4887a30fd6fb6da6fca9' THEN RAISE EXCEPTION 'result mismatch: 81d5c0a3-a786-4e6e-8edb-e3be58980079 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 548 for 69) placing $w$exists in Breezeway, unassigned$w$ from 473 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 288 for 86) placing $w$with one click the moment$w$ from 63 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '357d4b7e-6b58-4bd4-8c30-297dd485ec64' AND md5(detail::text) = '8ed410fe8aefb27d96d8a00486b05248';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 357d4b7e-6b58-4bd4-8c30-297dd485ec64 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '357d4b7e-6b58-4bd4-8c30-297dd485ec64') <> '8ac36a8b731a3860ac60d50c5f0459aa' THEN RAISE EXCEPTION 'result mismatch: 357d4b7e-6b58-4bd4-8c30-297dd485ec64 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 488 for 69) placing $w$exists in Breezeway, unassigned$w$ from 413 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 228 for 86) placing $w$with one click the moment$w$ from 67 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '5520a82d-b3cd-4117-ac70-230e7d05917f' AND md5(detail::text) = 'df29f86b0dc9288757e6545649778739';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 5520a82d-b3cd-4117-ac70-230e7d05917f detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '5520a82d-b3cd-4117-ac70-230e7d05917f') <> '3fbf7b93a510bb5ad2e94ec25cbe013d' THEN RAISE EXCEPTION 'result mismatch: 5520a82d-b3cd-4117-ac70-230e7d05917f detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 533 for 69) placing $w$exists in Breezeway, unassigned$w$ from 458 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 273 for 86) placing $w$with one click the moment$w$ from 62 for 10) placing $w$Created$w$ from 18 for 10) WHERE id = '89de1930-a898-43ad-8f07-ef6a9938e4e7' AND md5(detail::text) = '0ea9eb84bdbe1717437eee816cf96ac6';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 89de1930-a898-43ad-8f07-ef6a9938e4e7 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '89de1930-a898-43ad-8f07-ef6a9938e4e7') <> '1144204345e8780bafbdbecefe595789' THEN RAISE EXCEPTION 'result mismatch: 89de1930-a898-43ad-8f07-ef6a9938e4e7 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 619 for 69) placing $w$exists in Breezeway, unassigned$w$ from 544 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 359 for 86) placing $w$with one click the moment$w$ from 67 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'b1fc4747-cb38-42f7-a7e2-0406204e8a16' AND md5(detail::text) = '6271ee5c3a680c4734e7a863ea96fc8d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: b1fc4747-cb38-42f7-a7e2-0406204e8a16 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'b1fc4747-cb38-42f7-a7e2-0406204e8a16') <> '92e49c2e219bcf4451fff93e25e1e8e7' THEN RAISE EXCEPTION 'result mismatch: b1fc4747-cb38-42f7-a7e2-0406204e8a16 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(overlay(overlay(detail placing $w$Creating it early is the point. Assigning before closing is confirmed risks vendors showing$w$ from 485 for 69) placing $w$exists in Breezeway, unassigned$w$ from 410 for 58) placing $w$Leave it unassigned and undated. It gets assigned and scheduled in Ordering & Repairs after Access Confirmed$w$ from 225 for 86) placing $w$with one click the moment$w$ from 67 for 10) placing $w$Created$w$ from 18 for 10) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '4e7b52d3-08f5-496c-8b4d-6b50f4a3396b' AND md5(detail::text) = '32cf5648805e2e07fa836e64c5a204d9';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4e7b52d3-08f5-496c-8b4d-6b50f4a3396b detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '4e7b52d3-08f5-496c-8b4d-6b50f4a3396b') <> 'd9fb1b4c38abc5a64d28302afe576bb5' THEN RAISE EXCEPTION 'result mismatch: 4e7b52d3-08f5-496c-8b4d-6b50f4a3396b detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Leave it unassigned$w$ from 411 for 39) WHERE id = 'd83bcb2c-5a46-4ac6-bc06-72b2ec64f767' AND md5(detail::text) = 'ecfcffa3085ce181db642985b96bab22';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: d83bcb2c-5a46-4ac6-bc06-72b2ec64f767 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'd83bcb2c-5a46-4ac6-bc06-72b2ec64f767') <> '920107a3ffde2c9bc8ebe0d66bb5e3cc' THEN RAISE EXCEPTION 'result mismatch: d83bcb2c-5a46-4ac6-bc06-72b2ec64f767 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '3ca504a8-80fb-4f09-bb62-d68fc2163c96' AND md5(detail::text) = '25b3cfab50b1b4697bc213b2933f5c7d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 3ca504a8-80fb-4f09-bb62-d68fc2163c96 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '3ca504a8-80fb-4f09-bb62-d68fc2163c96') <> 'f3adcbd6c625de8b992a2e7ad03dd84d' THEN RAISE EXCEPTION 'result mismatch: 3ca504a8-80fb-4f09-bb62-d68fc2163c96 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'a5f0ddbd-1aaa-472a-b3af-22d9b9fb4284' AND md5(detail::text) = '9bc0f55287dd6351fb022b6df578672b';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: a5f0ddbd-1aaa-472a-b3af-22d9b9fb4284 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'a5f0ddbd-1aaa-472a-b3af-22d9b9fb4284') <> '2e4b5236d153db8c5a5ecaf08a7a7ce7' THEN RAISE EXCEPTION 'result mismatch: a5f0ddbd-1aaa-472a-b3af-22d9b9fb4284 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Standard owner

$w$ from 1 for 0) WHERE id = '5f240dcd-ec8d-4ee0-be20-20d295c66bac' AND md5(detail::text) = '58a0643dc8e6cf18ec6a446442134f34';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 5f240dcd-ec8d-4ee0-be20-20d295c66bac detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '5f240dcd-ec8d-4ee0-be20-20d295c66bac') <> '324d81c73d77b112e4fbce9804af7a9c' THEN RAISE EXCEPTION 'result mismatch: 5f240dcd-ec8d-4ee0-be20-20d295c66bac detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '64a5d543-41df-4c52-813d-bdf7e2682726' AND md5(detail::text) = '91d291abd48296694e29f853b673fba5';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 64a5d543-41df-4c52-813d-bdf7e2682726 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '64a5d543-41df-4c52-813d-bdf7e2682726') <> 'a30f029a7bfc52cbcb775607bf3495a7' THEN RAISE EXCEPTION 'result mismatch: 64a5d543-41df-4c52-813d-bdf7e2682726 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '48ce9f5c-22aa-44b3-933f-ceca0d01c9e5' AND md5(detail::text) = 'a6608a8289fa9c8e54be17192b379c64';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 48ce9f5c-22aa-44b3-933f-ceca0d01c9e5 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '48ce9f5c-22aa-44b3-933f-ceca0d01c9e5') <> 'a5bdc731d93c90665f93aabef2dddc27' THEN RAISE EXCEPTION 'result mismatch: 48ce9f5c-22aa-44b3-933f-ceca0d01c9e5 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1.5 (2 for larger homes) hours. Release: within 1 to 2 days of closing.$w$ from 1577 for 0) placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5' AND md5(detail::text) = '949a960ede6eca06cc8568e91fc8a714';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 465ed7be-2ae9-497f-857f-447553df16c5 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5') <> '4f561dfe3a4a4b9a2e6f45d516c9f8e4' THEN RAISE EXCEPTION 'result mismatch: 465ed7be-2ae9-497f-857f-447553df16c5 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(opportunity::text placing $w$[date]$w$ from 260 for 18))::jsonb WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5' AND md5(opportunity::text) = '60efdc5723ebf4efc5bc1d6da186fb10';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 465ed7be-2ae9-497f-857f-447553df16c5 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5') <> '230e96ac6ac39579fe529982f8ceb951' THEN RAISE EXCEPTION 'result mismatch: 465ed7be-2ae9-497f-857f-447553df16c5 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Business Decision. Suggested time 1 hours. Release: when the PMA is sent.

$w$ from 1231 for 0) WHERE id = '263f7c5c-5df2-4d0d-943d-e2603a0f8139' AND md5(detail::text) = '9d725a250f79c66c2af33e182bd114bb';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 263f7c5c-5df2-4d0d-943d-e2603a0f8139 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '263f7c5c-5df2-4d0d-943d-e2603a0f8139') <> '088390f4b5b5226efda53e3f46550b98' THEN RAISE EXCEPTION 'result mismatch: 263f7c5c-5df2-4d0d-943d-e2603a0f8139 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge. Suggested time 0.5 hours. Release: day of closing, alongside this email. The What You'll Do field runs near Resolve's 1,000 character limit, so keep edits short.$w$ from 1457 for 0) placing $w$this step's$w$ from 431 for 3) WHERE id = 'f5b2335f-3aed-44ce-af1a-c119ec66d6c3' AND md5(detail::text) = '2382e46d2bfb62b1f997b8a65451b1f7';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f5b2335f-3aed-44ce-af1a-c119ec66d6c3 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'f5b2335f-3aed-44ce-af1a-c119ec66d6c3') <> 'f00248dcd0ead6692834236441222d5d' THEN RAISE EXCEPTION 'result mismatch: f5b2335f-3aed-44ce-af1a-c119ec66d6c3 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(overlay(overlay(opportunity::text placing $w$ ([dates])$w$ from 1205 for 0) placing $w$ ([dates])$w$ from 1001 for 0) placing $w$[repair items]$w$ from 754 for 35) placing $w$ ([dates])$w$ from 583 for 0))::jsonb WHERE id = 'f5b2335f-3aed-44ce-af1a-c119ec66d6c3' AND md5(opportunity::text) = '7b5d0c64141a4418ed5cab397419b442';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f5b2335f-3aed-44ce-af1a-c119ec66d6c3 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = 'f5b2335f-3aed-44ce-af1a-c119ec66d6c3') <> 'cb18b06de8d8ca5c81f6e76752f08952' THEN RAISE EXCEPTION 'result mismatch: f5b2335f-3aed-44ce-af1a-c119ec66d6c3 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Upload / Documentation. Suggested time 0.5 hours. Release: day of or day after closing.$w$ from 434 for 0) WHERE id = 'fb7b4ae6-23cf-44aa-9dfb-7e023f45e514' AND md5(detail::text) = '00c6bddfb58afe9e6c961b74eabdafd3';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: fb7b4ae6-23cf-44aa-9dfb-7e023f45e514 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'fb7b4ae6-23cf-44aa-9dfb-7e023f45e514') <> '80211cf50b2f19feaf8e1f5017b599c3' THEN RAISE EXCEPTION 'result mismatch: fb7b4ae6-23cf-44aa-9dfb-7e023f45e514 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(opportunity::text placing $w$and tax reporting$w$ from 377 for 7))::jsonb WHERE id = 'fb7b4ae6-23cf-44aa-9dfb-7e023f45e514' AND md5(opportunity::text) = '11613dde15739d2ead8a03c9548b7505';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: fb7b4ae6-23cf-44aa-9dfb-7e023f45e514 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = 'fb7b4ae6-23cf-44aa-9dfb-7e023f45e514') <> '8e1fe9e86f4f52da9ddebe48aee6a9ec' THEN RAISE EXCEPTION 'result mismatch: fb7b4ae6-23cf-44aa-9dfb-7e023f45e514 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '0e3a9a36-d13d-4476-91f7-5d102a876efa' AND md5(detail::text) = 'ae991dd6a705408d01ce360aa6b70dd8';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 0e3a9a36-d13d-4476-91f7-5d102a876efa detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '0e3a9a36-d13d-4476-91f7-5d102a876efa') <> '0201a041e658b32e94cae0a10b35929a' THEN RAISE EXCEPTION 'result mismatch: 0e3a9a36-d13d-4476-91f7-5d102a876efa detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'be26109e-1bca-4f78-9ffd-7434ee7bcf33' AND md5(detail::text) = 'da7706b1b8aac1ee35c4cf98ba5488bf';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: be26109e-1bca-4f78-9ffd-7434ee7bcf33 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'be26109e-1bca-4f78-9ffd-7434ee7bcf33') <> '3ae76a5da2bd527c75eb2bc2e1cd2499' THEN RAISE EXCEPTION 'result mismatch: be26109e-1bca-4f78-9ffd-7434ee7bcf33 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: New appliances

$w$ from 1 for 0) WHERE id = '0b3d89c4-95ba-4857-b502-d7a0be4ca676' AND md5(detail::text) = '4ae7d23b630cc9072d708d3bdc01331a';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 0b3d89c4-95ba-4857-b502-d7a0be4ca676 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '0b3d89c4-95ba-4857-b502-d7a0be4ca676') <> '12e84b9ddd36bad7ad1fc234a781830d' THEN RAISE EXCEPTION 'result mismatch: 0b3d89c4-95ba-4857-b502-d7a0be4ca676 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = '2f5d9990-53ca-4af2-bba6-022d31bf4532' AND md5(detail::text) = '4669f858d6978fc78d4453ceae5c845d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 2f5d9990-53ca-4af2-bba6-022d31bf4532 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '2f5d9990-53ca-4af2-bba6-022d31bf4532') <> 'e52c57e6c2344bffddaf73d5083c496a' THEN RAISE EXCEPTION 'result mismatch: 2f5d9990-53ca-4af2-bba6-022d31bf4532 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Upload / Documentation. Suggested time 0.25 hours. Release: once Accounting sends the Invoice 1 QuickBooks link.$w$ from 514 for 0) placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = 'c8e7a719-a1b6-4018-83cc-eb95a9f909c2' AND md5(detail::text) = 'ecefd8c503ca197d908460d724fc5fd4';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: c8e7a719-a1b6-4018-83cc-eb95a9f909c2 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'c8e7a719-a1b6-4018-83cc-eb95a9f909c2') <> 'b4dde197171e1af889d481edd394b6f1' THEN RAISE EXCEPTION 'result mismatch: c8e7a719-a1b6-4018-83cc-eb95a9f909c2 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(overlay(overlay(opportunity::text placing $w$$[amount]\nInvoice 1: $[amount]$w$ from 1103 for 77) placing $w$$[amount]$w$ from 1048 for 32) placing $w$investment$w$ from 1021 for 4) placing $w$[Property Address]$w$ from 878 for 9))::jsonb WHERE id = 'c8e7a719-a1b6-4018-83cc-eb95a9f909c2' AND md5(opportunity::text) = '2b331a4707b568a907cb8d13232772aa';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: c8e7a719-a1b6-4018-83cc-eb95a9f909c2 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = 'c8e7a719-a1b6-4018-83cc-eb95a9f909c2') <> '4701dea86ef13ac5e23ca670bdeca9f9' THEN RAISE EXCEPTION 'result mismatch: c8e7a719-a1b6-4018-83cc-eb95a9f909c2 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '2ecfa855-d576-44a2-9298-f8cdbaa77910' AND md5(detail::text) = 'c7343b6f290a4d15cad52db8ea24e941';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 2ecfa855-d576-44a2-9298-f8cdbaa77910 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '2ecfa855-d576-44a2-9298-f8cdbaa77910') <> '0c86456a6ae7ec012e99a1e35ff9a758' THEN RAISE EXCEPTION 'result mismatch: 2ecfa855-d576-44a2-9298-f8cdbaa77910 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: New appliances

$w$ from 1 for 0) WHERE id = 'c4b50f1c-38c3-4f5d-b486-a59f66192fc1' AND md5(detail::text) = '776714a72580233a84e26eee4a781ebb';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: c4b50f1c-38c3-4f5d-b486-a59f66192fc1 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'c4b50f1c-38c3-4f5d-b486-a59f66192fc1') <> '12e07be5ab680e1f6619ee997d369a76' THEN RAISE EXCEPTION 'result mismatch: c4b50f1c-38c3-4f5d-b486-a59f66192fc1 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Business Decision. Suggested time 0.25 hours. Release: after the Pre-Work Inspection. If nothing needs approval, remove that section and uncheck Business Decision.$w$ from 1000 for 0) WHERE id = 'f7c9426a-4642-47f2-b7ec-cfef65b45b94' AND md5(detail::text) = '858e9b2c4ca1fc6a799e262040bb1287';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f7c9426a-4642-47f2-b7ec-cfef65b45b94 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'f7c9426a-4642-47f2-b7ec-cfef65b45b94') <> '3e9fb9dfb9b28d224ebabe6616c7e4c8' THEN RAISE EXCEPTION 'result mismatch: f7c9426a-4642-47f2-b7ec-cfef65b45b94 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(overlay(opportunity::text placing $w$[systems that passed]$w$ from 715 for 45) placing $w$and the benefit to you. Repeat for each.]$w$ from 644 for 38) placing $w$n[Small$w$ from 601 for 10))::jsonb WHERE id = 'f7c9426a-4642-47f2-b7ec-cfef65b45b94' AND md5(opportunity::text) = 'f4b6c640b46614a8df51e6d4ff0e29be';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f7c9426a-4642-47f2-b7ec-cfef65b45b94 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = 'f7c9426a-4642-47f2-b7ec-cfef65b45b94') <> '13e1fdb8295993170ad5e4e002238204' THEN RAISE EXCEPTION 'result mismatch: f7c9426a-4642-47f2-b7ec-cfef65b45b94 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge. Suggested time 0.1 hours. Release: every week until handoff.$w$ from 791 for 0) WHERE id = '00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f' AND md5(detail::text) = '3e67ec8be8a2fcf1a9be2160fd2b5b17';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f') <> 'fa6b846cc3d41e5ce100d84d62839158' THEN RAISE EXCEPTION 'result mismatch: 00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(overlay(overlay(overlay(opportunity::text placing $w$: week of [date]"}$w$ from 813 for 2) placing $w$n[Anything waiting on you, or Nothing this week]$w$ from 709 for 64) placing $w$n[Next two or three milestones]$w$ from 626 for 61) placing $w$n[What is underway and any delays]$w$ from 547 for 54) placing $w$n[What was finished]$w$ from 493 for 37))::jsonb WHERE id = '00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f' AND md5(opportunity::text) = '14d54c691830b5167bc47f72b4fa8beb';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f') <> '5b65d2ae0b13d182f3ccb2a53b4b1649' THEN RAISE EXCEPTION 'result mismatch: 00f4e66f-ce9c-43fc-b1bb-e74fc94ad83f opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'ed2b7c4a-33b3-4d67-bb77-b4b00012c71d' AND md5(detail::text) = '767d37dda3fa3e27b979f97aac0a2dc8';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ed2b7c4a-33b3-4d67-bb77-b4b00012c71d detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'ed2b7c4a-33b3-4d67-bb77-b4b00012c71d') <> 'fd5b9350d0805dffab299835f8f01d2e' THEN RAISE EXCEPTION 'result mismatch: ed2b7c4a-33b3-4d67-bb77-b4b00012c71d detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '043ebbe2-7634-4db3-b183-44470450922e' AND md5(detail::text) = '5e1a4a0201b678eb8068685ddd17dfd7';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 043ebbe2-7634-4db3-b183-44470450922e detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '043ebbe2-7634-4db3-b183-44470450922e') <> '50600e8fb5840a0664f79aaee4ad90b8' THEN RAISE EXCEPTION 'result mismatch: 043ebbe2-7634-4db3-b183-44470450922e detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: before stagers set up.$w$ from 329 for 0) placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = '5f4f7199-301b-4c0b-9b65-92b95d7c805f' AND md5(detail::text) = '89656abc1b483b0b8e37dbe9a1f05bf5';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 5f4f7199-301b-4c0b-9b65-92b95d7c805f detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '5f4f7199-301b-4c0b-9b65-92b95d7c805f') <> '947d06285588258f711f3c91f0ae0352' THEN RAISE EXCEPTION 'result mismatch: 5f4f7199-301b-4c0b-9b65-92b95d7c805f detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = 'a221c720-e5ca-4a31-9ece-c3c4e3ee6bd1' AND md5(detail::text) = '0347bb85f557a8edeadb1be1d11ed9ff';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: a221c720-e5ca-4a31-9ece-c3c4e3ee6bd1 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'a221c720-e5ca-4a31-9ece-c3c4e3ee6bd1') <> 'a78460521cf29adfacd5b72da13d7f42' THEN RAISE EXCEPTION 'result mismatch: a221c720-e5ca-4a31-9ece-c3c4e3ee6bd1 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: when make ready repairs are complete.$w$ from 490 for 0) placing $w$this step's$w$ from 357 for 3) WHERE id = '0c1c8908-c896-4c9e-b286-a28d3c41c79e' AND md5(detail::text) = '55d5a55c012069a5e65672680a80f3c3';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 0c1c8908-c896-4c9e-b286-a28d3c41c79e detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '0c1c8908-c896-4c9e-b286-a28d3c41c79e') <> '5cd1226eaa5ffd9f712df7b7f1c0b9bc' THEN RAISE EXCEPTION 'result mismatch: 0c1c8908-c896-4c9e-b286-a28d3c41c79e detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(opportunity::text placing $w$n[Area]: [repair completed]\n[Area]: [repair completed]$w$ from 588 for 72))::jsonb WHERE id = '0c1c8908-c896-4c9e-b286-a28d3c41c79e' AND md5(opportunity::text) = '5a9d7edd80d6d3faed21b37891a28e56';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 0c1c8908-c896-4c9e-b286-a28d3c41c79e opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '0c1c8908-c896-4c9e-b286-a28d3c41c79e') <> '51e1ada1b371d2b4c68037f8ccc6188c' THEN RAISE EXCEPTION 'result mismatch: 0c1c8908-c896-4c9e-b286-a28d3c41c79e opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Upload / Documentation. Suggested time 0.25 hours. Release: 2 weeks after the first invoice is requested.$w$ from 352 for 0) placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = '4b713536-e247-4329-b6af-ff4176ec42c6' AND md5(detail::text) = '697cfa529bf11e8b58bc2410c9d18547';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4b713536-e247-4329-b6af-ff4176ec42c6 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '4b713536-e247-4329-b6af-ff4176ec42c6') <> '3e84c6d2c7bd286ca6bcf7af9a74c153' THEN RAISE EXCEPTION 'result mismatch: 4b713536-e247-4329-b6af-ff4176ec42c6 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(opportunity::text placing $w$$[amount]$w$ from 476 for 32) placing $w$[Property Address]$w$ from 378 for 9))::jsonb WHERE id = '4b713536-e247-4329-b6af-ff4176ec42c6' AND md5(opportunity::text) = '54212bae4a3cd54e4491b94e8551cd79';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4b713536-e247-4329-b6af-ff4176ec42c6 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '4b713536-e247-4329-b6af-ff4176ec42c6') <> '196b7d1c35648955c62f378724e6495f' THEN RAISE EXCEPTION 'result mismatch: 4b713536-e247-4329-b6af-ff4176ec42c6 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Cameras

$w$ from 1 for 0) WHERE id = '36881d78-d434-489b-bf51-fd35022fe2e3' AND md5(detail::text) = '002339b3f5d5d08b1fb91c4d17a338fc';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 36881d78-d434-489b-bf51-fd35022fe2e3 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '36881d78-d434-489b-bf51-fd35022fe2e3') <> '485f0dfc1a05f21bbed879d3e692fa52' THEN RAISE EXCEPTION 'result mismatch: 36881d78-d434-489b-bf51-fd35022fe2e3 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: after staging is fully complete.$w$ from 317 for 0) placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = '1437d187-fc9a-4959-9463-146a89e2a049' AND md5(detail::text) = '242094cad722a6c200713a4711a67ad5';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 1437d187-fc9a-4959-9463-146a89e2a049 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '1437d187-fc9a-4959-9463-146a89e2a049') <> '2ea8aef000dc7af44fcd4068e0d03a31' THEN RAISE EXCEPTION 'result mismatch: 1437d187-fc9a-4959-9463-146a89e2a049 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Business Decision, Written Feedback. Suggested time 0.5 hours. Release: once staging is complete.$w$ from 692 for 0) placing $w$. Resolve notifies you when they respond$w$ from 467 for 0) placing $w$Fill in the window and onsite partner on this step's opportunity$w$ from 280 for 75) placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = '2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND md5(detail::text) = 'c38a08b95e6a6049170a8475f133d9de';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 2dc6f929-eaa5-4e9c-afd0-56400784ad9e detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '2dc6f929-eaa5-4e9c-afd0-56400784ad9e') <> 'ea8e7ebece18ada348c678ed300918c8' THEN RAISE EXCEPTION 'result mismatch: 2dc6f929-eaa5-4e9c-afd0-56400784ad9e detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(overlay(overlay(opportunity::text placing $w$[Onsite Partner], our onsite partner,$w$ from 782 for 18) placing $w$[X to X] window following staging completion$w$ from 689 for 47) placing $w$[Onsite Partner]$w$ from 160 for 18) placing $w$[X to X] window following$w$ from 59 for 27))::jsonb WHERE id = '2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND md5(opportunity::text) = 'ba809817854941e5c3eb849a9937e1f2';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 2dc6f929-eaa5-4e9c-afd0-56400784ad9e opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '2dc6f929-eaa5-4e9c-afd0-56400784ad9e') <> '048af4bf4b809a30cc91249ebd0d7489' THEN RAISE EXCEPTION 'result mismatch: 2dc6f929-eaa5-4e9c-afd0-56400784ad9e opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Furnishing Package selected

$w$ from 1 for 0) WHERE id = '890d1744-2c7e-4e17-9762-cd90769023ad' AND md5(detail::text) = '780407b83ffcc28b434e67263c682045';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 890d1744-2c7e-4e17-9762-cd90769023ad detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '890d1744-2c7e-4e17-9762-cd90769023ad') <> '1be5ae6505a154f951fdd1bd34c22cef' THEN RAISE EXCEPTION 'result mismatch: 890d1744-2c7e-4e17-9762-cd90769023ad detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: after professional photos are uploaded.$w$ from 934 for 0) placing $w$this step's$w$ from 827 for 3) WHERE id = '5b46375b-3795-44a9-aef1-13f28d73541a' AND md5(detail::text) = '8ff9a8dc11f7ccce6084d3080fe23dc3';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 5b46375b-3795-44a9-aef1-13f28d73541a detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '5b46375b-3795-44a9-aef1-13f28d73541a') <> '317593232ef0f12100096bb1dee36324' THEN RAISE EXCEPTION 'result mismatch: 5b46375b-3795-44a9-aef1-13f28d73541a detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Smart lock

$w$ from 1 for 0) WHERE id = 'ab3df464-a27d-48d9-a662-79c0830dd019' AND md5(detail::text) = '1c1e6299be6e69b9b78405e3e7ef2fa9';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ab3df464-a27d-48d9-a662-79c0830dd019 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'ab3df464-a27d-48d9-a662-79c0830dd019') <> 'a3d3484233cda6d7ff2f36cf3e13d4e4' THEN RAISE EXCEPTION 'result mismatch: ab3df464-a27d-48d9-a662-79c0830dd019 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: Cameras

$w$ from 1 for 0) WHERE id = '2533acff-c621-4ba2-bd50-15bc2e5b7cfe' AND md5(detail::text) = '5e2aa591c49111b26a1b31182d259492';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 2533acff-c621-4ba2-bd50-15bc2e5b7cfe detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '2533acff-c621-4ba2-bd50-15bc2e5b7cfe') <> '4855ee26cd2b7a78ad8d001ec1c0df39' THEN RAISE EXCEPTION 'result mismatch: 2533acff-c621-4ba2-bd50-15bc2e5b7cfe detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: after the Final Inspection.$w$ from 1190 for 0) placing $w$the feedback field$w$ from 1065 for 13) placing $w$[items]$w$ from 775 for 22) placing $w$this step's$w$ from 524 for 3) WHERE id = '8c28732f-acc8-40a9-a6e6-0cc3f33fc165' AND md5(detail::text) = '8dcaa455c8dcb7f36cf83539551d2a3d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 8c28732f-acc8-40a9-a6e6-0cc3f33fc165 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '8c28732f-acc8-40a9-a6e6-0cc3f33fc165') <> '4ae537e071fe767b4053190ac89fd0ea' THEN RAISE EXCEPTION 'result mismatch: 8c28732f-acc8-40a9-a6e6-0cc3f33fc165 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(opportunity::text placing $w$[Property Address]$w$ from 477 for 9))::jsonb WHERE id = '8c28732f-acc8-40a9-a6e6-0cc3f33fc165' AND md5(opportunity::text) = '4bf4ee7233c58f21d95c79c2c84a0c6d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 8c28732f-acc8-40a9-a6e6-0cc3f33fc165 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '8c28732f-acc8-40a9-a6e6-0cc3f33fc165') <> '2da842b602378a958998113a47be1669' THEN RAISE EXCEPTION 'result mismatch: 8c28732f-acc8-40a9-a6e6-0cc3f33fc165 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Upload / Documentation. Suggested time 0.5 hours. Release: after the Director approves the final costs.$w$ from 1136 for 0) placing $w$this step's$w$ from 247 for 3) WHERE id = '98efdfb5-e68c-4b84-a059-e67aca03df17' AND md5(detail::text) = 'fff9a8a20cc532e40ed4e20b97efc7e1';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 98efdfb5-e68c-4b84-a059-e67aca03df17 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '98efdfb5-e68c-4b84-a059-e67aca03df17') <> 'e08c80dabd9a6a26907c354db092b371' THEN RAISE EXCEPTION 'result mismatch: 98efdfb5-e68c-4b84-a059-e67aca03df17 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(opportunity::text placing $w$[Property Address]$w$ from 526 for 9) placing $w$the feedback field$w$ from 228 for 13))::jsonb WHERE id = '98efdfb5-e68c-4b84-a059-e67aca03df17' AND md5(opportunity::text) = '4ef919ba1e45f0ea3592e03ebd42763e';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 98efdfb5-e68c-4b84-a059-e67aca03df17 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '98efdfb5-e68c-4b84-a059-e67aca03df17') <> 'f2ec002e7c88364655d7aef96ca6eefa' THEN RAISE EXCEPTION 'result mismatch: 98efdfb5-e68c-4b84-a059-e67aca03df17 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 0.5 hours. Release: after Operations drafts them.$w$ from 412 for 0) placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = 'cbb23216-ee09-4301-b0b0-4392a960a145' AND md5(detail::text) = 'c9819bd29934310cbdf59d3133765c39';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: cbb23216-ee09-4301-b0b0-4392a960a145 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = 'cbb23216-ee09-4301-b0b0-4392a960a145') <> '13fd1ba436a2a733476b440e78c3ffdf' THEN RAISE EXCEPTION 'result mismatch: cbb23216-ee09-4301-b0b0-4392a960a145 detail'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: when the meeting is scheduled.$w$ from 568 for 0) placing $w$Applies only when: Active Owner

$w$ from 1 for 0) WHERE id = '02dff9fa-3046-42e2-beb2-f9de1f9871d6' AND md5(detail::text) = 'e6032418b5033d646e20893c37d0b995';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 02dff9fa-3046-42e2-beb2-f9de1f9871d6 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '02dff9fa-3046-42e2-beb2-f9de1f9871d6') <> '68930197ae420de309201b1c8d29495a' THEN RAISE EXCEPTION 'result mismatch: 02dff9fa-3046-42e2-beb2-f9de1f9871d6 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(overlay(opportunity::text placing $w$investment starts working$w$ from 152 for 28) placing $w$the feedback field$w$ from 107 for 13))::jsonb WHERE id = '02dff9fa-3046-42e2-beb2-f9de1f9871d6' AND md5(opportunity::text) = 'f93a8726a4237e82b8e9d5c06f7c4d37';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 02dff9fa-3046-42e2-beb2-f9de1f9871d6 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '02dff9fa-3046-42e2-beb2-f9de1f9871d6') <> '7af70ad7e1bdfbf31a733f7f6c34d01b' THEN RAISE EXCEPTION 'result mismatch: 02dff9fa-3046-42e2-beb2-f9de1f9871d6 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$

Good to know:
Active Owner opportunity settings: response types Review / Acknowledge, Written Feedback. Suggested time 1 hours. Release: at handoff.$w$ from 486 for 0) WHERE id = '10c0f56a-e094-4b6c-9e11-24bd8e55e6b1' AND md5(detail::text) = '4bd7e9d41dc40e1361ebdf62c2d5935a';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 10c0f56a-e094-4b6c-9e11-24bd8e55e6b1 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '10c0f56a-e094-4b6c-9e11-24bd8e55e6b1') <> '74aa92a851ef8f0ca2a252590d1517ac' THEN RAISE EXCEPTION 'result mismatch: 10c0f56a-e094-4b6c-9e11-24bd8e55e6b1 detail'; END IF;
UPDATE public.onboarding_template_tasks SET opportunity = (overlay(opportunity::text placing $w$the feedback field$w$ from 107 for 13))::jsonb WHERE id = '10c0f56a-e094-4b6c-9e11-24bd8e55e6b1' AND md5(opportunity::text) = '9c3ef961a589ee0890c388059cdf9744';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 10c0f56a-e094-4b6c-9e11-24bd8e55e6b1 opportunity'; END IF;
IF (SELECT md5(opportunity::text) FROM public.onboarding_template_tasks WHERE id = '10c0f56a-e094-4b6c-9e11-24bd8e55e6b1') <> '268a1801a0b9bb036348039a77b7902b' THEN RAISE EXCEPTION 'result mismatch: 10c0f56a-e094-4b6c-9e11-24bd8e55e6b1 opportunity'; END IF;
UPDATE public.onboarding_template_tasks SET detail = overlay(detail placing $w$Applies only when: HOA

$w$ from 1 for 0) WHERE id = '7460f7e9-39ad-40ba-9319-d6ac31d22e35' AND md5(detail::text) = '7451b1d52a5484eee0b0fd50883a4839';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 7460f7e9-39ad-40ba-9319-d6ac31d22e35 detail'; END IF;
IF (SELECT md5(detail::text) FROM public.onboarding_template_tasks WHERE id = '7460f7e9-39ad-40ba-9319-d6ac31d22e35') <> 'c16ab3502f1e57c7883522af0b881430' THEN RAISE EXCEPTION 'result mismatch: 7460f7e9-39ad-40ba-9319-d6ac31d22e35 detail'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$support number"}]$w$ from 394 for 17) placing $w$account$w$ from 317 for 7) placing $w$billing$w$ from 240 for 7) placing $w$start$w$ from 174 for 5) placing $w$service$w$ from 110 for 7))::jsonb WHERE id = 'f33320db-5d7e-49e7-a846-bac67f0019d2' AND md5(output_fields::text) = '2a9ff8f39e42f97c894c254f46ec8a5b';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f33320db-5d7e-49e7-a846-bac67f0019d2 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'f33320db-5d7e-49e7-a846-bac67f0019d2') <> '2faf5b99fc7fb0aad7a3598567622611' THEN RAISE EXCEPTION 'result mismatch: f33320db-5d7e-49e7-a846-bac67f0019d2 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$cart count"}]$w$ from 450 for 13) placing $w$pickup$w$ from 386 for 6) placing $w$trash$w$ from 320 for 5) placing $w$install$w$ from 252 for 7) placing $w$monthly$w$ from 186 for 7) placing $w$speed$w$ from 121 for 5))::jsonb WHERE id = '9bf0b513-ea20-4987-afb8-1623e1b7ffb9' AND md5(output_fields::text) = 'bc28a6a77e75d9ad7816bd257ac2ce33';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 9bf0b513-ea20-4987-afb8-1623e1b7ffb9 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '9bf0b513-ea20-4987-afb8-1623e1b7ffb9') <> '8aeaecc95f7db2e642d83078707a2d64' THEN RAISE EXCEPTION 'result mismatch: 9bf0b513-ea20-4987-afb8-1623e1b7ffb9 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$guest need"}]$w$ from 354 for 13) placing $w$budget$w$ from 296 for 6) placing $w$quantity$w$ from 234 for 8) placing $w$proposed$w$ from 169 for 8) placing $w$decision$w$ from 106 for 8))::jsonb WHERE id = '87c4047f-8323-4cef-b529-63f8076af934' AND md5(output_fields::text) = '31443f9f40b986e3dfc800aa99aa6d61';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 87c4047f-8323-4cef-b529-63f8076af934 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '87c4047f-8323-4cef-b529-63f8076af934') <> '7d542236b50b381c65f14de6858ad6e1' THEN RAISE EXCEPTION 'result mismatch: 87c4047f-8323-4cef-b529-63f8076af934 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$priority"}]$w$ from 392 for 11) placing $w$budget$w$ from 336 for 6) placing $w$function$w$ from 274 for 8) placing $w$quantity$w$ from 216 for 8) placing $w$item$w$ from 160 for 4) placing $w$decision$w$ from 106 for 8))::jsonb WHERE id = '9ae07243-01fe-47cf-8ae0-c30a784d5a3b' AND md5(output_fields::text) = 'fa330b21b4b8a6c8359b3f8c0e530f52';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 9ae07243-01fe-47cf-8ae0-c30a784d5a3b output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '9ae07243-01fe-47cf-8ae0-c30a784d5a3b') <> '3d3588027cb2da923d06059b908954ac' THEN RAISE EXCEPTION 'result mismatch: 9ae07243-01fe-47cf-8ae0-c30a784d5a3b output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$recommendation"}]$w$ from 358 for 17) placing $w$contract$w$ from 288 for 8) placing $w$frequency$w$ from 223 for 9) placing $w$price$w$ from 167 for 5) placing $w$provider$w$ from 106 for 8))::jsonb WHERE id = '78d72847-64c8-4155-9555-874cc7a28b5a' AND md5(output_fields::text) = '6aa1aecc305c4c80a7c050716ca4187a';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 78d72847-64c8-4155-9555-874cc7a28b5a output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '78d72847-64c8-4155-9555-874cc7a28b5a') <> '6217ef0873f81eee33389483fee35141' THEN RAISE EXCEPTION 'result mismatch: 78d72847-64c8-4155-9555-874cc7a28b5a output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$open questions"}]$w$ from 450 for 17) placing $w$quirks$w$ from 388 for 6) placing $w$amenities$w$ from 331 for 9) placing $w$access$w$ from 274 for 6) placing $w$parking$w$ from 219 for 7) placing $w$sleeping$w$ from 162 for 8) placing $w$baths$w$ from 107 for 5))::jsonb WHERE id = '249da778-ee33-4eae-a98f-510467807c72' AND md5(output_fields::text) = '9b7eef666ae48aecc6c61fd11e100ff4';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 249da778-ee33-4eae-a98f-510467807c72 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '249da778-ee33-4eae-a98f-510467807c72') <> 'ef34d10754ab2af1cbb851628d2b8c81' THEN RAISE EXCEPTION 'result mismatch: 249da778-ee33-4eae-a98f-510467807c72 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$draft description"}]$w$ from 249 for 20) placing $w$guest$w$ from 179 for 5) placing $w$strengths$w$ from 117 for 9))::jsonb WHERE id = '8c929053-0b0e-4d3e-9cfe-21571c86ddfc' AND md5(output_fields::text) = '3b0c0345436bc773f3b5feca2e73f6e6';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 8c929053-0b0e-4d3e-9cfe-21571c86ddfc output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '8c929053-0b0e-4d3e-9cfe-21571c86ddfc') <> 'fe91943eb9c842fc682df24f9d3ade53' THEN RAISE EXCEPTION 'result mismatch: 8c929053-0b0e-4d3e-9cfe-21571c86ddfc output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$cost estimate"}]$w$ from 179 for 16) placing $w$recommendation$w$ from 104 for 14))::jsonb WHERE id = '4cc462d9-3f52-4aac-bd67-52ecd2e9dff7' AND md5(output_fields::text) = '68e20ff942e2716cab302d95f5c25a39';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4cc462d9-3f52-4aac-bd67-52ecd2e9dff7 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '4cc462d9-3f52-4aac-bd67-52ecd2e9dff7') <> '5bd79cc1531366a3b42622745bda6432' THEN RAISE EXCEPTION 'result mismatch: 4cc462d9-3f52-4aac-bd67-52ecd2e9dff7 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$caption$w$ from 121 for 7))::jsonb WHERE id = 'b34d0b01-28f7-48cf-a051-1f965729d594' AND md5(output_fields::text) = 'a883cc9e28a96e5016441554c3b61c15';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: b34d0b01-28f7-48cf-a051-1f965729d594 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'b34d0b01-28f7-48cf-a051-1f965729d594') <> '41cf5c2df14b13bca82e7010d6b3650c' THEN RAISE EXCEPTION 'result mismatch: b34d0b01-28f7-48cf-a051-1f965729d594 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 288 for 8) placing $w$features$w$ from 233 for 8) placing $w$nightly$w$ from 160 for 7) placing $w$/$w$ from 81 for 4))::jsonb WHERE id = 'c924f690-4569-4ce1-8f17-757e8ef71210' AND md5(output_fields::text) = 'd8546fbc6eaa53a4e6b1363d4c180619';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: c924f690-4569-4ce1-8f17-757e8ef71210 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'c924f690-4569-4ce1-8f17-757e8ef71210') <> 'a4b1c7bc6528a2e646e1e1e9014f8ad0' THEN RAISE EXCEPTION 'result mismatch: c924f690-4569-4ce1-8f17-757e8ef71210 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$needs"}]$w$ from 247 for 8) placing $w$length$w$ from 186 for 6) placing $w$reason$w$ from 113 for 6))::jsonb WHERE id = '98dbc9bd-5976-4736-8991-b9cdcd24fe10' AND md5(output_fields::text) = 'd783376f8e136a09bc400f5970b30ed1';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 98dbc9bd-5976-4736-8991-b9cdcd24fe10 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '98dbc9bd-5976-4736-8991-b9cdcd24fe10') <> '945d8b0b4e0fe1c52b2f420b1c0afc38' THEN RAISE EXCEPTION 'result mismatch: 98dbc9bd-5976-4736-8991-b9cdcd24fe10 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$month"}]$w$ from 333 for 8) placing $w$seasonal$w$ from 272 for 8) placing $w$note$w$ from 212 for 4) placing $w$distance$w$ from 158 for 8) placing $w$category$w$ from 100 for 8))::jsonb WHERE id = '5ee587b9-414d-4f06-9bce-a6f6560689e8' AND md5(output_fields::text) = '8914f0d2c9fd4c3ce904955eb3f8e9b6';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 5ee587b9-414d-4f06-9bce-a6f6560689e8 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '5ee587b9-414d-4f06-9bce-a6f6560689e8') <> '5303bac0618633ec4eac5573b563d2e1' THEN RAISE EXCEPTION 'result mismatch: 5ee587b9-414d-4f06-9bce-a6f6560689e8 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$timing"}]$w$ from 216 for 9) placing $w$message$w$ from 161 for 7) placing $w$audience$w$ from 104 for 8))::jsonb WHERE id = 'eac4409c-e9d2-4eb7-bcca-64ec2a5dc042' AND md5(output_fields::text) = '0181c40e2d2ce46feb73cd6e1146ba01';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: eac4409c-e9d2-4eb7-bcca-64ec2a5dc042 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'eac4409c-e9d2-4eb7-bcca-64ec2a5dc042') <> '48af412c8ca766e556c1fd76c8b2ef9b' THEN RAISE EXCEPTION 'result mismatch: eac4409c-e9d2-4eb7-bcca-64ec2a5dc042 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$date"}]$w$ from 170 for 7) placing $w$photo$w$ from 112 for 5))::jsonb WHERE id = '386b83ea-6a4e-47f4-9a81-5b9bdcde3cfb' AND md5(output_fields::text) = '379cbc233997ad39175fb81be64547bb';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 386b83ea-6a4e-47f4-9a81-5b9bdcde3cfb output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '386b83ea-6a4e-47f4-9a81-5b9bdcde3cfb') <> 'bad57e734399c38ce6a9d35636427c82' THEN RAISE EXCEPTION 'result mismatch: 386b83ea-6a4e-47f4-9a81-5b9bdcde3cfb output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$date"}]$w$ from 170 for 7) placing $w$photo$w$ from 112 for 5))::jsonb WHERE id = '37d8e88f-ec5e-4a62-a032-8bc5a4201fea' AND md5(output_fields::text) = '379cbc233997ad39175fb81be64547bb';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 37d8e88f-ec5e-4a62-a032-8bc5a4201fea output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '37d8e88f-ec5e-4a62-a032-8bc5a4201fea') <> 'bad57e734399c38ce6a9d35636427c82' THEN RAISE EXCEPTION 'result mismatch: 37d8e88f-ec5e-4a62-a032-8bc5a4201fea output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$message"}]$w$ from 161 for 10) placing $w$channel$w$ from 105 for 7))::jsonb WHERE id = '7b98a961-775e-431d-802c-09628ddc369b' AND md5(output_fields::text) = 'de06d4a33ace6a41bae805143036f5b6';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 7b98a961-775e-431d-802c-09628ddc369b output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '7b98a961-775e-431d-802c-09628ddc369b') <> '871bd510db5b6948da4487e7f3121a1b' THEN RAISE EXCEPTION 'result mismatch: 7b98a961-775e-431d-802c-09628ddc369b output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$notes (no personal data beyond business contact)"}]$w$ from 334 for 40) placing $w$relationship$w$ from 234 for 12) placing $w$city$w$ from 176 for 4) placing $w$organization$w$ from 118 for 12))::jsonb WHERE id = '12eb6a81-fbf9-4fcb-8068-51d171130b1a' AND md5(output_fields::text) = '687ca4348b4b3485941889d44af443ca';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 12eb6a81-fbf9-4fcb-8068-51d171130b1a output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '12eb6a81-fbf9-4fcb-8068-51d171130b1a') <> 'c9c540a2535c793ec4502f1b916bd67d' THEN RAISE EXCEPTION 'result mismatch: 12eb6a81-fbf9-4fcb-8068-51d171130b1a output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 359 for 8) placing $w$public$w$ from 292 for 6) placing $w$housing$w$ from 218 for 7) placing $w$city$w$ from 160 for 4) placing $w$type$w$ from 110 for 4))::jsonb WHERE id = '41e29670-5c3c-47df-aa15-288c26450ded' AND md5(output_fields::text) = 'e543d5c8390e528fe521012b6ed463a4';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 41e29670-5c3c-47df-aa15-288c26450ded output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '41e29670-5c3c-47df-aa15-288c26450ded') <> '38a685157a9adb5e27284bbf9c60b454' THEN RAISE EXCEPTION 'result mismatch: 41e29670-5c3c-47df-aa15-288c26450ded output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 267 for 8) placing $w$fit$w$ from 217 for 3) placing $w$city$w$ from 168 for 4) placing $w$category$w$ from 114 for 8))::jsonb WHERE id = 'ecaaf737-125c-4d23-b2f5-834f385645b9' AND md5(output_fields::text) = '3c73e632a25c002ee04228573212ef6f';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ecaaf737-125c-4d23-b2f5-834f385645b9 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'ecaaf737-125c-4d23-b2f5-834f385645b9') <> '33dffa16592908a21fca5e07e7da452a' THEN RAISE EXCEPTION 'result mismatch: ecaaf737-125c-4d23-b2f5-834f385645b9 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$source"}]$w$ from 158 for 9) placing $w$answer$w$ from 104 for 6))::jsonb WHERE id = 'b5c75c6a-f0c5-4e85-898d-3d897bc840d6' AND md5(output_fields::text) = 'fa385d2a01a50f2e6b705e5242a6cd14';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: b5c75c6a-f0c5-4e85-898d-3d897bc840d6 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'b5c75c6a-f0c5-4e85-898d-3d897bc840d6') <> 'e59d4bfea30a5a535de209d0f98dafbf' THEN RAISE EXCEPTION 'result mismatch: b5c75c6a-f0c5-4e85-898d-3d897bc840d6 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$asset"}]$w$ from 203 for 8) placing $w$topic$w$ from 151 for 5) placing $w$channel$w$ from 97 for 7))::jsonb WHERE id = 'dcbc0596-4dc7-42e5-95e3-848bf076bd83' AND md5(output_fields::text) = '07e8baf1c7156a17de0bf127e0bebc40';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: dcbc0596-4dc7-42e5-95e3-848bf076bd83 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'dcbc0596-4dc7-42e5-95e3-848bf076bd83') <> 'a4db704937b46d529bbdafbf35ac9297' THEN RAISE EXCEPTION 'result mismatch: dcbc0596-4dc7-42e5-95e3-848bf076bd83 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$priority"}]$w$ from 246 for 11) placing $w$suggested$w$ from 175 for 9) placing $w$observation$w$ from 101 for 11))::jsonb WHERE id = 'f6379ee4-1670-4635-b489-daf850c53245' AND md5(output_fields::text) = '0976c5ecb158b49f395318355ae5732f';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f6379ee4-1670-4635-b489-daf850c53245 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'f6379ee4-1670-4635-b489-daf850c53245') <> '03a6bc9a11f8c9ac19bc61518efff04b' THEN RAISE EXCEPTION 'result mismatch: f6379ee4-1670-4635-b489-daf850c53245 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 241 for 8) placing $w$must$w$ from 179 for 4) placing $w$colors$w$ from 107 for 6))::jsonb WHERE id = '0ade4e8b-5341-4092-af64-75a2c8e46db0' AND md5(output_fields::text) = '4bf701271d0f7eeb1a46110954e9a6d1';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 0ade4e8b-5341-4092-af64-75a2c8e46db0 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '0ade4e8b-5341-4092-af64-75a2c8e46db0') <> '0306c1b813ec49a71e45bd13972ca25e' THEN RAISE EXCEPTION 'result mismatch: 0ade4e8b-5341-4092-af64-75a2c8e46db0 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$notes"}]$w$ from 123 for 8))::jsonb WHERE id = '890a7893-bb00-4f0d-8e48-1464494bd3d5' AND md5(output_fields::text) = '1ca29f90da4bfbb7c1513d20883892be';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 890a7893-bb00-4f0d-8e48-1464494bd3d5 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '890a7893-bb00-4f0d-8e48-1464494bd3d5') <> 'bf9df24151acb6f3f66f5c2d4980ec95' THEN RAISE EXCEPTION 'result mismatch: 890a7893-bb00-4f0d-8e48-1464494bd3d5 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$notes"}]$w$ from 123 for 8))::jsonb WHERE id = '60f4a24c-0dda-4f7c-bc74-cab9bab3b362' AND md5(output_fields::text) = '1ca29f90da4bfbb7c1513d20883892be';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 60f4a24c-0dda-4f7c-bc74-cab9bab3b362 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '60f4a24c-0dda-4f7c-bc74-cab9bab3b362') <> 'bf9df24151acb6f3f66f5c2d4980ec95' THEN RAISE EXCEPTION 'result mismatch: 60f4a24c-0dda-4f7c-bc74-cab9bab3b362 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$notes"}]$w$ from 103 for 8))::jsonb WHERE id = '22eaf430-d37f-4e57-bde5-14dcb6639ad9' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 22eaf430-d37f-4e57-bde5-14dcb6639ad9 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '22eaf430-d37f-4e57-bde5-14dcb6639ad9') <> '2a411f0f6f88e2741e886459a545e1f3' THEN RAISE EXCEPTION 'result mismatch: 22eaf430-d37f-4e57-bde5-14dcb6639ad9 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$question"}]$w$ from 156 for 11) placing $w$decision$w$ from 98 for 8))::jsonb WHERE id = 'a5857f9e-21fa-4ec6-a7cc-74ba2093011f' AND md5(output_fields::text) = '60c52d7efe87932468fa68a3c95c770e';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: a5857f9e-21fa-4ec6-a7cc-74ba2093011f output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'a5857f9e-21fa-4ec6-a7cc-74ba2093011f') <> 'b8b5971d7a96f1085dd2a98918084ccd' THEN RAISE EXCEPTION 'result mismatch: a5857f9e-21fa-4ec6-a7cc-74ba2093011f output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$question"}]$w$ from 158 for 11) placing $w$status$w$ from 102 for 6))::jsonb WHERE id = 'ff23c99c-0291-4b24-b592-15a907353b43' AND md5(output_fields::text) = 'd0952c138fc4240b9f31c0f639e7b4c5';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ff23c99c-0291-4b24-b592-15a907353b43 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'ff23c99c-0291-4b24-b592-15a907353b43') <> '6ff310c6001dc6546380357ac4b3d9ea' THEN RAISE EXCEPTION 'result mismatch: ff23c99c-0291-4b24-b592-15a907353b43 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$questions"}]$w$ from 113 for 12))::jsonb WHERE id = '57fa232c-f0a8-4718-967e-e65de509b2b9' AND md5(output_fields::text) = '2e35f61a6e1be6df35fb368878bc8a1f';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 57fa232c-f0a8-4718-967e-e65de509b2b9 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '57fa232c-f0a8-4718-967e-e65de509b2b9') <> '8971f33bc1ee43976a1d9383ddcd1437' THEN RAISE EXCEPTION 'result mismatch: 57fa232c-f0a8-4718-967e-e65de509b2b9 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 163 for 8) placing $w$date$w$ from 112 for 4))::jsonb WHERE id = '840a61e5-2aad-44cb-b90c-92c758417dc9' AND md5(output_fields::text) = 'cf21260e1056d01df3016aacefd567be';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 840a61e5-2aad-44cb-b90c-92c758417dc9 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '840a61e5-2aad-44cb-b90c-92c758417dc9') <> 'dee7a8126ebe1123306bfc21c626fd94' THEN RAISE EXCEPTION 'result mismatch: 840a61e5-2aad-44cb-b90c-92c758417dc9 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$next steps"}]$w$ from 170 for 13) placing $w$questions$w$ from 109 for 9))::jsonb WHERE id = '079d3b8a-fd75-40a5-bdd9-b64af66d36e5' AND md5(output_fields::text) = '1db5240cd605c500e1bc0e972f5854de';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 079d3b8a-fd75-40a5-bdd9-b64af66d36e5 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '079d3b8a-fd75-40a5-bdd9-b64af66d36e5') <> '8120012ef6a4b78c75d6b7b988a1b9a3' THEN RAISE EXCEPTION 'result mismatch: 079d3b8a-fd75-40a5-bdd9-b64af66d36e5 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$question"}]$w$ from 108 for 11))::jsonb WHERE id = '29b71e76-6f94-4fc8-bb13-d93d4439d1e3' AND md5(output_fields::text) = '62043ba781c9b6370e4f29606bb29a01';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 29b71e76-6f94-4fc8-bb13-d93d4439d1e3 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '29b71e76-6f94-4fc8-bb13-d93d4439d1e3') <> '2e26689534f292436db7ec2888078eb8' THEN RAISE EXCEPTION 'result mismatch: 29b71e76-6f94-4fc8-bb13-d93d4439d1e3 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$questions"}]$w$ from 109 for 12))::jsonb WHERE id = 'e2af3ef9-cf44-4592-b6c8-52ea1ac63ec3' AND md5(output_fields::text) = '231fccfab99ccd6bf85c71aa68e7b464';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: e2af3ef9-cf44-4592-b6c8-52ea1ac63ec3 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'e2af3ef9-cf44-4592-b6c8-52ea1ac63ec3') <> '988072d2f267ab5511a785079d44838d' THEN RAISE EXCEPTION 'result mismatch: e2af3ef9-cf44-4592-b6c8-52ea1ac63ec3 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$questions"}]$w$ from 109 for 12))::jsonb WHERE id = '6d085eb0-2992-45d0-b419-23ab6c130abc' AND md5(output_fields::text) = '231fccfab99ccd6bf85c71aa68e7b464';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 6d085eb0-2992-45d0-b419-23ab6c130abc output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '6d085eb0-2992-45d0-b419-23ab6c130abc') <> '988072d2f267ab5511a785079d44838d' THEN RAISE EXCEPTION 'result mismatch: 6d085eb0-2992-45d0-b419-23ab6c130abc output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$question"}]$w$ from 166 for 11) placing $w$observation$w$ from 105 for 11))::jsonb WHERE id = 'd7874de5-aa9f-491d-a571-3978fa986802' AND md5(output_fields::text) = '21c0e2aa37d06a312b25c3dc8eaa8049';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: d7874de5-aa9f-491d-a571-3978fa986802 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'd7874de5-aa9f-491d-a571-3978fa986802') <> 'bdb790310f16244f13baef8a573c4910' THEN RAISE EXCEPTION 'result mismatch: d7874de5-aa9f-491d-a571-3978fa986802 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$notes"}]$w$ from 103 for 8))::jsonb WHERE id = '92e7e21c-3b22-4c55-b344-804d57159cfc' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 92e7e21c-3b22-4c55-b344-804d57159cfc output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '92e7e21c-3b22-4c55-b344-804d57159cfc') <> '2a411f0f6f88e2741e886459a545e1f3' THEN RAISE EXCEPTION 'result mismatch: 92e7e21c-3b22-4c55-b344-804d57159cfc output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$notes"}]$w$ from 103 for 8))::jsonb WHERE id = '34f36664-d008-4fc8-b4a1-463e846e6cfa' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 34f36664-d008-4fc8-b4a1-463e846e6cfa output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '34f36664-d008-4fc8-b4a1-463e846e6cfa') <> '2a411f0f6f88e2741e886459a545e1f3' THEN RAISE EXCEPTION 'result mismatch: 34f36664-d008-4fc8-b4a1-463e846e6cfa output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$question"}]$w$ from 120 for 11))::jsonb WHERE id = '70840bd0-27c7-4ad4-9627-a2e7453cb1c8' AND md5(output_fields::text) = '39727fda50ca90304be34d7c06cfec2b';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 70840bd0-27c7-4ad4-9627-a2e7453cb1c8 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '70840bd0-27c7-4ad4-9627-a2e7453cb1c8') <> '1467c67232c0481f8df71384f3bf14ce' THEN RAISE EXCEPTION 'result mismatch: 70840bd0-27c7-4ad4-9627-a2e7453cb1c8 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$notes"}]$w$ from 103 for 8))::jsonb WHERE id = 'ca06037a-5fc5-420c-805d-4cec90030a7f' AND md5(output_fields::text) = '7f9b86ce067d0a7aabbd7b49c582c679';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ca06037a-5fc5-420c-805d-4cec90030a7f output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'ca06037a-5fc5-420c-805d-4cec90030a7f') <> '2a411f0f6f88e2741e886459a545e1f3' THEN RAISE EXCEPTION 'result mismatch: ca06037a-5fc5-420c-805d-4cec90030a7f output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(output_fields::text placing $w$submitted date"}]$w$ from 104 for 17))::jsonb WHERE id = 'e8e8bdab-6ce0-4deb-8069-03c3cc74bf4d' AND md5(output_fields::text) = '0dba2ed1f9b91185a1f2605e7bd41ec1';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: e8e8bdab-6ce0-4deb-8069-03c3cc74bf4d output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'e8e8bdab-6ce0-4deb-8069-03c3cc74bf4d') <> 'dd6ed7d59d3f4e1867904f3878f2c399' THEN RAISE EXCEPTION 'result mismatch: e8e8bdab-6ce0-4deb-8069-03c3cc74bf4d output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 153 for 8) placing $w$date$w$ from 102 for 4))::jsonb WHERE id = 'd9594872-8ddb-488f-bc46-3db02a65f3e8' AND md5(output_fields::text) = 'ad40fca0ad2987681e04654ae6e76115';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: d9594872-8ddb-488f-bc46-3db02a65f3e8 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'd9594872-8ddb-488f-bc46-3db02a65f3e8') <> 'b9c9e95bc571775ba349266edcdc3809' THEN RAISE EXCEPTION 'result mismatch: d9594872-8ddb-488f-bc46-3db02a65f3e8 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$registered$w$ from 343 for 10) placing $w$warranty$w$ from 270 for 8) placing $w$serial$w$ from 210 for 6) placing $w$model$w$ from 157 for 5) placing $w$brand$w$ from 105 for 5))::jsonb WHERE id = 'fb6da72b-3e27-48be-b79e-b5206316b376' AND md5(output_fields::text) = '9b465f827297b21306fe3a608bd057f9';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: fb6da72b-3e27-48be-b79e-b5206316b376 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'fb6da72b-3e27-48be-b79e-b5206316b376') <> '3324d0826ea21d0b4e30c272a6e84b56' THEN RAISE EXCEPTION 'result mismatch: fb6da72b-3e27-48be-b79e-b5206316b376 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$rental$w$ from 247 for 6) placing $w$premium$w$ from 177 for 7) placing $w$coverage$w$ from 109 for 8))::jsonb WHERE id = '79a351bf-d2b2-4cda-a276-51b24ab33379' AND md5(output_fields::text) = 'fa21e4fe5f2616d42875a0bb0ee95770';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 79a351bf-d2b2-4cda-a276-51b24ab33379 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '79a351bf-d2b2-4cda-a276-51b24ab33379') <> '679bf4b78191ff3805995156b873d9d1' THEN RAISE EXCEPTION 'result mismatch: 79a351bf-d2b2-4cda-a276-51b24ab33379 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$recommendation"}]$w$ from 292 for 17) placing $w$timeline$w$ from 228 for 8) placing $w$quote$w$ from 173 for 5) placing $w$provider$w$ from 112 for 8))::jsonb WHERE id = '4897091e-b6d8-4c6c-9f01-997aa720a53b' AND md5(output_fields::text) = 'fda6a6d5e9bf67df730602c15e7e552d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 4897091e-b6d8-4c6c-9f01-997aa720a53b output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '4897091e-b6d8-4c6c-9f01-997aa720a53b') <> '449828f385b6bb8e8736b11d5e0aceb1' THEN RAISE EXCEPTION 'result mismatch: 4897091e-b6d8-4c6c-9f01-997aa720a53b output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$public$w$ from 290 for 6) placing $w$housing$w$ from 216 for 7) placing $w$specialty$w$ from 153 for 9) placing $w$city$w$ from 98 for 4))::jsonb WHERE id = 'c60c21cf-05ab-4d0d-a15f-8f7a680d7034' AND md5(output_fields::text) = '994d8e3187c2062400f089b631bf1fdb';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: c60c21cf-05ab-4d0d-a15f-8f7a680d7034 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'c60c21cf-05ab-4d0d-a15f-8f7a680d7034') <> 'fbc82988cab47d3d1fa09d91f9ceac92' THEN RAISE EXCEPTION 'result mismatch: c60c21cf-05ab-4d0d-a15f-8f7a680d7034 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$public$w$ from 306 for 6) placing $w$relocation$w$ from 226 for 10) placing $w$employees$w$ from 157 for 9) placing $w$city$w$ from 100 for 4))::jsonb WHERE id = 'f5e19c5b-aeef-408d-9e8d-9c2664d32f1e' AND md5(output_fields::text) = 'ed5713c8e193c1a241124f2f0acfdacd';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: f5e19c5b-aeef-408d-9e8d-9c2664d32f1e output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'f5e19c5b-aeef-408d-9e8d-9c2664d32f1e') <> '0a48d02acd0fe90f71e06c699b7fc8e2' THEN RAISE EXCEPTION 'result mismatch: f5e19c5b-aeef-408d-9e8d-9c2664d32f1e output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$public$w$ from 220 for 6) placing $w$region$w$ from 152 for 6) placing $w$type$w$ from 100 for 4))::jsonb WHERE id = '6bdf182a-f6e0-4a04-a02e-471e7a53a645' AND md5(output_fields::text) = '1a818b24543b023262870262b4b8d153';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 6bdf182a-f6e0-4a04-a02e-471e7a53a645 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '6bdf182a-f6e0-4a04-a02e-471e7a53a645') <> 'cdb3b1c0df84c9b8ca046f58b092009d' THEN RAISE EXCEPTION 'result mismatch: 6bdf182a-f6e0-4a04-a02e-471e7a53a645 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$public$w$ from 310 for 6) placing $w$typical$w$ from 229 for 7) placing $w$city$w$ from 164 for 4) placing $w$program$w$ from 111 for 7))::jsonb WHERE id = '9e1b2671-ab4b-4a07-9b12-abc5ec71991d' AND md5(output_fields::text) = '5e6135b963d27365e171fcae7279db09';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 9e1b2671-ab4b-4a07-9b12-abc5ec71991d output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '9e1b2671-ab4b-4a07-9b12-abc5ec71991d') <> 'ee64851395d43a2b2ecffd28f3d2333a' THEN RAISE EXCEPTION 'result mismatch: 9e1b2671-ab4b-4a07-9b12-abc5ec71991d output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$booked dates"}]$w$ from 262 for 15) placing $w$nightly$w$ from 185 for 7) placing $w$week$w$ from 110 for 4))::jsonb WHERE id = '3922485c-b300-4e5d-9653-161573f3b269' AND md5(output_fields::text) = '102e30cac120498d1e05d63fc4a20c1d';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 3922485c-b300-4e5d-9653-161573f3b269 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '3922485c-b300-4e5d-9653-161573f3b269') <> 'a4f0994625dc4869fb2445bb8627ea60' THEN RAISE EXCEPTION 'result mismatch: 3922485c-b300-4e5d-9653-161573f3b269 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(output_fields::text placing $w$reason"}]$w$ from 180 for 9) placing $w$improvement$w$ from 121 for 11))::jsonb WHERE id = 'ccedfc73-a7aa-4718-9e51-67d2ac00b2b1' AND md5(output_fields::text) = '465e873795fd7268ffde28c701d88100';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: ccedfc73-a7aa-4718-9e51-67d2ac00b2b1 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'ccedfc73-a7aa-4718-9e51-67d2ac00b2b1') <> '081451e71e4bb9a7a9b4f78d92d298fe' THEN RAISE EXCEPTION 'result mismatch: ccedfc73-a7aa-4718-9e51-67d2ac00b2b1 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(output_fields::text placing $w$recommendation"}]$w$ from 246 for 17) placing $w$cost$w$ from 177 for 4) placing $w$requirement$w$ from 105 for 11))::jsonb WHERE id = '81be3131-6098-4e5a-98c7-ffb11eaa76ae' AND md5(output_fields::text) = '476629ef9be68f49cb59744b740cda48';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 81be3131-6098-4e5a-98c7-ffb11eaa76ae output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '81be3131-6098-4e5a-98c7-ffb11eaa76ae') <> '81ea3c0a3c8f8569023e0b51ed868642' THEN RAISE EXCEPTION 'result mismatch: 81be3131-6098-4e5a-98c7-ffb11eaa76ae output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 367 for 8) placing $w$fit$w$ from 303 for 3) placing $w$stay$w$ from 233 for 4) placing $w$typical$w$ from 167 for 7) placing $w$fees$w$ from 108 for 4))::jsonb WHERE id = 'cbc1e436-ee02-4ec0-8e0a-af4d46d148cb' AND md5(output_fields::text) = '3496f2bad14f496e04c10adb5051ffd1';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: cbc1e436-ee02-4ec0-8e0a-af4d46d148cb output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'cbc1e436-ee02-4ec0-8e0a-af4d46d148cb') <> 'f04baadd867035d6cfa687aa8df8d236' THEN RAISE EXCEPTION 'result mismatch: cbc1e436-ee02-4ec0-8e0a-af4d46d148cb output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$notes"}]$w$ from 275 for 8) placing $w$provider$w$ from 215 for 8) placing $w$month$w$ from 155 for 5) placing $w$frequency$w$ from 99 for 9))::jsonb WHERE id = '8d8c6526-a8f1-41c8-8dd3-634fa371b3e9' AND md5(output_fields::text) = '818a80e553592eed976f04745d08e098';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: 8d8c6526-a8f1-41c8-8dd3-634fa371b3e9 output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = '8d8c6526-a8f1-41c8-8dd3-634fa371b3e9') <> '15c8b7e2db1be7d27ab7b295c59af7fc' THEN RAISE EXCEPTION 'result mismatch: 8d8c6526-a8f1-41c8-8dd3-634fa371b3e9 output_fields'; END IF;
UPDATE public.ao_library_cards SET output_fields = (overlay(overlay(overlay(overlay(output_fields::text placing $w$drive time"}]$w$ from 292 for 13) placing $w$commute$w$ from 221 for 7) placing $w$finding$w$ from 153 for 7) placing $w$source$w$ from 98 for 6))::jsonb WHERE id = 'cca1bf93-dd98-48f6-a04a-ba2ce9d25b8c' AND md5(output_fields::text) = '883decd48bff07edebaaef9044556712';
IF NOT FOUND THEN RAISE EXCEPTION 'not in expected state: cca1bf93-dd98-48f6-a04a-ba2ce9d25b8c output_fields'; END IF;
IF (SELECT md5(output_fields::text) FROM public.ao_library_cards WHERE id = 'cca1bf93-dd98-48f6-a04a-ba2ce9d25b8c') <> '04f66d32471c985086e88fd11af7b789' THEN RAISE EXCEPTION 'result mismatch: cca1bf93-dd98-48f6-a04a-ba2ce9d25b8c output_fields'; END IF;
END
$do$;
