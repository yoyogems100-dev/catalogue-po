'use client';

import { useState } from 'react';

export default function BrandUploadPage() {
  const [status, setStatus] = useState('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Uploading...');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/brand/upload-logo', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) {
      setStatus('Uploaded and processed. Refresh the public site to see it -- no redeploy needed.');
    } else {
      setStatus('Error: ' + data.error);
    }
  }

  return (
    <>
      <h1>Brand Logo Upload</h1>
      <p style={{ fontSize: 13, color: '#8a8370', marginBottom: 18 }}>
        Upload any version of the logo -- even on a plain white background. It's automatically background-removed
        and a pure-white cutout is generated for the dark header bar. Re-uploading replaces both instantly, no
        redeploy needed.
      </p>
      <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} />
      {status && <p style={{ marginTop: 12, fontSize: 13 }}>{status}</p>}
    </>
  );
}
