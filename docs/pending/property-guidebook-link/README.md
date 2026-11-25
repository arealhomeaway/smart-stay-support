# property-guidebook-link (staged, not applied)
Change 3, answer 4 (Emily, Nov 25). One "Guidebook link" per home.
- `properties.guidebook_url` (empty allowed, must start with http(s)://).
- `set_property_guidebook_link(home, link)`: Admin, Manager and Tech app roles (Operations); audit row with old and new.
- Screen: property page, Operations tab, card "Guidebook link". Arrival check step d shows the link with Copy link
  when filled in, and only the tick when empty.
Preflight: preflight.sql. Undo: undo/01_guidebook_link.sql. Practice: not run.
Apply only on: **Approved: apply property-guidebook-link**
