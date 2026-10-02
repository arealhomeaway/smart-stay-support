import { Badge } from "@/components/ui/badge";
import { usDate } from "@/lib/dates";
import {
  FINANCE_REVIEW_LABEL,
  RESPONSIBILITY_LABEL,
  docReadiness,
  reservationBlocks,
  money,
  purchaseNeedsLeadership,
  type ExpenseFacts,
  type FinanceReview,
  type Responsibility,
} from "@/lib/expenses";

export type ExpenseRow = ExpenseFacts & {
  id: string;
  received_on: string;
  proposed_statement_period: string | null;
  ops_completion: "open" | "done";
  finance_review: FinanceReview;
  cost_responsibility: Responsibility;
  reservation_link_state: "not_relevant" | "linked" | "unresolved";
  ownerrez_booking_id?: string | null;
  archived_at?: string | null;
  duplicate_flag?: string | null;
  is_estimate?: boolean;
  purchase_auth_status?: string | null;
  leadership_decision?: string | null;
  properties?: { name: string } | null;
  expense_links?: { id: string }[];
};

export const EXPENSE_SELECT =
  "id, property_id, expense_type, payee, amount, expense_date, received_on, reason, dispatch_reason, visit_outcome, purchased_what, purchase_purpose, invoice_document_ids, photo_document_ids, photos_required, approval_id, authorization_note, proposed_statement_period, ops_completion, finance_review, cost_responsibility, reservation_link_state, ownerrez_booking_id, archived_at, duplicate_flag, is_estimate, purchase_auth_status, leadership_decision, properties(name), expense_links(id)";

export function ExpenseChips({ e }: { e: ExpenseRow }) {
  const ready = docReadiness(e) === "ready";
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline">Ops: {e.ops_completion === "done" ? "Done" : "Open"}</Badge>
      <Badge variant={ready ? "secondary" : "outline"}>Documents: {ready ? "Ready" : "Missing items"}</Badge>
      <Badge variant={e.finance_review === "reviewed" ? "secondary" : "outline"}>Finance: {FINANCE_REVIEW_LABEL[e.finance_review]}</Badge>
      {reservationBlocks(e.reservation_link_state, e.ownerrez_booking_id) && <Badge variant="destructive">Reservation required — unresolved</Badge>}
      {e.archived_at && <Badge variant="outline">Archived</Badge>}
      {e.is_estimate && <Badge variant="outline">Estimate — not an invoice</Badge>}
      {e.duplicate_flag === "suspected" && <Badge variant="destructive">Possible duplicate — review</Badge>}
      {purchaseNeedsLeadership({ expense_type: e.expense_type, purchase_auth_status: e.purchase_auth_status ?? null, leadership_decision: e.leadership_decision ?? null }) && <Badge variant="destructive">Purchase authorization — leadership decision needed</Badge>}
    </div>
  );
}

export function ExpenseList({ rows, onOpen, showProperty = true }: { rows: ExpenseRow[]; onOpen: (id: string) => void; showProperty?: boolean }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {rows.map((e) => (
        <li key={e.id}>
          <button type="button" onClick={() => onOpen(e.id)} className="flex w-full flex-col gap-2 p-3 text-left hover:bg-muted/50">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {e.payee || "No payee yet"} · {money(e.amount)}
                {showProperty && <span className="text-muted-foreground"> · {e.properties?.name ?? "No property"}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                Expense date {e.expense_date ? usDate(e.expense_date) : "—"} · Received {usDate(e.received_on)} · Responsibility {RESPONSIBILITY_LABEL[e.cost_responsibility]}
              </span>
            </div>
            <ExpenseChips e={e} />
          </button>
        </li>
      ))}
    </ul>
  );
}
