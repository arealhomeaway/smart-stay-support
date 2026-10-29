import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/attachments";
import { FileUploadQueue } from "@/lib/file-upload-queue";

export function MultiFileUpload<R>({ upload, onResults, onBusyChange, disabled = false, multiple = true }: {
  upload: (file: File, progress: (value: number) => void, key: string) => Promise<R>;
  onResults?: (results: R[]) => void; onBusyChange?: ((busy: boolean) => void) | undefined;
  disabled?: boolean; multiple?: boolean;
}) {
  const latest = useRef({ upload, onResults, onBusyChange });
  latest.current = { upload, onResults, onBusyChange };
  const [queue] = useState(() => new FileUploadQueue<File, R>((file, progress, key) => latest.current.upload(file, progress, key)));
  const rows = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot);
  const input = useRef<HTMLInputElement>(null), emitted = useRef<string>("");
  const [dragging, setDragging] = useState(false);
  const busy = queue.busy;
  const unfinished = busy || rows.some(row => row.status === "ready");
  useEffect(() => { latest.current.onBusyChange?.(unfinished); }, [unfinished]);
  useEffect(() => {
    if (busy || rows.some(row => row.status === "ready")) return;
    const ids = rows.filter(row => row.status === "done").map(row => row.id).join(",");
    if (ids && ids !== emitted.current) { emitted.current = ids; latest.current.onResults?.(queue.results()); }
  }, [rows, busy, queue]);
  function add(files: File[]) { if (!disabled && !busy) queue.add(multiple ? files : files.slice(0, 1)); }
  return <div className="space-y-2" onDragOver={e => { e.preventDefault(); if (!disabled && !busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); add(Array.from(e.dataTransfer.files)); }}>
    <input ref={input} type="file" multiple={multiple} className="hidden" aria-label="Choose files" disabled={disabled || busy} onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ""; }}/>
    <Button type="button" variant="outline" disabled={disabled || busy} className={`h-auto w-full whitespace-normal border-dashed py-4 ${dragging ? "border-primary bg-accent" : ""}`} onClick={() => input.current?.click()}><Upload className="size-4 shrink-0"/>{multiple ? "Select files or drop them here" : "Select a file or drop it here"}</Button>
    {rows.length ? <ul aria-label="File uploads" className="divide-y divide-border">{rows.map(row => <li key={row.id} className="space-y-1 py-2 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-all">{row.file.name}</span><span className="text-xs text-muted-foreground">{formatBytes(row.file.size)}</span><span role="status">{row.status === "done" ? "Done" : row.status === "failed" ? "Failed" : row.status === "uploading" ? `${row.progress}%` : "Ready"}</span>{row.status === "failed" && !row.invalid ? <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => queue.retry(row.id)}>Retry</Button> : null}</div><Progress value={row.progress} aria-label={`${row.file.name} upload progress`}/>{row.reason ? <p role="alert" className="break-words text-destructive">{row.reason}</p> : null}</li>)}</ul> : null}
    {rows.some(row => row.status === "ready") ? <Button type="button" disabled={disabled || busy} onClick={() => queue.start()}>Upload files</Button> : null}
  </div>;
}