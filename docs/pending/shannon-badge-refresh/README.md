# shannon-badge-refresh (staged, not applied)

Runs the existing badge refresh (`refresh_owner_badges`, unchanged) once for Shannon Linder's program
579cb6ae-c5a5-4aa3-aac2-64eedd2faafe, as Admin, on her corrected hours.

**Expected and practiced (Nov 21, live database, rolled back)**: halfway, on_track_owner and strong_finish flagged
(hidden); first_step, building_momentum, engaged_owner and consistent_participation shown; nothing awarded or
recovered; 3 badge_flagged history lines; 0 owner notices, 0 emails, 0 chat lines. Undo restored the rows exactly.

**Stops** if the refresh result differs (anything awarded, recovered, or a different flagged set).

**Undo** (`apply.undo.sql`) puts the three rows back from the copy saved in the apply audit line. The badge history
lines stay (badge history cannot be changed).

**Note**: the same refresh already runs by itself each time her homeowner page loads. If she opens her page before this
is applied, it will flag the same three badges by itself, preflight will then stop, and this package is not needed.
