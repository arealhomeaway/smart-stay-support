# Participation report v2 (staged, not applied)

Apply order: `01_report_v2.sql`, then `02_wording_seed.data.sql`. Undo in reverse: `undo/02_wording_seed.data.sql`, then `undo/01_report_v2.sql`.

- No live function, policy or trigger is replaced, so there is no base64 capture; undo drops only new objects.
- `owner_time_entries` is never written. Labels are read-only.
- New functions: no EXECUTE for anon or PUBLIC; authenticated only.
- `legacy-map.csv`: every earlier activity title with its entry count. No exact library title match was found, so no card code is proposed. Rows Emily approves are loaded into `report_legacy_card_map` as a separate approved data step.
- Until 01 is applied, reports keep the fixed sentences and show "Earlier activity" with the program owner's name.
