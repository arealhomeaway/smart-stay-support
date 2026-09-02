import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rememberPortal, type PortalDefinition } from "@/lib/portals";

/**
 * One portal, rendered identically on the public overview and the signed-in
 * hub. Signed-out visitors are sent to the shared sign-in page carrying the
 * portal they picked.
 */
export function PortalCard({
  portal,
  authenticated,
  attention,
  recent,
}: {
  portal: PortalDefinition;
  authenticated: boolean;
  /** Short "needs you" line, only when the portal can truthfully report one. */
  attention?: string | undefined;
  recent?: boolean | undefined;
}) {
  const Icon = portal.icon;


  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-200 focus-within:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-accent"
      />
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {recent && <Badge variant="secondary">Last used</Badge>}
      </div>

      <h3 className="mt-4 text-lg font-semibold">{portal.name}</h3>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
        {portal.audience}
      </p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {portal.description}
      </p>
      {attention && (
        <p className="mt-3 text-sm font-medium text-foreground">{attention}</p>
      )}
      <Button asChild className="mt-5 min-h-11 w-full justify-between">
        {authenticated ? (
          <Link to={portal.route} onClick={() => rememberPortal(portal.id)}>
            {portal.action}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <Link
            to="/auth"
            search={{ next: portal.route }}
            onClick={() => rememberPortal(portal.id)}
          >
            {portal.action}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </Button>

    </article>
  );
}
