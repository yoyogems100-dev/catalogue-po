import { CategoryRoute, categoryMetadata } from '@/lib/site/category-route';

// Rendered on first visit and cached; refreshed hourly or as soon as the
// owner edits the website (the 'site' cache tag). Filters are applied in the
// browser, so every ?shape=… variant is served from this one cached page.
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return categoryMetadata(null, (await params).slug);
}

export default async function CategoryPage({ params }: Props) {
  return <CategoryRoute parentSlug={null} slug={(await params).slug} />;
}
