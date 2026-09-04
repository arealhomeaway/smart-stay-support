# Resolve visual system brief (shared, for this rollout pass)

Preserve ALL functionality, data, permissions, routes, queries, lifecycle rules,
demo isolation. This is presentation only. Do not change business logic, server
functions, SQL, or hooks' behavior.

## Typography (desktop-first)

- Serif (`font-display`, Instrument Serif) ONLY for hero greetings, big editorial
  headlines and quotes. Never for section/card/queue titles.
- Sans (default) for everything operational.
- Page title 28–32px semibold (`PageHeader` already does this).
- Section title 18–22px semibold; card/work title 16–18px semibold; body 15–16px
  (`text-[0.9375rem]`/`text-base`); metadata 13–14px (`text-[0.8125rem]`);
  eyebrow 11–12px uppercase with tracking (`eyebrow` utility).
- Generous line height and vertical rhythm. No cramped 12px headings.

## Shared primitives — use these, do not hand-roll equivalents

From `@/components/ui/page`: `PageHeader`, `PageHero`, `SectionCard`,
`SectionBand`, `StatTile`, `EmptyState`, `LoadingRows`, `Chip`, `StageRail`,
`ProgressRing`, `SegmentedControl`, `PriorityRail`.
From `@/components/ui/status`: `StatusBadge`, `ticketTone`, `TONE_SOLID`.
From `@/components/ui/feedback`: `SuccessNote`, `ProgressSteps`, `Celebrate`.
From `@/components/ui/activity`: the shared ActivityList treatment.
From `@/components/PropertyPhoto`: real ARHA property photography
(`properties.primary_photo_url`) with a lettered fallback.
Dates: `usDate`/`usTime`/`usDateTime`/`usShortDate` from `@/lib/dates`
(MM/DD/YYYY, 10:00 PM). Never render ISO dates to users.

## Semantic palette — use it visibly, with stable meaning

teal/`primary` = primary action & selected nav · `sage` = success/complete ·
`sky` = active/in progress/info · `amber` = waiting/attention ·
`coral` = escalation/risk/blocked · `lavender` = review/approval/decision ·
`aqua` = property/context · `cool-grey` = secondary/structure.
Use tints (`bg-sage/8`, `border-sage/25`, `text-sage`) on light surfaces for
action cards, activity icons, timeline markers, progress fills and region
backgrounds — not only tiny pills. Do not hardcode hex or `text-white`
(except on dark photo/plate overlays).

## Surfaces

Bright white/near-white for execution (tickets, work orders, queues, reviews).
Cool neutral (`sunken`) for quiet supporting rails. Warm (`warm-surface`) only
as sparing orientation accent — never the dominant working background.

## Composition rules

- Kill card nesting: never card → card → bordered subsection → bordered row.
  Use whitespace, `SectionBand` headings, hairline separators, timelines,
  imagery.
- Progressive disclosure: secondary/complete/future detail collapses
  (`<details>`, accordion, "Show all").
- Action hierarchy: exactly one filled teal primary per region; secondary =
  outline; tertiary = text/icon. Tabs, chips and filters must not look like
  primary buttons.
- Zero-value items go quiet or collapse rather than shouting.
- Desktop first: no horizontal overflow, no narrow columns when width exists.

## Copy

Plain English. Say what is happening, what matters, what to do, what happens
next. Remove backend/lifecycle explanation, redundant instructions and long
help paragraphs. Short empty states, e.g. "Overnight handoff · 0 open ·
Nothing from overnight still needs attention."

## Verification

Run `bun test` (must stay green) and `bunx tsgo --noEmit` if convenient.
