import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: recent }, { count: unreadCount }] = await Promise.all([
    supabaseAdmin.from('notifications').select('id, type, order_id, message, is_read, created_at').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
  ]);

  return NextResponse.json({ notifications: recent || [], unreadCount: unreadCount || 0 });
}
