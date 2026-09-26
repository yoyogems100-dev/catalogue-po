import Link from 'next/link';
import s from '@/components/site/site.module.css';

export default function NotFound() {
  return (
    <section className={s.section}>
      <div className={s.wrap} style={{ textAlign: 'center', maxWidth: 620 }}>
        <span className={s.eyebrow}>Page not found</span>
        <h1 className={s.h2}>This page isn’t here</h1>
        <p className={s.lead} style={{ margin: '0 auto 28px' }}>It may have moved. Browse our categories, or tell us what you’re looking for and we’ll point you to it.</p>
        <div className={s.heroActions} style={{ justifyContent: 'center' }}>
          <Link href="/products" className={s.btn}>Browse categories</Link>
          <Link href="/contact" className={s.btnGhost}>Contact us</Link>
        </div>
      </div>
    </section>
  );
}
