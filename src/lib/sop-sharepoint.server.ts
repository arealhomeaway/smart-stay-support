import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getServiceSharePointConnectionKey } from "./sharepoint-connection.server";
import { ARHA_RESOLVE_SITE_PATH, SHAREPOINT_CONNECTOR_ID, SHAREPOINT_GATEWAY_BASE_URL } from "./sharepoint";

export async function sopSharePoint() {
  const key = await getServiceSharePointConnectionKey();
  if (!key) throw new Error("SharePoint is unavailable.");
  const graph = async (path: string, init?: RequestInit) => {
    const response = await callAsAppUser({ gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL, connectorId: SHAREPOINT_CONNECTOR_ID, connectionAPIKey: key, path, ...(init ? { init } : {}) });
    if (!response.ok) { const body = await response.text(); console.error(`SOP SharePoint [${response.status}]: ${body}`); throw new Error(`SharePoint [${response.status}]`); }
    return response.status === 204 ? null : response.json();
  };
  return {
    remove: async (file: { driveId: string; id: string }) => { await graph(`/drives/${file.driveId}/items/${file.id}`, { method: "DELETE" }); },
    upload: async (file: File, name: string) => {
      const drive = await graph(`${ARHA_RESOLVE_SITE_PATH}:/drive?$select=id,name`);
      if (drive.name !== "Documents") throw new Error("The Documents library could not be found.");
      let folder;
      try { folder = await graph(`/drives/${drive.id}/root:/SOPs?$select=id`); }
      catch (error) {
        if (!String(error).includes("[404]")) throw error;
        folder = await graph(`/drives/${drive.id}/root/children`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "SOPs", folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
      }
      const target = `/drives/${drive.id}/items/${folder.id}:/${encodeURIComponent(name)}:`;
      // Fail on collisions; never overwrite SharePoint's master copy.
      const session = await graph(`${target}/createUploadSession`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "fail", name } }) });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const chunk = 320 * 1024 * 16;
      try {
        for (let start = 0; start < bytes.length; start += chunk) {
          const end = Math.min(start + chunk, bytes.length);
          const response = await fetch(session.uploadUrl, { method: "PUT", headers: { "Content-Length": String(end - start), "Content-Range": `bytes ${start}-${end - 1}/${bytes.length}` }, body: bytes.slice(start, end) });
          if (!response.ok) { const body = await response.text(); console.error(`SOP upload [${response.status}]: ${body}`); throw new Error("SharePoint upload failed."); }
          const result = await response.json();
          if (response.status !== 202) {
            if (!result.id || !result.webUrl) throw new Error("Could not confirm SharePoint upload.");
            return { id: String(result.id), driveId: String(drive.id), url: String(result.webUrl) };
          }
        }
        throw new Error("Could not confirm SharePoint upload.");
      } catch (error) {
        // Resolve a possibly completed final chunk before reporting an empty save.
        try {
          const completed = await graph(`${target}?$select=id,webUrl`);
          if (completed?.id) await graph(`/drives/${drive.id}/items/${completed.id}`, { method: "DELETE" });
        } catch (cleanup) {
          if (!String(cleanup).includes("[404]")) throw new Error("Could not confirm the save. Check Playbooks before trying again.");
        }
        const cancelled = await fetch(session.uploadUrl, { method: "DELETE" });
        if (!cancelled.ok && cancelled.status !== 404 && cancelled.status !== 410) throw new Error("Could not confirm the save. Check Playbooks before trying again.");
        throw error;
      }
    },
  };
}