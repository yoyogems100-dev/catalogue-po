import { sanitizeRichText } from '@/lib/site/rich-text';

// Stored text is already cleaned on save; cleaning again here means a row
// edited any other way still cannot put markup on a public page.
export default function RichText({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeRichText(html || '');
  if (!clean) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
