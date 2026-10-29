CREATE OR REPLACE FUNCTION private.expense_evidence_changed(o expenses, n expenses)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(o.invoice_document_ids) x),'{}')
           IS DISTINCT FROM coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(n.invoice_document_ids) x),'{}')
      OR coalesce(o.photos_required,false) IS DISTINCT FROM coalesce(n.photos_required,false)
      OR (coalesce(n.photos_required,false) AND
          coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(o.photo_document_ids) x),'{}')
           IS DISTINCT FROM coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(n.photo_document_ids) x),'{}'))
$function$
