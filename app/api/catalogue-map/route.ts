import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { loadCatalogueMap } from '@/lib/catalogue-map';
import { cachedCatalogue } from '@/lib/catalogue-cache';

// Every category's colours, shapes and sizes plus the materials above them --
// what Quick Order needs to answer "which stones come in this colour and
// size?". Catalogue data only, read with the public client. Built once and
// cached: any admin save expires the `catalogue` tag, which refreshes this
// response too; the hour is only a backstop.
export const revalidate = 3600;

const load = cachedCatalogue(() => loadCatalogueMap(supabasePublic), ['catalogue-map']);

export async function GET() {
  return NextResponse.json(await load());
}
