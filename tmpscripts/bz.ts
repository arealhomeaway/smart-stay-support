import { breezewayRequest } from "../src/lib/breezeway.server";
const id = 166028165;
const variants: any[] = [
  { task_status: "finished" },
  { type_task_status: { code: "finished" } },
  { status: "cancelled" },
  { task_status: "cancelled" },
];
for (const body of variants) {
  try {
    await breezewayRequest(`/task/${id}`, { method: "PATCH", allowWrite: true, retry: false, body });
    const r: any = await breezewayRequest(`/task/${id}`);
    console.log(JSON.stringify(body), "->", JSON.stringify(r.type_task_status));
    if (r.type_task_status?.code !== "created") break;
  } catch (e: any) { console.log(JSON.stringify(body), "ERR", e.status, e.message); }
}
