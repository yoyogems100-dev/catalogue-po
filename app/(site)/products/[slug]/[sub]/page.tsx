import { CategoryRoute, categoryMetadata } from '@/lib/site/category-route';

// Rendered on first visit and cached; refreshed hourly or as soon as the
// owner edits the website (the 'site' cache tag). Filters are applied in the
// browser, so every ?shape=… variant is served from this one cached page.
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string; sub: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, sub } = await params;
  return categoryMetadata(slug, sub);
}

export default async function SubCategoryPage({ params }: Props) {
  const { slug, sub } = await params;
  return <CategoryRoute parentSlug={slug} slug={sub} />;
}
