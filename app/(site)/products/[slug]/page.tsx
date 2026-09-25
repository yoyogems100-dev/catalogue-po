import { CategoryRoute, categoryMetadata } from '@/lib/site/category-route';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props) {
  return categoryMetadata(null, (await params).slug, await searchParams);
}

export default async function CategoryPage({ params, searchParams }: Props) {
  return <CategoryRoute parentSlug={null} slug={(await params).slug} search={await searchParams} />;
}
