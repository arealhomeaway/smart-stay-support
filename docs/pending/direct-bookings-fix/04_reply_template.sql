-- Direct Bookings fix, part 4: the saved reply template in the approved format.
-- Data change (one email_templates row), applied with the data tool, not as a migration. No BEGIN/COMMIT.
-- Undo: 04_undo_reply_template.sql
--
-- The app fills {{intro}}, {{homes}} and {{fees}}: the one-home or several-homes opening
-- sentence; per home Address, Property Link, Distance to residence address (only when an
-- address was given), Beds, Baths, Availability, Nightly Rate, Monthly Rent; and the One
-- Time Fees lines in the fixed order, with no $0 lines. Only this row changes.

UPDATE public.email_templates
   SET subject = 'RE: {{subject}}',
       body = E'Hello {{contact_first_name}},\n\n{{intro}}\n\n{{homes}}\n\n{{fees}}\n\nPlease let us know if you have any questions.\n\nThank you,\n{{sender_first_name}}\n\nCustomer Service\n3000 E Britton Rd.\nOklahoma City, OK 73131\n405.415.2898 Ext. 0\ninfo@arealhomeaway.com\nwww.arealhomeaway.com',
       updated_at = now()
 WHERE name = 'Direct booking reply';
