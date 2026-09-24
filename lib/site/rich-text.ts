// The owner edits formatted text in a small editor (bold, italic, bullet list,
// link). What reaches the database -- and later the public page through
// dangerouslySetInnerHTML -- is only ever the output of sanitizeRichText, so
// the stored value can never carry a script, style, event handler or any tag
// outside that toolbar, whatever was pasted into the editor.

const BLOCK_TAGS = new Set(['p', 'ul', 'li']);
const INLINE_TAGS: Record<string, string> = { b: 'strong', strong: 'strong', i: 'em', em: 'em', a: 'a', br: 'br' };
// Content inside these is dropped entirely, not just the tags around it.
const DROP_WITH_CONTENT = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'noscript', 'svg', 'math', 'head', 'title', 'textarea', 'select']);

function escapeText(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Only http(s), mailto, tel, WhatsApp and same-site paths survive as links. */
export function safeHref(raw: string): string | null {
  const href = decodeEntities(raw).trim().replace(/[\u0000-\u001f\s]+/g, '');
  if (/^\/(?!\/)/.test(href) || /^#[\w-]*$/.test(href)) return href;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  return null;
}

type Token = { kind: 'open' | 'close' | 'self'; tag: string; attrs: string } | { kind: 'text'; text: string };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[3] !== undefined) { tokens.push({ kind: 'text', text: decodeEntities(m[3]) }); continue; }
    if (m[1] === undefined) { tokens.push({ kind: 'text', text: '<' }); continue; }
    const tag = m[1].toLowerCase();
    const closing = m[0].startsWith('</');
    tokens.push({ kind: closing ? 'close' : /\/\s*>$/.test(m[0]) || tag === 'br' ? 'self' : 'open', tag, attrs: m[2] || '' });
  }
  return tokens;
}

/**
 * Reduce arbitrary HTML (typically from a contenteditable editor or a paste
 * from Word/Google Docs) to the allowed subset: <p>, <ul>/<li>, <strong>,
 * <em>, <a href>, <br>. Headings and divs become paragraphs; anything else is
 * unwrapped to its text.
 */
export function sanitizeRichText(html: string): string {
  if (!html) return '';
  const out: string[] = [];
  const stack: string[] = [];
  let dropDepth = 0;
  let dropTag = '';

  const inBlock = () => stack.some((t) => t === 'p' || t === 'li');
  const openParagraphIfNeeded = () => {
    if (!inBlock() && !stack.includes('ul')) { out.push('<p>'); stack.push('p'); }
  };
  const closeTo = (tag: string) => {
    const i = stack.lastIndexOf(tag);
    if (i < 0) return;
    while (stack.length > i) out.push(`</${stack.pop()}>`);
  };

  for (const tok of tokenize(html)) {
    if (dropDepth) {
      if (tok.kind === 'open' && tok.tag === dropTag) dropDepth++;
      if (tok.kind === 'close' && tok.tag === dropTag) dropDepth--;
      continue;
    }
    if (tok.kind === 'text') {
      if (!tok.text.trim() && !inBlock()) continue;
      if (stack.includes('ul') && !stack.includes('li')) continue; // stray text between <li>s
      openParagraphIfNeeded();
      out.push(escapeText(tok.text));
      continue;
    }
    const { tag } = tok;
    if (DROP_WITH_CONTENT.has(tag)) {
      if (tok.kind === 'open') { dropDepth = 1; dropTag = tag; }
      continue;
    }
    const blockLike = /^(p|div|h[1-6]|blockquote|section|article|header|footer|pre)$/.test(tag);
    if (blockLike) {
      if (tok.kind === 'open') { if (!stack.includes('ul')) { closeTo('p'); out.push('<p>'); stack.push('p'); } }
      else closeTo('p');
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (tok.kind === 'open') { closeTo('p'); if (!stack.includes('li')) { out.push('<ul>'); stack.push('ul'); } }
      else if (tok.kind === 'close') closeTo('ul');
      continue;
    }
    if (tag === 'li') {
      if (tok.kind === 'open') {
        closeTo('li');
        if (!stack.includes('ul')) { closeTo('p'); out.push('<ul>'); stack.push('ul'); }
        out.push('<li>'); stack.push('li');
      } else if (tok.kind === 'close') closeTo('li');
      continue;
    }
    const mapped = INLINE_TAGS[tag];
    if (!mapped) continue; // unknown inline tag (span, font, u...): keep text only
    if (mapped === 'br') {
      if (inBlock()) out.push('<br>');
      continue;
    }
    if (tok.kind === 'close') { closeTo(mapped); continue; }
    if (tok.kind === 'self') continue;
    if (mapped === 'a') {
      const hrefMatch = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tok.attrs);
      const href = hrefMatch ? safeHref(hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : null;
      if (!href || stack.includes('a')) continue;
      openParagraphIfNeeded();
      const external = /^https?:\/\//i.test(href);
      out.push(`<a href="${escapeText(href).replace(/"/g, '&quot;')}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>`);
      stack.push('a');
      continue;
    }
    openParagraphIfNeeded();
    if (!stack.includes(mapped)) { out.push(`<${mapped}>`); stack.push(mapped); }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('')
    .replace(/<(strong|em|a)[^>]*>\s*<\/\1>/g, '')
    .replace(/<p>(\s|<br>)*<\/p>/g, '')
    .replace(/<li>\s*<\/li>/g, '')
    .replace(/<ul><\/ul>/g, '')
    .trim();
}

/** Plain text for meta descriptions, list previews and word counts. */
export function richTextToPlain(html: string): string {
  return decodeEntities(html.replace(/<\/(p|li)>/g, ' ').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}
