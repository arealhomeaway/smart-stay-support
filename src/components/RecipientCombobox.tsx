/**
 * A recipient box you can type into or pick from. As soon as someone starts
 * typing, saved contacts on this record and addresses the shared inbox has
 * written to before rise to the top of a short list they can click. Typing a
 * full address and pressing Enter or Tab turns it into a chip instead. Every
 * chip can be taken off again.
 */
import { useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { usDateTime } from "@/lib/dates";
import {
  rankRecipientSuggestions,
  type RecipientSuggestion,
} from "@/lib/email-composer";

export function RecipientCombobox({
  id,
  label,
  chips,
  draft,
  onDraftChange,
  onCommit,
  onPick,
  onRemove,
  suggestions,
  alreadyOnMessage,
  invalid,
  describedBy,
}: {
  id: string;
  label: string;
  chips: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  /** Turn whatever is typed into one or more chips. */
  onCommit: () => void;
  /** Add a picked address straight from the list. */
  onPick: (email: string) => void;
  onRemove: (address: string) => void;
  suggestions: RecipientSuggestion[];
  alreadyOnMessage: string[];
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = `${id}-list`;
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => rankRecipientSuggestions(draft, suggestions, alreadyOnMessage),
    [draft, suggestions, alreadyOnMessage],
  );
  const showList = open && matches.length > 0;

  function choose(email: string) {
    onPick(email);
    onDraftChange("");
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  }

  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-1 rounded-md border p-1">
          {chips.map((address) => (
            <span
              key={address}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
            >
              {address}
              <button
                type="button"
                aria-label={`Remove ${address}`}
                onClick={() => onRemove(address)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id={id}
            ref={inputRef}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
            aria-describedby={[describedBy, hintId].filter(Boolean).join(" ") || undefined}
            aria-invalid={invalid}
            autoComplete="off"
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onDraftChange(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onBlur={() => {
              // Give a click on the list time to land before the box closes.
              window.setTimeout(() => setOpen(false), 120);
              onCommit();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && matches.length > 0) {
                e.preventDefault();
                setOpen(true);
                setActive((i) => (i + 1) % matches.length);
                return;
              }
              if (e.key === "ArrowUp" && matches.length > 0) {
                e.preventDefault();
                setOpen(true);
                setActive((i) => (i - 1 + matches.length) % matches.length);
                return;
              }
              if (e.key === "Escape" && showList) {
                e.preventDefault();
                setOpen(false);
                return;
              }
              if ((e.key === "Enter" || e.key === "Tab") && showList && draft.trim() && matches[active]) {
                e.preventDefault();
                choose(matches[active]!.email);
                return;
              }
              if (e.key === "Enter" || e.key === "," || e.key === ";") {
                e.preventDefault();
                onCommit();
                setOpen(false);
                return;
              }
              if (e.key === "Tab" && draft.trim()) {
                onCommit();
                setOpen(false);
              }
            }}
            placeholder="Type a name or address, or pick from the list"
            className="min-w-[14rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          />
        </div>
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
          >
            {matches.map((match, index) => (
              <li
                key={match.email}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`cursor-pointer rounded px-2 py-1 text-sm ${index === active ? "bg-accent text-accent-foreground" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(match.email)}
              >
                <span className="font-medium">{match.name ? `${match.name} · ` : ""}{match.email}</span>
                <span className="block text-xs text-muted-foreground">
                  {match.group === "record"
                    ? "Contact on this record"
                    : `Previously emailed${match.lastSentAt ? ` · last ${usDateTime(match.lastSentAt)}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p id={hintId} className="sr-only">
        Type to search contacts, or type a full address and press Enter to add it.
      </p>
    </div>
  );
}
