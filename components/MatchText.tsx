import { Fragment } from 'react';

/**
 * Text with every typed search word marked in bold gold, so a scan down a
 * result list shows why each row matched. Case-insensitive; plain text when
 * nothing matches.
 */
export default function MatchText({ text, query }: { text: string; query: string }) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length || !text) return <>{text}</>;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => (i % 2 ? <mark key={i} className="match-mark">{part}</mark> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}
