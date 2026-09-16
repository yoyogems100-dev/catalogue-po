'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type PreviewRow = { data: Record<string, any>; status: string; unmatchedCategories?: string[]; unmatchedPlace?: string };

const STATUS_LABEL: Record<string, string> = {
  valid: 'Ready',
  missing_name: 'Missing name -- will be skipped',
  missing_required: 'Missing name and company -- will be skipped',
  unmatched_category: 'Unknown category name(s)'
};

export default function BulkImportButton({ entity, label }: { entity: 'suppliers' | 'customers'; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFileChosen(file: File) {
    setPreviewing(true); setError(''); setRows(null); setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/admin/${entity}/import-preview`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not read that file.');
      setRows(data.rows);
    } catch (err: any) {
      setError(err.message || 'Could not read that file.');
    } finally {
      setPreviewing(false);
    }
  }

  async function confirmImport() {
    if (!rows) return;
    setImporting(true); setError('');
    const blockingStatus = entity === 'suppliers' ? 'missing_name' : 'missing_required';
    const importable = rows.filter((row) => row.status !== blockingStatus).map((row) => row.data);
    try {
      const response = await fetch(`/api/admin/${entity}/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: importable })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import failed.');
      setResult(data);
      setRows(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setOpen(false); setRows(null); setError(''); setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>{label}</button>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,35,63,0.45)', zIndex: 49, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }} onClick={(e) => { if (e.target === e.currentTarget && !previewing && !importing) reset(); }}>
    <div className="card" style={{ zIndex: 50, padding: 20, width: 560, maxWidth: '90vw', maxHeight: '78vh', overflowY: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>{label}</h3>
      {!rows && !result && (
        <>
          <p style={{ fontSize: 12.5, color: '#756e5c' }}>Upload a .xlsx file. The header row's column names are matched automatically (e.g. "Name", "Company", "Phone"{entity === 'suppliers' ? ', "Categories"' : ', "Place"'}).</p>
          <input ref={inputRef} type="file" accept=".xlsx" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFileChosen(file); }} disabled={previewing} />
          {previewing && <p role="status">Reading file...</p>}
        </>
      )}
      {error && <p role="alert" style={{ color: '#a3372c' }}>{error}</p>}
      {rows && (
        <>
          <p style={{ fontSize: 12.5 }}>{rows.length} row{rows.length === 1 ? '' : 's'} found. Review below, then confirm.</p>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6 }}>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead><tr><th style={{ textAlign: 'left', padding: 6 }}>Row</th><th style={{ textAlign: 'left', padding: 6 }}>Status</th></tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: 6 }}>{row.data.name || row.data.company || `Row ${i + 1}`}</td>
                    <td style={{ padding: 6, color: row.status === 'valid' ? '#217a34' : '#9C7A25' }}>
                      {STATUS_LABEL[row.status] || row.status}
                      {row.unmatchedCategories?.length ? ` (${row.unmatchedCategories.join(', ')})` : ''}
                      {row.unmatchedPlace ? ` (${row.unmatchedPlace})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-form-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={confirmImport} disabled={importing}>{importing ? 'Importing...' : 'Confirm import'}</button>
            <button type="button" className="btn-ghost" onClick={reset} disabled={importing}>Cancel</button>
          </div>
        </>
      )}
      {result && (
        <>
          <p role="status">Imported {result.created} row{result.created === 1 ? '' : 's'}{result.skipped ? `, skipped ${result.skipped}` : ''}.</p>
          <button type="button" className="btn" onClick={reset}>Done</button>
        </>
      )}
      {!rows && !result && <div className="admin-form-actions" style={{ marginTop: 12 }}><button type="button" className="btn-ghost" onClick={reset}>Cancel</button></div>}
    </div>
    </div>
  );
}
