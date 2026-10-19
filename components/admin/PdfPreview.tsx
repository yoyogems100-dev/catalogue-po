'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type PdfPreviewFile = {
  /** A blob: URL of the PDF, made with `URL.createObjectURL`. */
  url: string;
  fileName: string;
  title: string;
};

/** Saves a blob: URL under a file name (the `download` attribute needs a same-origin URL). */
export function saveBlobUrl(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Fetches a PDF into a blob: URL, with the file name from Content-Disposition (else the URL). */
export async function fetchPdf(input: string, init?: RequestInit): Promise<{ url: string; fileName: string; res: Response }> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'The PDF could not be made. Please retry.');
  const blob = await res.blob();
  const fromHeader = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1];
  const fromUrl = decodeURIComponent(new URL(input, window.location.href).pathname.split('/').pop() || '');
  const fileName = fromHeader || (fromUrl.toLowerCase().endsWith('.pdf') ? fromUrl : 'document.pdf');
  return { url: URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })), fileName, res };
}

/**
 * A full-screen look at a PDF before it is downloaded. Desktop and iPhone
 * browsers show it inline; Android Chrome can't show a PDF inside a page, so
 * there it offers to open it in the phone's own viewer instead.
 *
 * `onDownload` replaces the plain save, for a download that does more (the
 * price list can also save a customer's prices).
 */
export default function PdfPreviewDialog({ file, onClose, onDownload, downloading = false }: {
  file: PdfPreviewFile | null;
  onClose: () => void;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [inline, setInline] = useState(true);

  useEffect(() => {
    // Only known after mount (no `navigator` on the server).
    setInline((navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (file && !dialog.open) dialog.showModal();
    if (!file && dialog.open) dialog.close();
  }, [file]);

  return (
    <dialog ref={ref} className="pdf-preview-dialog" aria-labelledby={titleId} onClose={onClose}>
      <header className="price-list-dialog-head">
        <h2 id={titleId}>{file?.title || 'Preview'}</h2>
        <button type="button" aria-label="Close preview" onClick={() => ref.current?.close()}>×</button>
      </header>
      <div className="pdf-preview-body">
        {file && (inline
          ? <iframe src={`${file.url}#view=FitH`} title={file.title} />
          : (
            <div className="pdf-preview-fallback">
              <p>This phone can’t show a PDF inside the page.</p>
              <a className="btn" href={file.url} target="_blank" rel="noopener noreferrer">Open preview</a>
            </div>
          ))}
      </div>
      <footer className="price-list-dialog-foot">
        <span className="pdf-preview-name" title={file?.fileName}>{file?.fileName}</span>
        <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>Close</button>
        <button
          type="button"
          className="btn"
          disabled={!file || downloading}
          onClick={() => { if (!file) return; if (onDownload) onDownload(); else saveBlobUrl(file.url, file.fileName); }}
        >
          {downloading ? 'Downloading…' : 'Download'}
        </button>
      </footer>
    </dialog>
  );
}

/**
 * A GET link to a PDF (e.g. the shape & size chart) that shows it first.
 * Falls back to the plain link if it can't be fetched.
 */
export function PdfPreviewLink({ href, title, className = 'btn-ghost', children }: {
  href: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [file, setFile] = useState<PdfPreviewFile | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { url, fileName } = await fetchPdf(href);
      setFile({ url, fileName, title });
    } catch {
      window.location.href = href;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a className={className} href={href} onClick={open} aria-busy={busy}>{busy ? 'Opening…' : children}</a>
      <PdfPreviewDialog file={file} onClose={() => { if (file) { const url = file.url; setTimeout(() => URL.revokeObjectURL(url), 10_000); } setFile(null); }} />
    </>
  );
}
