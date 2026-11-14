/**
 * One rule for showing a connection or list while its check is loading or has
 * failed. A failed check is never shown as "Not connected" or as an empty list.
 */
export type ConnectionState = "checking" | "unknown" | "connected" | "not_connected";

export function connectionState(q: { isLoading: boolean; isError: boolean; connected: boolean | null | undefined }): ConnectionState {
  if (q.isError) return "unknown";
  if (q.isLoading || q.connected == null) return "checking";
  return q.connected ? "connected" : "not_connected";
}

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
  checking: "Checking",
  unknown: "Could not check",
  connected: "Connected",
  not_connected: "Not connected",
};
