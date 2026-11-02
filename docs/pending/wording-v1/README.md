# Wording v1 (plain-language rewrite)
- Scope: ARHA Onboarding - Standard working draft (82 steps: title, instructions, homeowner wording) and Active Owner card output labels (54 cards). No published version, setting, condition, role, date, Breezeway link or card status changes.
- apply.sql: one guarded transaction; checks before-state 6c95bbf7e1d110bcc22a4bbad36df090/754b8e16c974bfdba274ec5d0a154d3b and after-state e37e78e2acd5b2fd403eaa7ce75761ae/81475c629ff5276e32ba3b820dc8f2e3.
- receipt.csv: every changed row and field, old and new (154 field changes).
- undo.sql: restores each old value, guarded on the new value. If run through the database tool, drop the BEGIN/COMMIT lines only.
- No owner-facing email template contained flagged words, so none changed.
