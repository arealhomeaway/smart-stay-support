-- Undo for 04_reply_template.sql: restores the saved reply template exactly as it was
-- (captured from the live row on Nov 8, 2026). Data change. No BEGIN/COMMIT.

UPDATE public.email_templates
   SET subject = 'Homes for {{dates}}',
       body = 'Hello {{contact_name}},

Thank you for thinking of A Real Home Away. Here are the homes we can offer for {{dates}}:

{{homes}}

{{fees}}

Please let us know which home works best, and we will hold it for you.

Kind regards,
{{sender_name}}
A Real Home Away',
       updated_at = now()
 WHERE name = 'Direct booking reply';
