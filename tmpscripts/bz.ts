import { breezewayRequest } from "../src/lib/breezeway.server";
for (const id of [166028165, 166030275]) {
  try {
    const r: any = await breezewayRequest(`/task/${id}`, { method: "PATCH", allowWrite: true, retry: false, body: { status: "finished" } });
    console.log("patched", id, JSON.stringify(r?.type_task_status ?? r).slice(0,200));
  } catch (e: any) { console.log("fail", id, e.status, e.message); }
}
