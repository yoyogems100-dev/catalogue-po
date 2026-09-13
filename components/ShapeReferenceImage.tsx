'use client';

import { useEffect, useState } from 'react';
import ShapeIcon from './ShapeIcon';

export default function ShapeReferenceImage({
  name,
  src,
  iconKey,
  className,
  fallbackSize = 28,
}: {
  name: string;
  src?: string | null;
  iconKey?: string | null;
  className?: string;
  fallbackSize?: number;
}) {
  const resolvedSrc = src || null;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <span className={`${className || ''} shape-reference-fallback`} aria-hidden="true">
        <ShapeIcon iconKey={iconKey} size={fallbackSize} />
      </span>
    );
  }

  return <img className={className} src={resolvedSrc} alt="" onError={() => setFailed(true)} />;
}
