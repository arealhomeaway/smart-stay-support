import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ownerHome } from '@/lib/owner-portal.functions';
import { OwnerWorkHistory } from '@/components/owner/OwnerWorkHistory';
import { OwnerPortalMenu } from '@/components/owner/OwnerPortalMenu';
const homeQuery=queryOptions({queryKey:['owner-home','history'],queryFn:()=>ownerHome()});
export const Route=createFileRoute('/_authenticated/owner_/history')({
 loader:({context})=>context.queryClient.ensureQueryData(homeQuery),
 head:()=>({meta:[{title:'My history: Resolve Active Owner'},{name:'description',content:'Your saved cards, added work and hours with ARHA.'},{property:'og:title',content:'My history: Resolve Active Owner'},{property:'og:description',content:'Your saved cards, added work and hours with ARHA.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 errorComponent:()=> <p role="alert">Your history could not load. Please try again.</p>,
 notFoundComponent:()=> <p>No owner history found.</p>,
 component:HistoryPage,
});
function HistoryPage(){
 const {user}=Route.useRouteContext(); const {data}=useSuspenseQuery(homeQuery);
 return <div className="mx-auto max-w-[1120px] space-y-6 text-portal-ink"><OwnerPortalMenu/>{data.linked?<OwnerWorkHistory programId={data.program.id} propertyId={data.properties[0]?.propertyId??null} userId={user.id} readOnly={false}/>:<p>No home is linked to your account yet.</p>}</div>;
}