# onboarding-roles-attach (staged, not applied)

Apply only on the exact words `Approved: apply onboarding-roles-attach`.

**Why the Designer and Onboarding Manager sometimes did not attach (checked Nov 21, code and live database)**
1. No way of creating a home names them. Start onboarding, Add home and the earlier imports save the
   Project Manager, Director and Utilities only. The plan then gives each role's Task to the person the
   home names for that role (`project_role_assignee`), and for these two roles that is nobody, so the
   Tasks open with no one on them. Homes only got them when someone later picked them on Project Team.
2. Picking them later on Project Team gives that person the open Tasks only when "move pending" is
   ticked, so most Tasks stayed with no one (Nov 20 saves show 0 moved).

**What apply.sql does (one transaction, additive, nothing deleted)**
1. Stops if `set_onboarding_project_role` or the home project rules differ from Nov 21.
2. `private.default_project_role_person`: the role's holder, else the only person in that role's pool.
3. Trigger `onboarding_project_default_roles` (BEFORE INSERT on onboarding_projects): every new non-demo
   home gets its Designer and Onboarding Manager before its plan is made, so their Tasks open with that
   person on them. A person already chosen is kept. With nobody or several people and no holder, the role
   stays empty. One audit line per home filled.
4. `set_onboarding_project_role`: picking the Designer or Onboarding Manager also gives that person the
   home's open Tasks for the role that have nobody on them. Tasks that name someone are untouched. Body
   before and after: functions-before.sql, functions-after.sql (only that one branch added).
5. Repair: in-progress homes (active or planning, not demo) whose record already names the Designer or
   Onboarding Manager. Their open Tasks for that role with nobody on them get that person: 65 Tasks.
   Finished Tasks, Tasks that name someone, and homes that do not name the role are not touched. The
   Project Manager and Utilities are not part of this repair. One audit line lists every Task and person.

**Not changed**: any Task's date, status or stage; Project Manager or Utilities routing; permissions;
notices or emails (practice: 0 created). Changed Tasks get a new "last changed" time.

**Preflight (Nov 21)**: all 5 checks ok. Rule md5 dc182627c9d96da99e3c1367e3651191; 9 home rules; both
roles have no holder and one pool person each; 36 Designer + 29 Onboarding Manager Tasks; no earlier run.

**Practice (Nov 21, live database, rolled back)**: 65 attached (2601 W 65th St S Designer 12, Onboarding
Manager 10; 3361 E 153rd St S 9 and 9; 6302 Meadow Path Way 12 and 10; 8738 Comstock Ct. Designer 3);
0 left with nobody where the home names the role; 0 finished Tasks changed. New home through Add home:
both roles filled, 1 audit line. New home with a Designer already chosen: kept, Onboarding Manager filled.
Demo home: left empty. Picking the Designer on 3400 N Fern Avenue without "move pending": 8 Tasks moved,
0 left with nobody. 0 notices, 0 emails, 0 chat lines. After undo: every Task's person, every home's roles
and the team rule match before; new rule gone.

**Undo**: apply.undo.sql takes the person off exactly the Tasks the repair attached (where still on them),
restores the team rule exactly, removes the new rule and trigger, writes one audit line.

**Still missing a role after apply (Director of Onboarding to assign)**
| Home | Missing |
|---|---|
| 250 Springfield Xing | Project Manager, Utilities, Designer, Onboarding Manager |
| 3400 N Fern Avenue | Utilities, Designer, Onboarding Manager |
| 8602 E. Galveston St. | Utilities, Designer, Onboarding Manager |
