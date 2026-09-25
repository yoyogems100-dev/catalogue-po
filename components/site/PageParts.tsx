import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PublicImage } from '@/lib/site/public';
import { Arrow, WhatsApp } from './icons';
import s from './site.module.css';
import c from './category.module.css';
import p from './pages.module.css';

// Pieces shared by the standalone pages (About, Charts, Quality, ...).

export function Crumbs({ trail }: { trail: { name: string; href?: string }[] }) {
  return (
    <nav className={`${s.wrap} ${c.crumbs}`} aria-label="Breadcrumb">
      <ol>
        {trail.map((t, i) => (
          <li key={i}>{t.href && i < trail.length - 1 ? <Link href={t.href}>{t.name}</Link> : <span aria-current="page">{t.name}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHead({ eyebrow, title, intro, image, children }: {
  eyebrow?: string; title: string; intro?: string; image?: PublicImage | null; children?: ReactNode;
}) {
  return (
    <header className={`${c.hero} ${p.head}`}>
      <div className={`${s.wrap} ${image ? p.headGrid : ''}`}>
        <div>
          {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
          <h1 className={c.title}>{title}</h1>
          {intro && <p className={p.intro}>{intro}</p>}
          {children}
        </div>
        {image && (
          <div className={p.headImg}>
            <img src={image.src} srcSet={image.srcSet} sizes="(min-width: 900px) 50vw, 100vw" alt={image.alt} width={image.width} height={image.height} fetchPriority="high" />
          </div>
        )}
      </div>
    </header>
  );
}

export function CtaBand({ heading, text, button, whatsapp, whatsappLabel = 'WhatsApp' }: {
  heading: string; text?: string; button?: string; whatsapp?: string | null; whatsappLabel?: string;
}) {
  return (
    <section className={s.section} aria-label={heading}>
      <div className={s.wrap}>
        <div className={s.band}>
          <h2>{heading}</h2>
          {text && <p>{text}</p>}
          <div className={s.heroActions} style={{ justifyContent: 'center' }}>
            <Link href="/request-catalogue" className={s.btn}>{button || 'Request Catalogue'} <Arrow /></Link>
            {whatsapp && <a href={whatsapp} className={s.btnGhost} target="_blank" rel="noopener noreferrer"><WhatsApp size={18} /> {whatsappLabel}</a>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function Figure({ image, caption, className, sizes = '(min-width: 900px) 33vw, 100vw' }: { image: PublicImage; caption?: string; className?: string; sizes?: string }) {
  return (
    <figure className={`${p.figure} ${className || ''}`}>
      <img src={image.src} srcSet={image.srcSet} sizes={sizes} alt={image.alt || caption || ''} width={image.width} height={image.height} loading="lazy" decoding="async" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
