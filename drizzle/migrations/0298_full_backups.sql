-- Full backup, part 1 (Emily, Nov 7, 2026; register N8). Admin only "Back up everything".
-- 1. full_backups: one row per backup (who, when, folder, counts). Written only by the server
--    after it has checked the caller is an Admin; Admins can read it. Other steps (the clean
--    slate) check it for a recent backup.
-- 2. backup_list_tables / backup_read_table: read every table in the public schema for the
--    backup, with exact row counts. Secret values (encrypted passwords, codes, tokens and their
--    hashes) never leave the database: those columns are left out of the export and listed by
--    name in the manifest. Only the server's service role may call them.
-- Reads only; changes no existing table, function or trigger. Undo: 01_undo_full_backups.sql.
CREATE TABLE public.full_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  table_count integer,
  total_rows bigint,
  counts jsonb,
  manifest_sha256 text,
  error text,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id),
  verify_ok boolean,
  verify_result jsonb
);
CREATE INDEX full_backups_created_idx ON public.full_backups (created_at DESC);

GRANT SELECT ON public.full_backups TO authenticated;
GRANT ALL ON public.full_backups TO service_role;
ALTER TABLE public.full_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read full backups" ON public.full_backups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- The one rule for secret columns: encrypted values, nonces, tokens and token hashes.
CREATE OR REPLACE FUNCTION public.backup_secret_column(_column text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _column ~* '(_enc|ciphertext|nonce|token_hash|_token|password|secret)$'
$function$;

CREATE OR REPLACE FUNCTION public.backup_list_tables()
 RETURNS TABLE(table_name text, row_count bigint, withheld_columns text[])
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _t text;
BEGIN
  FOR _t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname
  LOOP
    table_name := _t;
    EXECUTE format('SELECT count(*) FROM public.%I', _t) INTO row_count;
    withheld_columns := ARRAY(
      SELECT a.attname::text FROM pg_attribute a
       WHERE a.attrelid = format('public.%I', _t)::regclass AND a.attnum > 0 AND NOT a.attisdropped
         AND public.backup_secret_column(a.attname)
       ORDER BY a.attnum);
    RETURN NEXT;
  END LOOP;
END
$function$;

CREATE OR REPLACE FUNCTION public.backup_read_table(_table text, _offset integer, _limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _rel regclass; _order text; _drop text[]; _out jsonb;
BEGIN
  SELECT c.oid INTO _rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname = _table;
  IF _rel IS NULL THEN RAISE EXCEPTION 'Not a table in the public schema: %', _table; END IF;
  IF _offset < 0 OR _limit < 1 OR _limit > 5000 THEN RAISE EXCEPTION 'Bad page'; END IF;
  -- A stable order: the primary key, else the whole row.
  SELECT string_agg(format('t.%I', a.attname), ', ' ORDER BY k.ord) INTO _order
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
   WHERE i.indrelid = _rel AND i.indisprimary;
  _drop := ARRAY(SELECT a.attname::text FROM pg_attribute a
                  WHERE a.attrelid = _rel AND a.attnum > 0 AND NOT a.attisdropped
                    AND public.backup_secret_column(a.attname));
  EXECUTE format(
    'SELECT coalesce(jsonb_agg(r.j ORDER BY r.n), ''[]''::jsonb) FROM (
       SELECT to_jsonb(t) - $1 AS j, row_number() OVER (ORDER BY %s) AS n
         FROM public.%I t ORDER BY %s OFFSET $2 LIMIT $3) r',
    coalesce(_order, 't::text'), _table, coalesce(_order, 't::text'))
    INTO _out USING _drop, _offset, _limit;
  RETURN _out;
END
$function$;

REVOKE ALL ON FUNCTION public.backup_secret_column(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_list_tables() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_read_table(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_secret_column(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_read_table(text, integer, integer) TO service_role;
