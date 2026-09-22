/**
 * The account button at the bottom of the sidebar: your photo, your name, and
 * the way into your own settings.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PersonAvatar } from "@/components/PersonAvatar";
import { getMyAccount } from "@/lib/account.functions";

export function AccountSidebarItem() {
  const load = useServerFn(getMyAccount);
  const { data } = useQuery({
    queryKey: ["my-account"],
    queryFn: () => load(),
    staleTime: 5 * 60 * 1000,
  });
  const name = data?.fullName || data?.email || "My account";

  return (
    <Link
      to="/account"
      aria-label="My account"
      className="mx-1 flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent"
    >
      <PersonAvatar
        name={data?.fullName}
        email={data?.email}
        photoUrl={data?.photoUrl}
        size="md"
      />
      <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-[0.65rem] text-sidebar-foreground/60">
          {data?.jobTitle || "View my account"}
        </span>
      </span>
    </Link>
  );
}
