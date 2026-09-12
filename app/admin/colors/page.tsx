import { ColorsWorkspace } from './ColorsWorkspace';
export const dynamic = 'force-dynamic';
export default async function ColorsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const query = await searchParams;
  return <ColorsWorkspace initialCategoryId={Number(query.category) || undefined} />;
}
