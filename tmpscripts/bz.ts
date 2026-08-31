import { breezewayRequest } from "../src/lib/breezeway.server";
for (const id of [166028165, 166030275]) {
  const r: any = await breezewayRequest(`/task/${id}`);
  console.log(id, JSON.stringify(r.type_task_status), r.finished_at);
}
