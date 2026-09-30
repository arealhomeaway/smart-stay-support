import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const m = JSON.parse(readFileSync("/root/.cache/lovable-auth/session.json","utf8"));
export const db:any = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { global:{headers:{Authorization:`Bearer ${m.session.access_token}`}}, auth:{persistSession:false}});
export const uid = m.session.user.id;
