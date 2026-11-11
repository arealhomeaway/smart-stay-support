-- Takes the label off every home (history kept) and retires the label. Run before 02 undo.
SELECT set_config('app.system_label', 'on', true);
INSERT INTO public.property_label_events(label_id, property_id, action, from_name, actor_label)
SELECT a.label_id, a.property_id, 'removed', l.name, 'Undo'
  FROM public.property_label_assignments a JOIN public.property_labels l ON l.id = a.label_id
 WHERE l.system_key = 'active_owner' AND a.removed_at IS NULL;
UPDATE public.property_label_assignments a SET removed_at = now()
  FROM public.property_labels l WHERE l.id = a.label_id AND l.system_key = 'active_owner' AND a.removed_at IS NULL;
UPDATE public.property_labels SET retired_at = now(), system_key = NULL WHERE system_key = 'active_owner';
