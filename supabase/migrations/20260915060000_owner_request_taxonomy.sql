-- Unapplied. New requests use Welcome Packet categories; historical codes stay valid.
ALTER TABLE public.owner_reviews ALTER COLUMN owner_action_type SET DEFAULT 'review_comment';
ALTER TABLE public.owner_task_templates ALTER COLUMN owner_action_type SET DEFAULT 'review_comment';
ALTER TABLE public.owner_reviews DROP CONSTRAINT owner_reviews_owner_action_type_check;
ALTER TABLE public.owner_reviews ADD CONSTRAINT owner_reviews_owner_action_type_check CHECK(owner_action_type IN (
 'approve_only','review_comment','review_decide','provide_information','attend_respond','action_payment','information_only','research_recommend',
 'participate','review','approve','attend','research','document'));
ALTER TABLE public.owner_task_templates DROP CONSTRAINT owner_task_templates_owner_action_type_check;
ALTER TABLE public.owner_task_templates ADD CONSTRAINT owner_task_templates_owner_action_type_check CHECK(owner_action_type IN (
 'approve_only','review_comment','review_decide','provide_information','attend_respond','action_payment','information_only','research_recommend',
 'participate','review','approve','attend','research','document'));
