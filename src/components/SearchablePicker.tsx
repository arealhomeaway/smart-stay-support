/**
 * A dropdown you can type into (Nov 12 item 34). Matching is by any part of the
 * name, from src/lib/searchable-picker.ts; a second small line tells apart two
 * options with the same name.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { filterPickerOptions, type PickerOption } from "@/lib/searchable-picker";
import { cn } from "@/lib/utils";

export function SearchablePicker({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = "Type to search",
  disabled,
  loading,
}: {
  id?: string;
  /** Accessible name of the picker. */
  label: string;
  value: string | null;
  options: readonly PickerOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const shown = useMemo(() => filterPickerOptions(options, term), [options, term]);
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTerm("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
          className="min-h-11 w-full justify-between font-normal"
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? selected.label : loading ? "Loading…" : placeholder}
            {selected?.detail ? <span className="ml-2 text-xs text-muted-foreground">{selected.detail}</span> : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={term} onValueChange={setTerm} aria-label={`Search ${label}`} />
          <CommandList>
            <CommandEmpty>{loading ? "Loading…" : "Nothing matches."}</CommandEmpty>
            {shown.map((o) => (
              <CommandItem
                key={o.value}
                value={o.value}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                  setTerm("");
                }}
                className="min-h-11"
              >
                <Check className={cn("size-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{o.label}</span>
                  {o.detail ? <span className="text-xs text-muted-foreground">{o.detail}</span> : null}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
