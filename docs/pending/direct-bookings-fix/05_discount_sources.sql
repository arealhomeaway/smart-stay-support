-- Direct Bookings fix, part 5: the 5 percent discount follows the saved referral source record.
-- Data change (one settings row), applied with the data tool, not as a migration. No BEGIN/COMMIT.
-- Undo: 05_undo_discount_sources.sql
--
-- Saves the three referral source records that get the discount by their record id, so a
-- name change on the Referral sources page can never drop or move the discount. The app
-- already uses the same three records until this is applied.
--   MyMetis / Stay with Oasis   a0e95fa9-b49b-4799-84dc-2aa77e30aaad
--   Owl Marketplace             4154beb4-84bd-4e0c-825b-3aad9d73c632
--   Travelers Haven             5056ffce-322d-43e1-888f-c9373550a453

UPDATE public.app_settings
   SET value = value || jsonb_build_object('discountSourceIds', jsonb_build_array(
         'a0e95fa9-b49b-4799-84dc-2aa77e30aaad',
         '4154beb4-84bd-4e0c-825b-3aad9d73c632',
         '5056ffce-322d-43e1-888f-c9373550a453')),
       updated_at = now()
 WHERE key = 'direct_booking_settings';
