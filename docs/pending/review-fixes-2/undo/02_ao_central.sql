-- Undo for 02_ao_central.sql: back to IMMUTABLE with no search_path (live sha256 in live-reference.json).
ALTER FUNCTION private.ao_central(date, integer) RESET search_path;
ALTER FUNCTION private.ao_central(date, integer) IMMUTABLE;
