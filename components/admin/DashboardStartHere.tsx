'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

// The jobs done most often, first on the Overview: open a category to change
// it (the category workspace is the most-visited admin page), upload photos,
// and look at what buyers see. Choosing a category goes straight to it, with
// no stop at the category list.

type Category = { id: number; name: string };

export default function DashboardStartHere({ categories }: { categories: Category[] }) {
  const router = useRouter();
  return (
    <section className="start-here" aria-label="Start here">
      <div className="start-card start-card-wide">
        <label htmlFor="start-category">Edit a category</label>
        <select
          id="start-category"
          defaultValue=""
          onChange={(e) => { if (e.target.value) router.push(`/admin/categories/${e.target.value}`); }}
        >
          <option value="" disabled>Choose a category to open…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="start-hint">Opens its photos, shapes, colours and prices. <Link href="/admin/categories">All categories →</Link></p>
      </div>
      <a className="start-card start-link" href="#quick-upload">
        <strong>Upload photos</strong><span>Into any category, or file them later</span>
      </a>
      <a className="start-card start-link" href="/po" target="_blank" rel="noopener">
        <strong>View catalogue ↗</strong><span>/po as buyers see it</span>
      </a>
      <a className="start-card start-link" href="/" target="_blank" rel="noopener">
        <strong>View website ↗</strong><span>yoyogems.co.in</span>
      </a>
      <Link className="start-card start-link" href="/admin/orders">
        <strong>Orders</strong><span>Prices, status, payment, PDFs</span>
      </Link>
    </section>
  );
}
