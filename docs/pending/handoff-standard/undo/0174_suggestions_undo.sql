-- Preserve all confirmed suggestions as provenance.
DELETE FROM public.handoff_link_suggestions WHERE confirmed_at IS NULL AND confidence='Clear keyword match only. Confirm scope, proof and the home template before linking.';
