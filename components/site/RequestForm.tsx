'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChoiceGroup } from '@/lib/site/lead-choices';
import { Arrow, WhatsApp } from './icons';
import s from './site.module.css';
import p from './pages.module.css';

type Copy = { button: string; privacy: string; requirement_hint: string; thanksHeading: string; thanksText: string; whatsappLabel: string };

// The Request Catalogue form. Five fields; the WhatsApp number is required
// because that is where the catalogue is sent. A hidden "website" field and
// the time taken to fill the form catch most bots without a captcha.
export default function RequestForm({ groups, copy, whatsapp }: { groups: ChoiceGroup[]; copy: Copy; whatsapp: string | null }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const started = useRef(0);
  const source = useRef<string | null>(null);
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    started.current = Date.now();
    // Arriving from a category page ("?category=cz/white-cz") ticks it.
    const wanted = new URLSearchParams(window.location.search).get('category');
    if (wanted) {
      const [top, sub] = wanted.split('/');
      const g = groups.find((x) => x.slug === top);
      const child = sub ? g?.children.find((c) => c.slug === sub) : null;
      if (g) setPicked(child ? [g.id, child.id] : [g.id]);
      source.current = `/products/${wanted}`;
    } else if (document.referrer.startsWith(window.location.origin)) {
      source.current = new URL(document.referrer).pathname;
    }
  }, [groups]);

  useEffect(() => { if (state === 'done') thanksRef.current?.focus(); }, [state]);

  const toggle = (id: number, group?: ChoiceGroup) => setPicked((cur) => {
    if (cur.includes(id)) {
      // Unticking a main category also unticks its sub-categories.
      const drop = new Set([id, ...(group?.children.map((c) => c.id) ?? [])]);
      return cur.filter((x) => !drop.has(x));
    }
    return [...cur, id];
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'sending') return;
    const f = new FormData(e.currentTarget);
    setState('sending'); setError(null);
    try {
      const res = await fetch('/api/site/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.get('name'), business_city: f.get('business_city'), whatsapp: f.get('whatsapp'),
          monthly_requirement: f.get('monthly_requirement'), company_website: f.get('company_website'),
          category_ids: picked, started_at: started.current, source_path: source.current
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ text: data.error || 'We could not send your request. Please try again or message us on WhatsApp.', field: data.field });
        setState('idle');
        if (data.field) (formRef.current?.elements.namedItem(data.field) as HTMLElement | null)?.focus();
        return;
      }
      setState('done');
    } catch {
      setError({ text: 'No connection. Check your internet and try again, or message us on WhatsApp.' });
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className={`${p.formPanel} ${p.thanks}`} role="status">
        <span className={p.thanksTick} aria-hidden="true">✓</span>
        <h2 ref={thanksRef} tabIndex={-1}>{copy.thanksHeading}</h2>
        <p>{copy.thanksText}</p>
        {whatsapp && <a href={whatsapp} className={s.btnGhost} target="_blank" rel="noopener noreferrer"><WhatsApp size={18} /> {copy.whatsappLabel}</a>}
      </div>
    );
  }

  const invalid = (name: string) => (error?.field === name ? { 'aria-invalid': true, 'aria-describedby': 'form-error' } : {});

  return (
    <form ref={formRef} className={p.formPanel} onSubmit={submit}>
      <div className={p.formField}>
        <label htmlFor="rq-name">Name</label>
        <input id="rq-name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={80} {...invalid('name')} />
      </div>
      <div className={p.formField}>
        <label htmlFor="rq-business">Business name &amp; city</label>
        <input id="rq-business" name="business_city" type="text" autoComplete="organization" required minLength={2} maxLength={120} placeholder="e.g. Shree Jewels, Surat" {...invalid('business_city')} />
      </div>
      <div className={p.formField}>
        <label htmlFor="rq-wa">WhatsApp number</label>
        <input id="rq-wa" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} placeholder="98765 43210" aria-describedby="rq-wa-help" {...invalid('whatsapp')} />
        <small id="rq-wa-help">Outside India? Start with + and your country code.</small>
      </div>
      <fieldset className={p.formField}>
        <legend>Categories of interest <span>(tick any)</span></legend>
        <div className={p.pickList}>
          {groups.map((g) => (
            <label key={g.id} className={p.pick}>
              <input type="checkbox" checked={picked.includes(g.id)} onChange={() => toggle(g.id, g)} />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
        {groups.filter((g) => picked.includes(g.id) && g.children.length).map((g) => (
          <div key={g.id} className={p.pickSub}>
            <span className={p.pickSubHead}>{g.name}: anything specific? <span>(optional)</span></span>
            <div className={p.pickList}>
              {g.children.map((c) => (
                <label key={c.id} className={`${p.pick} ${p.pickSmall}`}>
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <div className={p.formField}>
        <label htmlFor="rq-req">Approx. monthly requirement <span>(optional)</span></label>
        <input id="rq-req" name="monthly_requirement" type="text" maxLength={300} aria-describedby="rq-req-help" />
        {copy.requirement_hint && <small id="rq-req-help">{copy.requirement_hint}</small>}
      </div>
      {/* Left empty by people; bots fill it in. */}
      <div className={p.trap} aria-hidden="true">
        <label htmlFor="rq-site">Website</label>
        <input id="rq-site" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {error && <p id="form-error" className={p.formError} role="alert">{error.text}</p>}
      <button type="submit" className={`${s.btn} ${p.formSubmit}`} disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : <>{copy.button} <Arrow /></>}
      </button>
      {copy.privacy && <p className={p.formSmall}>{copy.privacy}</p>}
    </form>
  );
}
