import { thumb } from '@/lib/site/optimize';
import s from './site.module.css';

// A small stone picture beside a category name in menus and chips: the clean
// transparent cut-out /po uses, shown whole with no background; a regular
// photo is cropped to a circle instead. Decorative: the name beside it says
// what it is. A category with no picture keeps an empty slot so names line up.
export default function CatThumb({ image, size = 28 }: { image: { src: string; cutout?: boolean } | null | undefined; size?: number }) {
  if (!image) return <span className={`${s.catThumb} ${s.catThumbEmpty}`} style={{ width: size, height: size }} aria-hidden="true" />;
  return <img {...thumb(image.src, size)} alt="" width={size} height={size} className={`${s.catThumb} ${image.cutout ? s.catThumbCut : ''}`} loading="lazy" decoding="async" />;
}
