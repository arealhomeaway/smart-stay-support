/** Start a browser download of the authenticated participation report. */
export function saveOwnerReportFile(file: { filename: string; mime: string; base64: string }) {
  const bin = atob(file.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.hidden = true;
  try {
    document.body.appendChild(a);
    a.click();
  } finally {
    // Browsers acquire the download asynchronously; keep the Blob available first.
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 40_000);
  }
}
