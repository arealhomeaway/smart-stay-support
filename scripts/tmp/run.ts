import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { decideNotionRow } from "@/lib/vendor-migration.server";
import { mapNotionCategory, parseLegacyPreference, isTransitionalEligible } from "@/lib/vendor-gold";
const m = JSON.parse(readFileSync("/root/.cache/lovable-auth/session.json","utf8"));
const tok = m.session.access_token;
const db:any = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { global:{headers:{Authorization:`Bearer ${tok}`}}, auth:{persistSession:false}});
const uid = m.session.user.id;
const dry = process.argv[2] !== "go";
const [{data:rows},{data:mk},{data:cats}] = await Promise.all([
  db.from("vendor_import_rows").select("*").eq("source_system","notion").eq("decision","pending").limit(1000),
  db.from("vendor_markets").select("code"), db.from("vendor_service_categories").select("label")]);
const ms = new Set(mk.map((x:any)=>x.code.toLowerCase()));
const cs = new Map(cats.map((c:any)=>[c.label.toLowerCase(),c.label]));
const clean = rows.filter((r:any)=>{
  const lp = parseLegacyPreference(r.preference);
  return r.transitional_eligible && isTransitionalEligible(r.legacy_status, r.preference)
   && !lp.emergencyOnly && !lp.homeOwnersVendor
   && (r.duplicate_candidates??[]).length===0
   && !(r.review_states??[]).some((s:string)=>["missing_contact","missing_category","missing_market","archive_candidate","possible_duplicate"].includes(s))
   && ["email","not_found"].includes(r.breezeway_match_state)
   && r.company?.trim()
   && (r.email?.trim()||r.phone?.trim())
   && r.markets.some((x:string)=>ms.has(x.toLowerCase()))
   && r.specialties.some((s:string)=>mapNotionCategory(s,cs));
});
console.log("pending",rows.length,"clean",clean.length, dry?"(dry)":"");
if(!dry){ let ok=0; for(const r of clean){ try{ await decideNotionRow(db, uid, {rowId:r.id, action:"import", note:"Ticket-launch clean subset (exact criteria: Active/Last Resort, complete, no duplicate, no ambiguity)"}); ok++; }catch(e:any){ console.log("FAIL",r.company,e.message);} } console.log("imported",ok); }
