# One-time resend of two failed homeowner plan ready emails

Not applied. Apply only after "Approved: apply owner-plan-email-resend".

Read live Nov 13:

| Notification | Program | Made (Central) | Email | Error |
|---|---|---|---|---|
| 161270b0-8c30-4f32-8884-22a90275ad90 | 2d05252c (Buckland and Daniel Ct) | Nov 12 5:51 PM | failed | Mail provider [502] |
| 17890bf3-7335-4345-a746-8633013a2d74 | 814b9c32 (Galveston) | Nov 12 6:21 PM | failed | Mail provider [504] |

Both are real (not demo). No later plan ready email went to either homeowner.
The texts still say "We added 65 activities..." and "We added 32 activities..." as written Nov 12.

How it sends: the five-minute job picks up emails waiting to send, claims each one, and sends it once.
If it fails again it stays failed; nothing retries by itself.

Files
- `00_preflight.sql` stops unless both are still failed and no later plan ready email went out.
- `apply.sql` sets both to waiting (pending) and writes one audit_log row. Stops if either changed.
- `apply.undo.sql` sets any still waiting back to failed. A sent email cannot be called back.
- The old error text is kept on each row; a successful send changes only the status.

Practice run: `src/lib/__tests__/owner-plan-email-resend-sql.test.ts` on an isolated copy.
