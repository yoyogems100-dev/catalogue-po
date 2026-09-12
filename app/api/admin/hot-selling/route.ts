import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
const tables = {color:'colors',shape:'shapes',size:'shape_sizes',tag:'tags'} as const;
export async function PUT(req:NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({error:'Unauthorized'},{status:401});
  let body; try {body = await req.json();} catch {return NextResponse.json({error:'Invalid JSON'},{status:400});}
  if (!body || !Object.hasOwn(tables,body.kind) || !Number.isSafeInteger(body.id) || body.id <= 0 || typeof body.enabled !== 'boolean') return NextResponse.json({error:'Invalid option'},{status:400});
  const kind = body.kind as keyof typeof tables;
  const {data,error:lookupError} = await supabaseAdmin.from(tables[kind]).select('id').eq('id',body.id).maybeSingle();
  if(lookupError) return NextResponse.json({error:'Option lookup failed'},{status:503});
  if(!data) return NextResponse.json({error:'Option not found'},{status:404});
  const result = body.enabled ? await supabaseAdmin.from('hot_selling_options').upsert({kind,option_id:body.id}) : await supabaseAdmin.from('hot_selling_options').delete().eq('kind',kind).eq('option_id',body.id);
  if(result.error) return NextResponse.json({error:'Flag save failed'},{status:503});
  return NextResponse.json({ok:true});
}
