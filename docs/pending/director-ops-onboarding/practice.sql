-- Run apply body inside a transaction, read back, then ROLLBACK. No data rows change.
BEGIN;
\i apply.sql
