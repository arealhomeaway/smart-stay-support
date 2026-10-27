-- Non-destructive rollback: preserve every recorded decision, Ticket and history row.
REVOKE EXECUTE ON FUNCTION public.save_handoff_requirement(jsonb),public.confirm_handoff_suggestion(uuid),public.read_handoff_standard(),public.can_edit_handoff_standard() FROM authenticated;
COMMENT ON TABLE public.handoff_requirements IS 'DEPRECATED on rollback: retained with standard history; restore prior code.';
COMMENT ON TABLE public.handoff_standard_history IS 'Retained append-only history on rollback.';
COMMENT ON TABLE public.handoff_link_suggestions IS 'DEPRECATED on rollback: retained confirmed provenance.';
COMMENT ON TABLE public.home_handoff_decisions IS 'Retained home decision history on rollback.';
COMMENT ON TABLE public.handoff_carryovers IS 'Retained canonical carry-over Ticket links on rollback.';
COMMENT ON TABLE public.handoff_step_history IS 'Retained handoff and booking-block acknowledgment history on rollback.';
