/**
 * A note box with an @mention picker (Emily, Nov 7, 2026). Typing @ lists staff who can see the
 * ticket; picking one writes "@Full Name" into the note. The parent reads the picked ids with
 * mentionsInText when it saves. Rules in src/lib/mentions.ts.
 */
import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MENTIONABLE_ROLES,
  MENTION_COPY,
  insertMention,
  matchPeople,
  mentionName,
  mentionQuery,
  type MentionPerson,
} from "@/lib/mentions";

export function useMentionPeople() {
  return useQuery({
    queryKey: ["mention-people"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").is("removed_at", null).order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      const staff = new Set(
        (roles.data ?? [])
          .filter((r) => (MENTIONABLE_ROLES as readonly string[]).includes(r.role as string))
          .map((r) => r.user_id),
      );
      return (profiles.data ?? []).filter((p) => staff.has(p.id)) as MentionPerson[];
    },
  });
}

export function MentionTextarea({
  value,
  onChange,
  picked,
  onPickedChange,
  placeholder,
  rows = 3,
  id,
}: {
  value: string;
  onChange: (text: string) => void;
  picked: string[];
  onPickedChange: (ids: string[]) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const listId = useId();
  const people = useMentionPeople();
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const matches = query ? matchPeople(people.data ?? [], query.query) : [];
  const open = query !== null;

  function track(text: string, caret: number) {
    const q = mentionQuery(text, caret);
    setQuery(q);
    setActive(0);
  }

  function pick(person: MentionPerson) {
    const el = ref.current;
    if (!el || !query) return;
    const next = insertMention(value, query.start, el.selectionStart ?? value.length, person);
    onChange(next.text);
    if (!picked.includes(person.id)) onPickedChange([...picked, person.id]);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setQuery(null);
          } else if (e.key === "ArrowDown" && matches.length) {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp" && matches.length) {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if ((e.key === "Enter" || e.key === "Tab") && matches[active]) {
            e.preventDefault();
            pick(matches[active]!);
          }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={MENTION_COPY.label}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{MENTION_COPY.empty}</li>
          ) : (
            matches.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center rounded px-3 text-sm",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
              >
                {mentionName(p)}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
