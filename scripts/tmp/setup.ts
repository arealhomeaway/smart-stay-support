import { db } from "./db";
const r = await db.from("properties").update({market:"OKC"}).eq("id","a0000000-0000-4000-8000-0000000c0002").eq("is_demo",true).select("name,market");
console.log(JSON.stringify(r));
