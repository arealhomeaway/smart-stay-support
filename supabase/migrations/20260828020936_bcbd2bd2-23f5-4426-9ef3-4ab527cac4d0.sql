create or replace function private.owner_sees_property(_user_id uuid, _property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.owner_programs
    where property_id = _property_id and owner_user_id = _user_id
  ) or exists (
    select 1
    from public.owner_program_properties opp
    join public.owner_programs op on op.id = opp.program_id
    where opp.property_id = _property_id
      and op.owner_user_id = _user_id
  )
$$;