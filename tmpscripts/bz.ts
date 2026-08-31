import { breezewayRequest } from "../src/lib/breezeway.server";
const id = 166028165;
const tries: [string,string,any][] = [
  [`/task/${id}/status`, "POST", { status: "finished" }],
  [`/task/${id}/status`, "PUT", { status: "finished" }],
  [`/task/${id}/finish`, "POST", {}],
];
for (const [path, method, body] of tries) {
  try { const r = await breezewayRequest(path, { method, allowWrite: true, retry: false, body }); console.log("OK", path, method, JSON.stringify(r).slice(0,200)); }
  catch (e: any) { console.log("ERR", path, method, e.status); }
}
const r: any = await breezewayRequest(`/task/${id}`);
console.log("now", JSON.stringify(r.type_task_status));
