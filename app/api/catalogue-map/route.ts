import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { loadCatalogueMap } from '@/lib/catalogue-map';

// Every category's colours, shapes and sizes plus the materials above them --
// what Quick Order needs to answer "which stones come in this colour and
// size?". Catalogue data only, read with the public client.
export const revalidate = 60;

export async function GET() {
  return NextResponse.json(await loadCatalogueMap(supabasePublic));
}
