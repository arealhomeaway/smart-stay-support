import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { OWNER_PORTAL_LINKS } from '@/lib/shell-nav';
export function OwnerPortalMenu({home}:{home?:string}) {
 return <nav aria-label="Owner menu" className="flex flex-wrap gap-1 border-b pb-2">
  {OWNER_PORTAL_LINKS.map(item=><Button asChild key={item.label} variant="ghost" className="min-h-11">
   {item.view==='history'?<Link to="/owner/history">{item.label}</Link>:<Link to="/owner" search={{...(home?{home}:{}),...(item.view?{view:item.view}:{})}}>{item.label}</Link>}
  </Button>)}
 </nav>;
}