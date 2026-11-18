# src/components/queue rules
- Team Queue and Oversight render one shared `TicketTable` (src/components/queue); due lines, grouping and in-group order live only in `src/lib/ticket-table.ts`, read from existing ticket fields with queueSort as the last tie breaker. Why: both pages look the same and layout never changes clocks or filters.
