import { breezewayRequest } from "../src/lib/breezeway.server";
for (const t of [166028165, 166030275]) {
  const r: any = await breezewayRequest(`/task/${t}`);
  console.log("task", t, JSON.stringify({status: r?.status, stage: r?.stage, name: r?.name, home: r?.home_id}));
}
