import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const readReleasedPropertyActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid() }).parse(d))
  .handler(async ({context,data}) => {
    const { assertStaff } = await import("./vendor.server");
    await assertStaff(context.supabase, context.userId);
    const r = await context.supabase.from("owner_reviews").select("id,title,status,notified_at,closed_at,responded_at,owner_response,recommendation,impact,evidence,business_question,decision_path,created_by,property_id,program_id,updated_at,source_type,attachment_path,photos")
      .eq("property_id",data.propertyId).is("archived_at",null).order("sort_order").limit(1000);
    if(r.error) throw new Error(r.error.message);
    // The pending conversation extension is optional until approved, never hide live activities.
    const rpc = context.supabase.rpc as unknown as (name:string,args:Record<string,unknown>)=>Promise<{data: {review_id:string;author_type:string;event:string|null;created_at:string}[]|null;error:{code?:string;message:string}|null}>;
    const messages=await rpc("read_owner_review_conversations",{_property_id:data.propertyId});
    if(messages.error && !["PGRST202","42883"].includes(messages.error.code??"")) throw new Error(messages.error.message);
    return (r.data??[]).map(row=>{
      const thread=(messages.data??[]).filter(m=>m.review_id===row.id);
      const lastEvent=thread.filter(m=>m.event).at(-1);
      return {...row,status:lastEvent?.event==="resolved"?"closed":lastEvent?.event==="reopened"?"awaiting_owner":row.status,last_staff_at:thread.filter(m=>m.author_type==="staff").at(-1)?.created_at??null};
    });
  });

export const manageReleasedActivity = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({id:z.string().uuid(),action:z.enum(["reply","resolve","reopen","edit"]),body:z.string().trim().max(5000).default(""),title:z.string().trim().max(200).default(""),what:z.string().trim().max(5000).default(""),why:z.string().trim().max(5000).default(""),expectedUpdatedAt:z.string().optional()}).parse(d))
  .handler(async({context,data})=>{
    const rpc=context.supabase.rpc as unknown as (name:string,args:Record<string,unknown>)=>Promise<{error:{message:string}|null}>;
    const result=await rpc("manage_owner_review_conversation",{_id:data.id,_action:data.action,_body:data.body,_title:data.title,_what:data.what,_why:data.why,_expected_updated_at:data.expectedUpdatedAt??null});
    if(result.error)throw new Error(result.error.message);
    return {ok:true};
  });

export const readReleasedConversation = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({id:z.string().uuid()}).parse(d))
  .handler(async({context,data})=>{
    const rpc=context.supabase.rpc as unknown as (name:string,args:Record<string,unknown>)=>Promise<{data:import("./owner-conversation").ConversationMessage[]|null;error:{message:string;code?:string}|null}>;
    const r=await rpc("read_owner_review_thread",{_id:data.id});
    if(r.error){if(["PGRST202","42883"].includes(r.error.code??""))return {messages:[],available:false};throw new Error(r.error.message);}
    return {messages:r.data??[],available:true};
  });