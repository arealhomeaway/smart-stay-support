# Access conversion table

| Object | Old check | New check | State |
|---|---|---|---|
| private.is_program_member(uuid,uuid) | Absent | Canonical primary OR active program_members row | New, staged only |
| public.program_members / program_members_read | Absent | Member roster read OR existing Admin/Onboarding Director predicates | New, staged only |
| Existing owner access functions/policies | Unchanged | Planned private.is_program_member(program_id,actor) substitution | Not converted in this part |

**Existing objects replaced: 0.** Read-only inventory includes 59 live functions mentioning owner_user_id and one direct policy. This is a candidate list, not 59 interchangeable access gates and not a complete policy inventory.

Deliberately unchanged: all primary email recipients; primary identity/enrollment and invite checks; notification delivery guards; staff authority; canonical owner and property matching; demo/synthetic safeguards; actor attribution. Access helpers, dependent policies, storage/file signing and direct application comparisons still require classification and conversion together before enabling co-owners.