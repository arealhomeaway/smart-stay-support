import { db } from "./db";
console.log(JSON.stringify((await db.from("properties").update({market:null}).eq("id","a0000000-0000-4000-8000-0000000c0002").eq("is_demo",true).select("name,market")).data));
console.log(JSON.stringify((await db.from("properties").update({market:"OKC"}).eq("id","a0000000-0000-4000-8000-00000000a001").eq("is_demo",true).select("name,market")).data));
