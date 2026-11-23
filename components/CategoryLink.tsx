import Link from 'next/link';
import type { ComponentProps } from 'react';

// Categories whose page is a self-contained static catalogue in public/
// rather than a Next route. Next's in-app navigation cannot render a static
// HTML file: following the /po/category/<slug> redirect client-side shows the
// site's "Page not found". These get a plain <a> to the page itself, so the
// browser does a full page load (the middleware sign-in gate still applies).
const STATIC_CATEGORY_PAGES: Record<string, string> = {
  accessories: '/po/accessories'
};

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { slug: string };

export default function CategoryLink({ slug, prefetch, replace, scroll, shallow, locale, legacyBehavior, passHref, ...rest }: Props) {
  const staticHref = STATIC_CATEGORY_PAGES[slug];
  if (staticHref) return <a href={staticHref} {...rest} />;
  return <Link href={`/po/category/${slug}`} prefetch={prefetch} replace={replace} scroll={scroll} shallow={shallow} locale={locale} legacyBehavior={legacyBehavior} passHref={passHref} {...rest} />;
}
