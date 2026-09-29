-- Evaluate once the whole change (supersede + replacement) is complete, so a
-- correction never briefly looks like a drop and re-alerts.
DROP TRIGGER IF EXISTS cleaner_ledger_reevaluate ON public.cleaner_exposure_ledger;
CREATE CONSTRAINT TRIGGER cleaner_ledger_reevaluate AFTER INSERT OR UPDATE OF superseded_at ON public.cleaner_exposure_ledger
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_ledger_reevaluate();