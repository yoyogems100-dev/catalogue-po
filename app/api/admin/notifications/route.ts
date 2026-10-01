import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// The notification feed, newest first. ?unread=1 for unread only, ?type= for
// one kind, ?before=<id> for the next page, ?limit= up to 100.
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 20));
  const before = Number(params.get('before')) || 0;
  const type = params.get('type');

  let feed = supabaseAdmin.from('notifications').select('id, type, order_id, link, message, is_read, created_at');
  if (params.get('unread') === '1') feed = feed.eq('is_read', false);
  if (type) feed = feed.eq('type', type);
  if (before > 0) feed = feed.lt('id', before);

  const [{ data, error }, { count: unreadCount }] = await Promise.all([
    feed.order('id', { ascending: false }).limit(limit + 1),
    supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data || [];
  return NextResponse.json({ notifications: rows.slice(0, limit), hasMore: rows.length > limit, unreadCount: unreadCount || 0 });
}
