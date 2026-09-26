import { thumb } from '@/lib/site/optimize';
import s from './site.module.css';

type Props = { width: number; height: number; alt?: string; priority?: boolean; lazy?: boolean };

// White lockup on the dark theme, the owner's navy lockup on the light theme.
// CSS hides the other one; the light copy loads lazily so dark-theme visitors
// never download it.
export default function SiteLogo({ width, height, alt = '', priority, lazy }: Props) {
  return (
    <>
      <img {...thumb('/brand/yoyo-logo-horizontal-white.png', width)} alt={alt} width={width} height={height}
        className={`${s.logoImg} ${s.logoOnDark}`} fetchPriority={priority ? 'high' : undefined} loading={lazy ? 'lazy' : undefined} />
      <img {...thumb('/brand/yoyo-logo-horizontal-colour.png', width)} alt={alt} width={width} height={height}
        className={`${s.logoImg} ${s.logoOnLight}`} loading="lazy" />
    </>
  );
}
