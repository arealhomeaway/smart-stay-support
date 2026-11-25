SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' AND column_name='guidebook_url') column_absent,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='before_value') audit_before_ok;
