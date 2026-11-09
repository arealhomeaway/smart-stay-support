# src/components/property rules
- Home photos on cards, headers and the Home banner render through `HomePhoto`/`homePhotoUrl` (src/components/property/HomePhoto.tsx, medium then full OwnerRez photo, neutral block on none or load failure); the daily banner pick lives only in `src/lib/daily-home-photo.ts`. Why: one photo rule, never a broken image.
