import { listBreezewayProperties } from "../src/lib/breezeway.server";
const { items } = await listBreezewayProperties();
console.log(items.length);
console.log(items.map((i:any)=>[i.id,i.name,i.city,i.state,i.status].join(" | ")).join("\n"));
