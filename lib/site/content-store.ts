import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanContent, type ContentSchema, type ContentValue } from './schema';
import { categorySchema } from './schemas';
import { pageSchemas } from './page-schemas';

// Draft/publish storage shared by pages and category pages. The owner's edits
// autosave into `draft`; the public site only ever reads `published`, which
// changes when (and only when) they press Publish.

export type Entity = 'page' | 'category';

// History is kept so an edit can be undone. Before the first autosave of an
// editing burst, the text as it stood is snapshotted; further autosaves in
// the same burst (within this window) add nothing. So every entry is a real
// earlier state, and restoring one always goes back somewhere.
const REVISION_WINDOW_MS = 5 * 60 * 1000;
const KEEP_REVISIONS = 40;

export function schemaFor(entity: Entity, key: string): ContentSchema | null {
  if (entity === 'category') return categorySchema;
  return pageSchemas[key] ?? null;
}

function locate(entity: Entity, key: string) {
  if (entity === 'category') {
    const id = Number(key);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    return { table: 'site_categories' as const, column: 'id', value: id };
  }
  if (!/^[a-z0-9_-]+$/.test(key)) return null;
  return { table: 'site_pages' as const, column: 'key', value: key };
}

export async function loadContent(entity: Entity, key: string) {
  const at = locate(entity, key);
  if (!at) return null;
  const { data } = await supabaseAdmin.from(at.table).select('draft, published, updated_at, published_at').eq(at.column, at.value).maybeSingle();
  return data as { draft: ContentValue; published: ContentValue | null; updated_at: string; published_at: string | null } | null;
}

async function prune(entity: Entity, key: string) {
  const { data: old } = await supabaseAdmin.from('site_revisions').select('id')
    .eq('entity', entity).eq('entity_key', key).order('created_at', { ascending: false }).range(KEEP_REVISIONS, KEEP_REVISIONS + 50);
  if (old?.length) await supabaseAdmin.from('site_revisions').delete().in('id', old.map((r) => r.id));
}

const isEmpty = (v: unknown) => !v || (typeof v === 'object' && Object.keys(v as object).length === 0);

export async function saveDraft(entity: Entity, key: string, raw: unknown, forceSnapshot = false) {
  const at = locate(entity, key);
  const schema = schemaFor(entity, key);
  if (!at || !schema) return { error: 'Unknown page.' } as const;
  const current = await loadContent(entity, key);
  if (!current) return { error: 'That page no longer exists.' } as const;
  const draft = cleanContent(schema, raw);
  if (JSON.stringify(draft) === JSON.stringify(current.draft)) return { draft, updated_at: current.updated_at } as const;

  const { data: latest } = await supabaseAdmin.from('site_revisions').select('created_at')
    .eq('entity', entity).eq('entity_key', key).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const burstStarted = forceSnapshot || !latest || Date.now() - new Date(latest.created_at).getTime() > REVISION_WINDOW_MS
    || Date.now() - new Date(current.updated_at).getTime() > REVISION_WINDOW_MS;
  if (burstStarted && !isEmpty(current.draft)) {
    await supabaseAdmin.from('site_revisions').insert({ entity, entity_key: key, content: current.draft, kind: 'draft' });
    await prune(entity, key);
  }

  const updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from(at.table).update({ draft, updated_at }).eq(at.column, at.value);
  if (error) return { error: error.message } as const;
  return { draft, updated_at } as const;
}

export async function publish(entity: Entity, key: string) {
  const at = locate(entity, key);
  const schema = schemaFor(entity, key);
  if (!at || !schema) return { error: 'Unknown page.' } as const;
  const current = await loadContent(entity, key);
  if (!current) return { error: 'That page no longer exists.' } as const;
  const published = cleanContent(schema, current.draft);
  const published_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from(at.table).update({ published, published_at }).eq(at.column, at.value);
  if (error) return { error: error.message } as const;
  await supabaseAdmin.from('site_revisions').insert({ entity, entity_key: key, content: published, kind: 'publish' });
  await prune(entity, key);
  return { published_at } as const;
}

export async function listRevisions(entity: Entity, key: string) {
  const { data } = await supabaseAdmin.from('site_revisions').select('id, kind, created_at')
    .eq('entity', entity).eq('entity_key', key).order('created_at', { ascending: false }).limit(KEEP_REVISIONS);
  return data || [];
}

/** Put an older version back into the draft (not live until published). */
export async function restoreRevision(entity: Entity, key: string, revisionId: number) {
  const { data: rev } = await supabaseAdmin.from('site_revisions').select('content')
    .eq('id', revisionId).eq('entity', entity).eq('entity_key', key).maybeSingle();
  if (!rev) return { error: 'That version is no longer available.' } as const;
  return saveDraft(entity, key, rev.content, true);
}
