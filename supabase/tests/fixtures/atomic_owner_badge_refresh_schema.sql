-- Production already has this constraint; the early closeout fixture omitted it.
CREATE UNIQUE INDEX owner_badges_program_code_unique ON owner_badges(program_id,code);
GRANT ALL ON owner_badges TO service_role;
