import { MAX_FILE_BYTES, OVERSIZE_LINK_MESSAGE, validateFile } from "./attachments";

export const UPLOAD_CONCURRENCY = 3;
export type UploadFile = { name: string; size: number; type: string };
export type UploadRow<F extends UploadFile, R> = {
  id: string; file: F; status: "ready" | "uploading" | "done" | "failed";
  progress: number; reason?: string; invalid: boolean; result?: R;
};

/** One queue owns selection order, independent failures and stable retry keys. */
export class FileUploadQueue<F extends UploadFile, R> {
  rows: UploadRow<F, R>[] = [];
  private active = 0;
  private pending: string[] = [];
  private listeners = new Set<() => void>();
  constructor(private upload: (file: F, progress: (value: number) => void, key: string) => Promise<R>) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.rows;
  private publish() { this.rows = [...this.rows]; this.listeners.forEach(listener => listener()); }
  get busy() { return this.active > 0 || this.pending.length > 0; }
  add(files: F[]) {
    for (const file of files) {
      const check = validateFile(file);
      this.rows.push({ id: crypto.randomUUID(), file, status: check.ok ? "ready" : "failed", progress: 0,
        invalid: !check.ok, reason: check.ok ? undefined : file.size > MAX_FILE_BYTES && !/\.zip$/i.test(file.name) ? OVERSIZE_LINK_MESSAGE : check.message });
    }
    this.publish();
  }
  start() {
    for (const row of this.rows) if (row.status === "ready" && !this.pending.includes(row.id)) this.pending.push(row.id);
    this.pump();
  }
  retry(id: string) {
    const row = this.rows.find(r => r.id === id);
    if (!row || row.status !== "failed" || row.invalid) return;
    row.status = "ready"; row.reason = undefined; row.progress = 0;
    this.pending.push(id); this.publish(); this.pump();
  }
  private pump() {
    while (this.active < UPLOAD_CONCURRENCY && this.pending.length) {
      const id = this.pending.shift(), row = this.rows.find(r => r.id === id);
      if (!row) continue;
      this.active++; row.status = "uploading"; this.publish();
      void this.upload(row.file, value => { row.progress = value; this.publish(); }, row.id)
        .then(result => { row.result = result; row.status = "done"; row.progress = 100; })
        .catch(error => { row.status = "failed"; row.reason = error instanceof Error ? error.message : "The upload did not finish."; })
        .finally(() => { this.active--; this.publish(); this.pump(); });
    }
  }
  results(): R[] { return this.rows.flatMap(row => row.status === "done" && row.result !== undefined ? [row.result] : []); }
}