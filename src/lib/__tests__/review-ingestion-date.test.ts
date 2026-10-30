import { it,expect } from "bun:test";
import { ingestReviews,type ReviewInput } from "../guest-feedback.server";
it("an undated low-star import keeps a display timestamp but never creates a follow-up after the cutoff",async()=>{
 let saved:Record<string,unknown>|undefined;let ticketWrites=0;
 const db={from(table:string){
  const chain:any={select(){return chain},not(){return chain},eq(){return chain},is(){return chain},
   async maybeSingle(){return {data:{value:{date:"2026-01-01"}}}},
   insert(row:Record<string,unknown>){if(table==='guest_feedback')saved=row;else ticketWrites++;return chain},
   async single(){return {data:{...saved,id:"review"},error:null}},
   async limit(){return {data:[]}},
   then(resolve:(v:unknown)=>unknown){return Promise.resolve({data:[]}).then(resolve)}};return chain;
 }};
 const item:ReviewInput={source_review_id:"undated",listing_site:null,ownerrez_property_id:null,booking_id:null,guest_id:null,guest_name:null,stars:2,body:"Old review",response:null,date:null,url:null};
 const r=await ingestReviews(db as never,[item]);
 expect(r.historical).toBe(1);expect(r.ticketsCreated).toBe(0);expect(ticketWrites).toBe(0);expect(typeof saved?.submitted_at).toBe("string");
});