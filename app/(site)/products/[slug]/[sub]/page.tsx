import { CategoryRoute, categoryMetadata } from '@/lib/site/category-route';

type Props = { params: Promise<{ slug: string; sub: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug, sub } = await params;
  return categoryMetadata(slug, sub, await searchParams);
}

export default async function SubCategoryPage({ params, searchParams }: Props) {
  const { slug, sub } = await params;
  return <CategoryRoute parentSlug={slug} slug={sub} search={await searchParams} />;
}
