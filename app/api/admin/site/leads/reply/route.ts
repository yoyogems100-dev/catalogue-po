import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, readJson, requireAdmin } from '@/lib/site/api';
import { cleanReply } from '@/lib/site/leads';

/** Save the catalogue link and the WhatsApp reply used by "Reply on WhatsApp". */
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const result = cleanReply(await readJson(req));
  if ('error' in result) return fail(result.error);
  const { error } = await supabaseAdmin.from('site_private_settings')
    .upsert({ key: 'lead_reply', value: result.value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ reply: result.value });
}
