import { listBreezewayProperties, breezewayRequest } from "../src/lib/breezeway.server";
const { items } = await listBreezewayProperties();
console.log("total", items.length);
console.log(JSON.stringify(items.slice(0,10), null, 1));
for (const t of [166028165, 166030275]) {
  const before: any = await breezewayRequest(`/inspection/tasks/${t}`);
  console.log("task", t, JSON.stringify({status: before?.status, stage: before?.stage, name: before?.name}));
}
