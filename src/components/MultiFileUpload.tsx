import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/attachments";
import { FileUploadQueue } from "@/lib/file-upload-queue";
import { isZip, prepareUploadSelection } from "@/lib/zip-upload";

export function MultiFileUpload<R>({ upload, onResults, onBusyChange, disabled = false, multiple = true, autoStart = false }: {
  upload: (file: File, progress: (value: number) => void, key: string) => Promise<R>;
  onResults?: (results: R[]) => void; onBusyChange?: ((busy: boolean) => void) | undefined;
  disabled?: boolean; multiple?: boolean;
  /** Start uploading as soon as files are chosen, so a form is never blocked by an unstarted file. */
  autoStart?: boolean;
}) {
  const latest = useRef({ upload, onResults, onBusyChange });
  latest.current = { upload, onResults, onBusyChange };
  const [queue] = useState(() => new FileUploadQueue<File, R>((file, progress, key) => latest.current.upload(file, progress, key)));
  const rows = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot);
  const input = useRef<HTMLInputElement>(null), emitted = useRef<string>("");
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const selecting = useRef(false);
  const busy = queue.busy;
  const unfinished = opening || busy || rows.some(row => row.status === "ready");
  useEffect(() => { latest.current.onBusyChange?.(unfinished); }, [unfinished]);
  useEffect(() => {
    if (opening || busy || rows.some(row => row.status === "ready")) return;
    const ids = rows.filter(row => row.status === "done").map(row => row.id).join(",");
    if (ids && ids !== emitted.current) { emitted.current = ids; latest.current.onResults?.(queue.results()); }
  }, [rows, busy, opening, queue]);
  async function add(files: File[]) {
    if (disabled || busy || selecting.current) return;
    selecting.current = true;
    setOpening(files.some(isZip));
    try { const selected = await prepareUploadSelection(files, multiple); setMessages(selected.messages); queue.add(selected.files); if (autoStart) queue.start(); }
    finally { selecting.current = false; setOpening(false); }
  }
  return <div className="space-y-2" onDragOver={e => { e.preventDefault(); if (!disabled && !busy && !opening) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void add(Array.from(e.dataTransfer.files)); }}>
    <input ref={input} type="file" multiple={multiple} className="hidden" aria-label="Choose files" disabled={disabled || busy || opening} onChange={e => { void add(Array.from(e.target.files ?? [])); e.target.value = ""; }}/>
    <Button type="button" variant="outline" disabled={disabled || busy || opening} className={`h-auto w-full whitespace-normal border-dashed py-4 ${dragging ? "border-primary bg-accent" : ""}`} onClick={() => input.current?.click()}><Upload className="size-4 shrink-0"/>{opening ? "Opening ZIP..." : multiple ? "Select files or drop them here" : "Select a file or drop it here"}</Button>
    {opening ? <p role="status" className="text-sm text-muted-foreground">Opening ZIP...</p> : null}
    {messages.map(message => <p key={message} role="alert" className="text-sm text-destructive">{message}</p>)}
    {rows.length ? <ul aria-label="File uploads" className="divide-y divide-border">{rows.map(row => <li key={row.id} className="space-y-1 py-2 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-all">{row.file.name}</span><span className="text-xs text-muted-foreground">{formatBytes(row.file.size)}</span><span role="status">{row.status === "done" ? "Done" : row.status === "failed" ? "Failed" : row.status === "uploading" ? `${row.progress}%` : "Ready"}</span>{row.status === "failed" && !row.invalid ? <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => queue.retry(row.id)}>Retry</Button> : null}</div><Progress value={row.progress} aria-label={`${row.file.name} upload progress`}/>{row.reason ? <p role="alert" className="break-words text-destructive">{row.reason}</p> : null}</li>)}</ul> : null}
    {rows.some(row => row.status === "ready") ? <Button type="button" disabled={disabled || busy || opening} onClick={() => queue.start()}>Upload files</Button> : null}
  </div>;
}