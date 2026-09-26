'use client';

import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { responsive, thumb } from '@/lib/site/optimize';

// A reference photo whose file is missing should disappear with its label,
// not leave a broken-image icon. Wraps the image and whatever belongs with it.
// Pictures are served resized: a fixed width means a thumbnail, otherwise a
// responsive photo (pass `sizes`).
export default function HideOnError({ className, children, img, as: Tag = 'div', ...rest }: {
  className?: string; children?: ReactNode; img: ImgHTMLAttributes<HTMLImageElement>; as?: 'div' | 'span'; role?: string; title?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const src = typeof img.src === 'string' ? img.src : '';
  const sized = img.srcSet || !src ? {} : typeof img.width === 'number' ? thumb(src, img.width) : responsive(src);
  return (
    <Tag className={className} {...rest}>
      <img {...img} {...sized} alt={img.alt ?? ''} onError={() => setFailed(true)} ref={(el) => { if (el && el.complete && el.naturalWidth === 0 && el.src) setFailed(true); }} />
      {children}
    </Tag>
  );
}
