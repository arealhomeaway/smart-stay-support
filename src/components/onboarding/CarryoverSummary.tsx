import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {readHomeHandoffStandard} from '@/lib/handoff-standard.functions';
export function CarryoverSummary({propertyId}:{propertyId:string}){const read=useServerFn(readHomeHandoffStandard);const q=useQuery({queryKey:['home-handoff-standard',propertyId],queryFn:()=>read({data:{propertyId}})});const count=q.data?.carryovers.length??0;return count?<p className="text-sm font-medium">{count} carry-over items</p>:null;}
