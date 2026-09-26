import type { Metadata } from 'next';
import Link from 'next/link';
import { getNavTree } from '@/lib/site/public';
import s from '@/components/site/site.module.css';
import c from '@/components/site/category.module.css';
import { pic } from '@/lib/site/optimize';
import CatThumb from '@/components/site/CatThumb';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Products — synthetic gemstones by material',
  description: 'CZ, moissanite, nano, ruby and corundum, lab-grown, polki, glass, beads and pearls, and more. Choose a material to see its shapes, sizes and colours.',
  alternates: { canonical: '/products' }
};

export default async function ProductsHub() {
  const categories = await getNavTree();
  return (
    <>
      <section className={c.hero}>
        <div className={s.wrap}>
          <h1 className={c.title} style={{ marginTop: 24 }}>Products</h1>
          <p className={c.promise}>Choose a material. Shape, size, colour and grade are filters on each page.</p>
        </div>
      </section>
      <div className={s.wrap} style={{ paddingBottom: 64 }}>
        <ul className={s.catGrid} role="list" style={{ listStyle: 'none', padding: 0, marginBottom: 48 }}>
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link href={cat.href} className={s.catTile}>
                <div className={`${s.catImg} ${cat.image?.cutout ? s.catImgCut : ''}`}>{cat.image ? <img {...pic(cat.image)} sizes="(min-width: 900px) 25vw, 50vw" alt={cat.image.alt} loading="lazy" /> : <div className={s.catImgEmpty} />}</div>
                <div className={s.catBody}><span className={s.catName}>{cat.name}</span>{cat.descriptor && <span className={s.catDesc}>{cat.descriptor}</span>}</div>
              </Link>
            </li>
          ))}
        </ul>
        {categories.filter((cat) => cat.children.length).map((cat) => (
          <section key={cat.id} className={c.hubGroup}>
            <h2><Link href={cat.href}>{cat.name}</Link></h2>
            {cat.descriptor && <p>{cat.descriptor}</p>}
            <ul className={c.hubChildren}>{cat.children.map((k) => <li key={k.id}><Link href={k.href}><CatThumb image={k.image} size={28} />{k.name}</Link></li>)}</ul>
          </section>
        ))}
      </div>
    </>
  );
}
