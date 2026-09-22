/**
 * One face treatment for the whole product.
 *
 * Wherever a person appears on work — an assignee, an activity line, a team
 * list — they appear the same way: their photo when they have uploaded one,
 * their initials when they have not.
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { personInitials } from "@/lib/notification-preferences";
import { usePerson } from "@/hooks/usePeople";

const SIZE = {
  xs: "size-5 text-[0.55rem]",
  sm: "size-6 text-[0.6rem]",
  md: "size-8 text-xs",
  lg: "size-12 text-sm",
  xl: "size-20 text-lg",
} as const;

export function PersonAvatar({
  name,
  email,
  photoUrl,
  size = "sm",
  className,
}: {
  name?: string | null | undefined;
  email?: string | null | undefined;
  photoUrl?: string | null | undefined;
  size?: keyof typeof SIZE | undefined;
  className?: string | undefined;
}) {
  const label = name || email || "Teammate";
  return (
    <Avatar className={cn(SIZE[size], "shrink-0", className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={label} /> : null}
      <AvatarFallback className="bg-muted font-semibold text-muted-foreground">
        {personInitials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}

/** The same face, looked up by user id from the shared people directory. */
export function PersonAvatarById({
  userId,
  fallbackName,
  size = "sm",
  className,
}: {
  userId: string | null | undefined;
  fallbackName?: string | null | undefined;
  size?: keyof typeof SIZE | undefined;
  className?: string | undefined;
}) {
  const person = usePerson(userId);
  return (
    <PersonAvatar
      name={person?.name ?? fallbackName}
      email={person?.email}
      photoUrl={person?.photoUrl}
      size={size}
      className={className}
    />
  );
}

/** Face plus name, for lists and assignee lines. */
export function PersonChip({
  userId,
  name,
  email,
  photoUrl,
  secondary,
  size = "sm",
  className,
}: {
  userId?: string | null | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  photoUrl?: string | null | undefined;
  secondary?: string | null | undefined;
  size?: keyof typeof SIZE | undefined;
  className?: string | undefined;
}) {
  const person = usePerson(userId);
  const shownName = name ?? person?.name ?? email ?? "Unassigned";
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <PersonAvatar
        name={shownName}
        email={email ?? person?.email}
        photoUrl={photoUrl ?? person?.photoUrl}
        size={size}
      />
      <span className="min-w-0 truncate">
        <span className="truncate text-sm">{shownName}</span>
        {secondary ? (
          <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
        ) : null}
      </span>
    </span>
  );
}
