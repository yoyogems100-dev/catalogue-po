'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TallyLine } from '@/lib/tally/types';
import {
  balanceOf, groupsFor, isBadDebt, itemsFor, matchItems, monthly, norm, orderGap, overview, periodAnswer, roleOf,
  searchParties, searchStock, voucherKind, voucherLabel, type Answer, type ItemAgg, type Lines, type TallyIndex
} from '@/lib/tally/query';
import { ago, day, month, qty, qtyByUnit, rate, rupees, rupeesShort } from '@/lib/tally/format';
import type { Go, Turn } from './TallyPortal';

/* ================= shared bits ================= */

function PartyButton({ ix, i, go, children }: { ix: TallyIndex; i: number; go: Go; children?: React.ReactNode }) {
  return <button className="tp-namelink" onClick={() => go({ party: ix.data.parties[i].name })}>{children ?? ix.data.parties[i].name}</button>;
}

function BalancePill({ ix, i }: { ix: TallyIndex; i: number }) {
  const p = ix.data.parties[i];
  const b = balanceOf(p);
  if (b.side === 'settled') return <span className="tp-pill settled">Settled</span>;
  return <span className={`tp-pill ${b.side}${isBadDebt(p) ? ' bad' : ''}`}>{b.side === 'owes-you' ? 'Owes you ' : 'You owe '}{rupeesShort(b.amount)}</span>;
}

function Bars({ rows, label }: { rows: { label: string; value: number; onClick?: () => void }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="tp-bars" role="list" aria-label={label}>
      {rows.map((r) => (
        <div className="tp-bar" role="listitem" key={r.label}>
          <span className="tp-bar-label">{r.onClick ? <button className="tp-namelink" onClick={r.onClick}>{r.label}</button> : r.label}</span>
          <span className="tp-bar-track"><span className="tp-bar-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></span>
          <span className="tp-bar-value">{rupeesShort(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** One bar per month, each labelled with its amount (no hover needed on phones). */
function MonthChart({ name, cls, data, months }: { name: string; cls: string; data: { month: string; amount: number }[]; months: string[] }) {
  if (!months.length) return null;
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <div className="tp-months" role="img" aria-label={`${name} by month: ${data.map((d) => `${month(d.month)} ${rupees(d.amount)}`).join(', ')}`}>
      <p className="tp-months-title"><i className={cls} /> {name}</p>
      <div className="tp-month-cols">
        {months.map((m) => {
          const v = data.find((d) => d.month === m)?.amount || 0;
          return (
            <div className="tp-month-col" key={m}>
              <span className="tp-month-val">{v ? rupeesShort(v).replace('₹', '') : ''}</span>
              <div className="tp-month-bars"><span className={`tp-month-bar ${cls}`} style={{ height: `${v ? Math.max(3, (v / max) * 100) : 0}%` }} /></div>
              <span className="tp-month-label">{month(m).slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void }) {
  const body = <><span className="tp-tile-label">{label}</span><span className="tp-tile-value">{value}</span>{sub && <span className="tp-tile-sub">{sub}</span>}</>;
  return onClick
    ? <button className={`tp-tile ${tone || ''}`} onClick={onClick}>{body}</button>
    : <div className={`tp-tile ${tone || ''}`}>{body}</div>;
}

function ShowMore({ total, shown, onMore }: { total: number; shown: number; onMore: () => void }) {
  if (shown >= total) return null;
  return <button className="tp-more" onClick={onMore}>Show {Math.min(total - shown, 50)} more <span>({total - shown} left)</span></button>;
}

/* lines of one voucher: key date|vno|party → line indexes, built once per dataset */
const lineMaps = new WeakMap<TallyIndex, Record<Lines, Map<string, number[]>>>();
function linesOf(ix: TallyIndex, kind: Lines, date: string, vno: string, party: number): TallyLine[] {
  let m = lineMaps.get(ix);
  if (!m) {
    const build = (rows: TallyLine[]) => {
      const map = new Map<string, number[]>();
      rows.forEach((l, i) => { const k = `${l[0]}|${l[1]}|${l[2]}`; const a = map.get(k); if (a) a.push(i); else map.set(k, [i]); });
      return map;
    };
    m = { sales: build(ix.data.sales), purchases: build(ix.data.purchases), returns: build(ix.data.returns) };
    lineMaps.set(ix, m);
  }
  return (m[kind].get(`${date}|${vno}|${party}`) || []).map((i) => ix.data[kind][i]);
}

function VoucherRow({ ix, vi, go, showParty }: { ix: TallyIndex; vi: number; go: Go; showParty?: boolean }) {
  const [open, setOpen] = useState(false);
  const v = ix.data.vouchers[vi];
  const [date, type, vno, party, , amount, stockLines, , other, narration] = v;
  const label = voucherLabel(type, stockLines, vno);
  const kind = voucherKind(type, stockLines, vno);
  const lines = open && kind ? linesOf(ix, kind, date, vno, party) : [];
  const cls = kind === 'sales' ? 'sale' : kind === 'purchases' ? 'purchase' : kind === 'returns' ? 'return' : /receipt/i.test(type) ? 'in' : 'out';
  return (
    <li className={`tp-vch ${cls}`}>
      <div className="tp-vch-main">
        <span className="tp-vch-date">{day(date)}</span>
        <span className="tp-vch-what">
          <span className={`tp-tag ${cls}`}>{label}</span>
          {showParty && <PartyButton ix={ix} i={party} go={go} />}
          {vno && <span className="tp-dim">No. {vno}</span>}
        </span>
        <span className="tp-vch-amt">{rupees(amount)}</span>
      </div>
      {(other || narration || kind) && (
        <div className="tp-vch-extra">
          {other && <span className="tp-dim">{other}</span>}
          {narration && <span className="tp-note">“{narration}”</span>}
          {kind && <button className="tp-link" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide items' : `Show ${stockLines} item${stockLines === 1 ? '' : 's'}`}</button>}
        </div>
      )}
      {open && lines.length > 0 && <LineTable ix={ix} lines={lines} go={go} />}
    </li>
  );
}

function LineTable({ ix, lines, go, showParty, showDate }: { ix: TallyIndex; lines: TallyLine[]; go: Go; showParty?: boolean; showDate?: boolean }) {
  return (
    <div className="tp-lines">
      {lines.map((l, i) => (
        <div className="tp-line" key={i}>
          {showDate && <span className="tp-dim">{day(l[0])}</span>}
          <button className="tp-namelink tp-line-item" onClick={() => go({ item: ix.data.items[l[3]] })}>{ix.data.items[l[3]]}</button>
          {showParty && <PartyButton ix={ix} i={l[2]} go={go} />}
          <span className="tp-line-nums">{qty(l[4], l[5])} × {rate(l[6])} = <strong>{rupees(l[7])}</strong></span>
        </div>
      ))}
    </div>
  );
}

/* ================= Ask ================= */

const SUGGESTIONS = [
  'Who owes me money?',
  'Top customers',
  'What does Sorabh buy?',
  'Who buys nano ps?',
  'Who supplies mozonite?',
  'Sales last month',
  'Customers who have gone quiet',
  'Stock of pearl 4.0',
  'Bad debts',
  'Goods returns',
  'Bank and cash'
];

type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };

function useSpeech(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript; if (t) onText(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }
  return { supported, listening, toggle };
}

export function AskTab({ ix, thread, onAsk, go, onClear }: { ix: TallyIndex; thread: Turn[]; onAsk: (q: string) => void; go: Go; onClear: () => void }) {
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const speech = useSpeech((t) => { setQ(t); onAsk(t); });
  const o = useMemo(() => overview(ix), [ix]);

  // Live name suggestions while typing.
  const live = useMemo(() => (q.trim().length >= 2 ? searchParties(ix, q, 5) : []), [ix, q]);

  function submit(e: React.FormEvent) { e.preventDefault(); onAsk(q); setQ(''); input.current?.blur(); }

  return (
    <section className="tp-ask">
      <form className="tp-askbox" onSubmit={submit} role="search">
        <svg className="tp-askicon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name or ask a question…" aria-label="Ask a question about your Tally data" enterKeyHint="search" />
        {speech.supported && (
          <button type="button" className={`tp-mic${speech.listening ? ' on' : ''}`} onClick={speech.toggle} aria-label={speech.listening ? 'Stop listening' : 'Ask by voice'} title="Ask by voice">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
        )}
        <button className="btn tp-askgo" disabled={!q.trim()}>Ask</button>
      </form>
      {live.length > 0 && (
        <div className="tp-live" aria-label="Matching names">
          {live.map((i) => (
            <button key={i} onClick={() => { setQ(''); go({ party: ix.data.parties[i].name }); }}>
              <span>{ix.data.parties[i].name}</span><BalancePill ix={ix} i={i} />
            </button>
          ))}
        </div>
      )}
      {speech.listening && <p className="tp-listening">Listening… speak your question</p>}

      <div className="tp-chips" aria-label="Try asking">
        {SUGGESTIONS.map((s) => <button key={s} onClick={() => onAsk(s)}>{s}</button>)}
      </div>

      {thread.length === 0 ? (
        <>
          <div className="tp-tiles">
            <Tile label="Customers owe you" value={rupeesShort(o.owedToYou)} sub="Tap to see who" tone="owes-you" onClick={() => onAsk('Who owes me money?')} />
            <Tile label="You owe" value={rupeesShort(o.youOwe)} sub="Tap to see who" tone="you-owe" onClick={() => onAsk('Who do I owe?')} />
            <Tile label="Bad debts" value={rupeesShort(o.badDebt)} sub="Still unpaid" tone="bad" onClick={() => onAsk('Bad debts')} />
            <Tile label="Goods sold" value={rupeesShort(o.sales)} sub={o.returns ? `+ ${rupeesShort(o.returns)} goods returns (GR)` : 'This period'} onClick={() => onAsk('Top customers')} />
            <Tile label="Goods bought" value={rupeesShort(o.purchases)} sub="This period" onClick={() => onAsk('Top suppliers')} />
            <Tile label="Stock value" value={rupeesShort(o.stockValue)} sub="Closing stock" onClick={() => go({ tab: 'items' })} />
          </div>
          <Recent ix={ix} go={go} />
        </>
      ) : (
        <div className="tp-thread">
          <div className="tp-thread-head"><span>Your questions</span><button className="tp-link" onClick={onClear}>Clear</button></div>
          {thread.map((t, n) => <AnswerCard key={t.id} ix={ix} q={t.q} a={t.a} go={go} onAsk={onAsk} fresh={n === 0} />)}
        </div>
      )}
    </section>
  );
}

function Recent({ ix, go }: { ix: TallyIndex; go: Go }) {
  const [n, setN] = useState(8);
  const recent = useMemo(() => ix.data.vouchers.map((_, i) => i).sort((a, b) => (ix.data.vouchers[b][0] > ix.data.vouchers[a][0] ? 1 : ix.data.vouchers[b][0] < ix.data.vouchers[a][0] ? -1 : b - a)), [ix]);
  return (
    <section className="tp-card">
      <h2>Latest entries in Tally</h2>
      <ul className="tp-vchs">{recent.slice(0, n).map((vi) => <VoucherRow key={vi} ix={ix} vi={vi} go={go} showParty />)}</ul>
      <ShowMore total={recent.length} shown={n} onMore={() => setN(n + 50)} />
    </section>
  );
}

function AnswerCard({ ix, q, a, go, onAsk, fresh }: { ix: TallyIndex; q: string; a: Answer; go: Go; onAsk: (q: string) => void; fresh: boolean }) {
  const [n, setN] = useState(15);
  const parties = ix.data.parties;
  return (
    <article className={`tp-answer${fresh ? ' fresh' : ''}`}>
      <p className="tp-q">“{q}”</p>
      <h2>{a.title}</h2>
      <p className="tp-summary">{a.summary}</p>

      {a.kind === 'party' && (
        <>
          <PartySnapshot ix={ix} i={a.party} go={go} />
          {a.others.length > 0 && (
            <div className="tp-didyou"><span>Did you mean:</span>{a.others.map((o) => <button key={o} onClick={() => go({ party: parties[o].name })}>{parties[o].name}</button>)}</div>
          )}
        </>
      )}

      {a.kind === 'parties' && (
        <>
          <ol className="tp-rank">
            {a.rows.slice(0, n).map((r, k) => (
              <li key={r.party}>
                <span className="tp-rank-n">{k + 1}</span>
                <span className="tp-rank-name"><PartyButton ix={ix} i={r.party} go={go} /><span className="tp-dim">{[parties[r.party].group, r.note].filter(Boolean).join(' · ')}</span></span>
                <span className={`tp-rank-val ${a.tone || ''}`}>{rupees(r.value)}</span>
              </li>
            ))}
          </ol>
          <ShowMore total={a.rows.length} shown={n} onMore={() => setN(n + 50)} />
        </>
      )}

      {a.kind === 'itemParties' && (
        <>
          <ol className="tp-rank">
            {a.rows.slice(0, n).map((r, k) => (
              <li key={r.party}>
                <span className="tp-rank-n">{k + 1}</span>
                <span className="tp-rank-name"><PartyButton ix={ix} i={r.party} go={go} />
                  <span className="tp-dim">{r.times} time{r.times === 1 ? '' : 's'} · {qtyByUnit(r.qty)} · last {day(r.last)} at {rate(r.lastRate)}</span></span>
                <span className="tp-rank-val">{rupees(r.amount)}</span>
              </li>
            ))}
          </ol>
          <ShowMore total={a.rows.length} shown={n} onMore={() => setN(n + 50)} />
          <button className="btn-ghost tp-open" onClick={() => go({ item: a.query })}>See full item details, rates and stock →</button>
        </>
      )}

      {a.kind === 'stock' && <StockList ix={ix} rows={a.rows} go={go} />}

      {a.kind === 'period' && <PeriodView ix={ix} a={a} go={go} />}

      {a.kind === 'ledgers' && (
        <ol className="tp-rank">
          {a.rows.map((li) => { const l = ix.data.ledgers[li]; return (
            <li key={li}><span className="tp-rank-name"><strong>{l[0]}</strong><span className="tp-dim">{l[1]}</span></span>
              <span className="tp-rank-val">{rupees(l[3])} {l[4]}</span></li>
          ); })}
        </ol>
      )}

      {a.kind === 'search' && (
        <>
          {a.parties.length > 0 && <><h3>People</h3><ol className="tp-rank">{a.parties.map((i) => (
            <li key={i}><span className="tp-rank-name"><PartyButton ix={ix} i={i} go={go} /><span className="tp-dim">{roleOf(ix, i)} · {parties[i].group}</span></span><BalancePill ix={ix} i={i} /></li>
          ))}</ol></>}
          {a.stock.length > 0 && <><h3>Stock items</h3><StockList ix={ix} rows={a.stock} go={go} /></>}
          {a.vouchers.length > 0 && <><h3>Entries</h3><ul className="tp-vchs">{a.vouchers.map((vi) => <VoucherRow key={vi} ix={ix} vi={vi} go={go} showParty />)}</ul></>}
          {!a.parties.length && !a.stock.length && !a.vouchers.length && (
            <div className="tp-chips">{SUGGESTIONS.slice(0, 5).map((s) => <button key={s} onClick={() => onAsk(s)}>{s}</button>)}</div>
          )}
        </>
      )}
    </article>
  );
}

function PeriodView({ ix, a, go }: { ix: TallyIndex; a: Extract<Answer, { kind: 'period' }>; go: Go }) {
  const [n, setN] = useState(10);
  return (
    <>
      <div className="tp-tiles small">
        <Tile label="Goods sold" value={rupeesShort(a.sales)} />
        <Tile label="Goods bought" value={rupeesShort(a.purchases)} sub={a.returns ? `${rupeesShort(a.returns)} returned (GR)` : undefined} />
        <Tile label="Money received" value={rupeesShort(a.received)} tone="owes-you" />
        <Tile label="Money paid" value={rupeesShort(a.paid)} tone="you-owe" />
      </div>
      {a.topCustomers.length > 0 && <><h3>Who bought</h3><Bars label="Who bought" rows={a.topCustomers.map((r) => ({ label: ix.data.parties[r.party].name, value: r.value, onClick: () => go({ party: ix.data.parties[r.party].name }) }))} /></>}
      {a.vouchers.length > 0 && <><h3>Entries</h3><ul className="tp-vchs">{a.vouchers.slice(0, n).map((vi) => <VoucherRow key={vi} ix={ix} vi={vi} go={go} showParty />)}</ul>
        <ShowMore total={a.vouchers.length} shown={n} onMore={() => setN(n + 50)} /></>}
    </>
  );
}

function StockList({ ix, rows, go }: { ix: TallyIndex; rows: number[]; go: Go }) {
  const [n, setN] = useState(20);
  return (
    <>
      <ul className="tp-stock">
        {rows.slice(0, n).map((si) => {
          const s = ix.data.stock[si];
          return (
            <li key={si}>
              <button className="tp-namelink" onClick={() => go({ item: s[0] })}>{s[0]}</button>
              <span className="tp-dim">{s[1]}</span>
              <span className="tp-stock-nums"><strong>{qty(s[5], s[2])}</strong> in stock · {rupees(s[6])}</span>
              <span className="tp-dim">{s[10] ? `Last bought ${day(s[10])} at ${rate(s[9])}` : 'Not bought this year'}{s[14] ? ` · last sold ${day(s[14])} at ${rate(s[13])}` : ''}</span>
            </li>
          );
        })}
      </ul>
      <ShowMore total={rows.length} shown={n} onMore={() => setN(n + 50)} />
    </>
  );
}

/* ================= a customer / supplier ================= */

function PartySnapshot({ ix, i, go }: { ix: TallyIndex; i: number; go: Go }) {
  const a = ix.agg[i];
  const items = useMemo(() => itemsFor(ix, a.sales.length ? a.sales : a.purchases, a.sales.length ? 'sales' : 'purchases').slice(0, 5), [ix, a]);
  return (
    <div className="tp-snap">
      <BalanceHero ix={ix} i={i} />
      {items.length > 0 && (
        <>
          <h3>{a.sales.length ? 'What they usually buy from you' : 'What you buy from them'}</h3>
          <ItemTable ix={ix} rows={items} go={go} />
        </>
      )}
      <button className="btn tp-open" onClick={() => go({ party: ix.data.parties[i].name })}>Open full profile — orders, payments, month by month →</button>
    </div>
  );
}

function BalanceHero({ ix, i }: { ix: TallyIndex; i: number }) {
  const p = ix.data.parties[i];
  const b = balanceOf(p);
  const op = balanceOf({ closing: p.opening, closingType: p.openingType });
  return (
    <div className={`tp-hero ${b.side}${isBadDebt(p) ? ' bad' : ''}`}>
      <span className="tp-hero-label">{b.side === 'owes-you' ? 'They owe you' : b.side === 'you-owe' ? 'You owe them' : 'Balance'}</span>
      <span className="tp-hero-amt">{b.side === 'settled' ? 'Settled' : rupees(b.amount)}</span>
      <span className="tp-hero-sub">
        {isBadDebt(p) ? 'Marked as bad debt in Tally · ' : ''}
        On {day(ix.data.meta.firstDate)}: {op.side === 'settled' ? 'settled' : `${op.side === 'owes-you' ? 'they owed you' : 'you owed them'} ${rupees(op.amount)}`}
      </span>
    </div>
  );
}

function ItemTable({ ix, rows, go }: { ix: TallyIndex; rows: ItemAgg[]; go: Go }) {
  return (
    <div className="tp-itable" role="table" aria-label="Items">
      <div className="tp-irow head" role="row"><span role="columnheader">Item</span><span role="columnheader">Times</span><span role="columnheader">Total qty</span><span role="columnheader">Last rate</span><span role="columnheader">Last time</span><span role="columnheader">Value</span></div>
      {rows.map((r) => (
        <div className="tp-irow" role="row" key={r.item}>
          <span role="cell" className="tp-irow-name"><button className="tp-namelink" onClick={() => go({ item: ix.data.items[r.item] })}>{ix.data.items[r.item]}</button>{ix.itemGroup[r.item] && <em>{ix.itemGroup[r.item]}</em>}</span>
          <span role="cell" data-label="Times">{r.times}×</span>
          <span role="cell" data-label="Qty">{qtyByUnit(r.qty)}</span>
          <span role="cell" data-label="Last rate">{rate(r.lastRate)}</span>
          <span role="cell" data-label="Last">{day(r.last)}</span>
          <span role="cell" data-label="Value"><strong>{rupees(r.amount)}</strong></span>
        </div>
      ))}
    </div>
  );
}

export function PartyView({ ix, name, go }: { ix: TallyIndex; name: string; go: Go }) {
  const i = useMemo(() => ix.data.parties.findIndex((p) => p.name === name), [ix, name]);
  const [itemQ, setItemQ] = useState('');
  const [itemN, setItemN] = useState(12);
  const [filter, setFilter] = useState<'all' | 'sale' | 'purchase' | 'return' | 'money'>('all');
  const [vn, setVn] = useState(20);

  const data = useMemo(() => {
    if (i < 0) return null;
    const a = ix.agg[i];
    return {
      a,
      buys: itemsFor(ix, a.sales, 'sales'),
      sells: itemsFor(ix, a.purchases, 'purchases'),
      groups: groupsFor(ix, a.sales, 'sales'),
      returned: itemsFor(ix, a.returns, 'returns'),
      salesMonths: monthly(ix, a.sales, 'sales'),
      purchMonths: monthly(ix, a.purchases, 'purchases'),
      gap: orderGap(a.sales.map((li) => ({ date: ix.data.sales[li][0], vno: '', party: i, lines: [], amount: 0 }))),
      vouchers: [...a.vouchers].sort((x, y) => (ix.data.vouchers[y][0] > ix.data.vouchers[x][0] ? 1 : ix.data.vouchers[y][0] < ix.data.vouchers[x][0] ? -1 : y - x))
    };
  }, [ix, i]);

  if (i < 0 || !data) return <section className="tp-card"><p>“{name}” is not in this Tally data.</p><button className="btn-ghost" onClick={() => go({ tab: 'customers' })}>See everyone</button></section>;

  const p = ix.data.parties[i];
  const { a } = data;
  const role = roleOf(ix, i);
  const primary = a.sales.length ? data.buys : data.sells;
  const q = norm(itemQ);
  const shownItems = q ? primary.filter((r) => norm(ix.data.items[r.item]).includes(q)) : primary;
  const vouchers = data.vouchers.filter((vi) => {
    const v = ix.data.vouchers[vi];
    if (filter === 'all') return true;
    if (filter === 'money') return v[6] === 0;
    const k = voucherKind(v[1], v[6], v[2]);
    return filter === 'sale' ? k === 'sales' : filter === 'return' ? k === 'returns' : k === 'purchases';
  });

  return (
    <section className="tp-party">
      <button className="tp-back" onClick={() => history.length > 1 ? history.back() : go({ tab: 'customers' })}>← Back</button>
      <header className="tp-party-head">
        <h2>{p.name}</h2>
        <p><span className="tp-tag">{role}</span> {p.group}{p.state ? ` · ${p.state}` : ''}{p.address ? ` · ${p.address}` : ''}</p>
      </header>

      <BalanceHero ix={ix} i={i} />

      <div className="tp-tiles small">
        {(a.sales.length > 0 || !a.purchases.length) && <>
          <Tile label="Bought from you" value={rupeesShort(a.salesAmt)} sub={`${a.orders} order${a.orders === 1 ? '' : 's'}`} />
          <Tile label="Last order" value={a.lastSale ? day(a.lastSale) : '—'} sub={a.lastSale ? ago(a.lastSale, ix.today) : 'No order this year'} />
          <Tile label="Orders every" value={data.gap ? `${data.gap} days` : '—'} sub={data.gap ? 'on average' : 'Not enough orders'} />
        </>}
        <Tile label="Paid you" value={rupeesShort(p.receivedNoStock)} sub="Money received" tone="owes-you" />
        {(a.purchAmt > 0 || p.paidNoStock > 0) && <Tile label="You bought from them" value={rupeesShort(a.purchAmt)} sub={a.lastPurchase ? `last ${day(a.lastPurchase)}` : ''} />}
        {p.paidNoStock > 0 && <Tile label="You paid them" value={rupeesShort(p.paidNoStock)} tone="you-owe" />}
        {a.returnsAmt > 0 && <Tile label="Goods returns (GR)" value={rupeesShort(a.returnsAmt)} sub="Not counted as sales" />}
      </div>

      {primary.length > 0 && (
        <section className="tp-card">
          <div className="tp-card-head">
            <h3>{a.sales.length ? 'What they usually buy' : 'What they sell you'} <span className="tp-dim">({primary.length} items)</span></h3>
            {primary.length > 8 && <input className="tp-mini-search" value={itemQ} onChange={(e) => setItemQ(e.target.value)} placeholder="Filter items…" aria-label="Filter items" />}
          </div>
          <ItemTable ix={ix} rows={shownItems.slice(0, itemN)} go={go} />
          <ShowMore total={shownItems.length} shown={itemN} onMore={() => setItemN(itemN + 50)} />
        </section>
      )}

      {a.sales.length > 0 && a.purchases.length > 0 && (
        <section className="tp-card">
          <h3>What they sell you <span className="tp-dim">({data.sells.length} items)</span></h3>
          <ItemTable ix={ix} rows={data.sells.slice(0, 8)} go={go} />
        </section>
      )}

      {data.returned.length > 0 && (
        <section className="tp-card">
          <h3>Goods returned to them (GR) <span className="tp-dim">({data.returned.length} items)</span></h3>
          <p className="tp-dim" style={{ marginBottom: 6 }}>Entries whose voucher number is marked GR, like “8576(gr)”. Kept apart from sales.</p>
          <ItemTable ix={ix} rows={data.returned.slice(0, 8)} go={go} />
        </section>
      )}

      {(data.salesMonths.length > 0 || data.purchMonths.length > 0) && (
        <section className="tp-card">
          <h3>Month by month</h3>
          {(() => {
            const months = [...new Set([...data.salesMonths, ...data.purchMonths].map((d) => d.month))].sort();
            return <>
              {data.salesMonths.length > 0 && <MonthChart name="They bought from you" cls="sale" data={data.salesMonths} months={months} />}
              {data.purchMonths.length > 0 && <MonthChart name="You bought from them" cls="purchase" data={data.purchMonths} months={months} />}
            </>;
          })()}
        </section>
      )}

      {data.groups.length > 1 && (
        <section className="tp-card">
          <h3>Which kinds of stones</h3>
          <Bars label="Stone groups" rows={data.groups.slice(0, 10).map((g) => ({ label: g.group, value: g.amount }))} />
        </section>
      )}

      <section className="tp-card">
        <div className="tp-card-head">
          <h3>Orders and payments <span className="tp-dim">({data.vouchers.length})</span></h3>
          <div className="tp-seg" role="group" aria-label="Show">
            {([['all', 'All'], ['sale', 'Sales'], ['purchase', 'Purchases'], ...(a.returns.length ? [['return', 'Returns']] as const : []), ['money', 'Money']] as const).map(([k, l]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => { setFilter(k); setVn(20); }}>{l}</button>
            ))}
          </div>
        </div>
        {vouchers.length ? <ul className="tp-vchs">{vouchers.slice(0, vn).map((vi) => <VoucherRow key={vi} ix={ix} vi={vi} go={go} />)}</ul> : <p className="tp-dim">Nothing here for this period.</p>}
        <ShowMore total={vouchers.length} shown={vn} onMore={() => setVn(vn + 50)} />
      </section>
    </section>
  );
}

/* ================= an item ================= */

function itemPartyRows(ix: TallyIndex, items: Set<number>, kind: Lines) {
  const m = new Map<number, { party: number; amount: number; qty: Map<string, number>; last: string; lastRate: number; times: Set<string> }>();
  ix.data[kind].forEach((l) => {
    if (!items.has(l[3])) return;
    let r = m.get(l[2]);
    if (!r) m.set(l[2], (r = { party: l[2], amount: 0, qty: new Map(), last: '', lastRate: 0, times: new Set() }));
    r.amount += l[7]; r.qty.set(l[5], (r.qty.get(l[5]) || 0) + l[4]); r.times.add(`${l[0]}|${l[1]}`);
    if (l[0] >= r.last) { r.last = l[0]; r.lastRate = l[6]; }
  });
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}

export function ItemView({ ix, query, go }: { ix: TallyIndex; query: string; go: Go }) {
  const [n, setN] = useState(20);
  const view = useMemo(() => {
    const exact = ix.data.items.findIndex((x) => x.toLowerCase() === query.toLowerCase());
    const items = exact >= 0 ? [exact] : matchItems(ix, query);
    const set = new Set(items);
    const stockRows = exact >= 0 || !items.length
      ? ix.data.stock.map((s, si) => [s, si] as const).filter(([s]) => s[0].toLowerCase() === query.toLowerCase()).map(([, si]) => si)
      : searchStock(ix, query, 200);
    const history = [
      ...ix.data.sales.filter((l) => set.has(l[3])).map((l) => ({ l, kind: 'sales' as const })),
      ...ix.data.purchases.filter((l) => set.has(l[3])).map((l) => ({ l, kind: 'purchases' as const })),
      ...ix.data.returns.filter((l) => set.has(l[3])).map((l) => ({ l, kind: 'returns' as const }))
    ].sort((a, b) => (a.l[0] < b.l[0] ? 1 : a.l[0] > b.l[0] ? -1 : 0));
    return { items, stockRows, buyers: itemPartyRows(ix, set, 'sales'), suppliers: itemPartyRows(ix, set, 'purchases'), history };
  }, [ix, query]);

  const stockQty = new Map<string, number>();
  let stockValue = 0;
  view.stockRows.forEach((si) => { const s = ix.data.stock[si]; stockQty.set(s[2], (stockQty.get(s[2]) || 0) + s[5]); stockValue += s[6]; });

  return (
    <section className="tp-party">
      <button className="tp-back" onClick={() => history.length > 1 ? history.back() : go({ tab: 'items' })}>← Back</button>
      <header className="tp-party-head">
        <h2>{query}</h2>
        <p>{view.items.length > 1 ? `${view.items.length} matching items` : ix.itemGroup[view.items[0]] || (view.stockRows[0] !== undefined ? ix.data.stock[view.stockRows[0]][1] : '')}</p>
      </header>

      <div className="tp-tiles small">
        <Tile label="In stock now" value={view.stockRows.length ? qtyByUnit(stockQty) : '—'} sub={view.stockRows.length ? rupees(stockValue) : 'Not in the stock list'} />
        <Tile label="Customers" value={String(view.buyers.length)} sub={rupeesShort(view.buyers.reduce((t, r) => t + r.amount, 0)) + ' sold'} />
        <Tile label="Suppliers" value={String(view.suppliers.length)} sub={rupeesShort(view.suppliers.reduce((t, r) => t + r.amount, 0)) + ' bought'} />
      </div>

      {view.buyers.length > 0 && (
        <section className="tp-card"><h3>Who buys it from you</h3>
          <ol className="tp-rank">{view.buyers.map((r) => (
            <li key={r.party}><span className="tp-rank-name"><PartyButton ix={ix} i={r.party} go={go} /><span className="tp-dim">{r.times.size}× · {qtyByUnit(r.qty)} · last {day(r.last)} at {rate(r.lastRate)}</span></span><span className="tp-rank-val">{rupees(r.amount)}</span></li>
          ))}</ol>
        </section>
      )}
      {view.suppliers.length > 0 && (
        <section className="tp-card"><h3>Who you buy it from</h3>
          <ol className="tp-rank">{view.suppliers.map((r) => (
            <li key={r.party}><span className="tp-rank-name"><PartyButton ix={ix} i={r.party} go={go} /><span className="tp-dim">{r.times.size}× · {qtyByUnit(r.qty)} · last {day(r.last)} at {rate(r.lastRate)}</span></span><span className="tp-rank-val">{rupees(r.amount)}</span></li>
          ))}</ol>
        </section>
      )}
      {view.history.length > 0 && (
        <section className="tp-card"><h3>Every sale and purchase <span className="tp-dim">({view.history.length})</span></h3>
          <div className="tp-lines">{view.history.slice(0, n).map(({ l, kind }, k) => (
            <div className="tp-line" key={k}>
              <span className={`tp-tag ${kind === 'sales' ? 'sale' : kind === 'returns' ? 'return' : 'purchase'}`}>{kind === 'sales' ? 'Sold' : kind === 'returns' ? 'Returned (GR)' : 'Bought'}</span>
              <span className="tp-dim">{day(l[0])}</span>
              <PartyButton ix={ix} i={l[2]} go={go} />
              {view.items.length > 1 && <span className="tp-dim">{ix.data.items[l[3]]}</span>}
              <span className="tp-line-nums">{qty(l[4], l[5])} × {rate(l[6])} = <strong>{rupees(l[7])}</strong></span>
            </div>
          ))}</div>
          <ShowMore total={view.history.length} shown={n} onMore={() => setN(n + 50)} />
        </section>
      )}
      {view.stockRows.length > 1 && <section className="tp-card"><h3>Stock items</h3><StockList ix={ix} rows={view.stockRows} go={go} /></section>}
      {!view.items.length && !view.stockRows.length && <p className="tp-card">Nothing called “{query}” was found.</p>}
    </section>
  );
}

/* ================= Customers tab ================= */

type PFilter = 'all' | 'customers' | 'suppliers' | 'owes' | 'owe' | 'bad';
type PSort = 'balance' | 'bought' | 'recent' | 'name';

export function CustomersTab({ ix, go }: { ix: TallyIndex; go: Go }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<PFilter>('customers');
  const [sort, setSort] = useState<PSort>('balance');
  const [n, setN] = useState(40);

  const rows = useMemo(() => {
    const base = q.trim() ? searchParties(ix, q, 400) : ix.data.parties.map((_, i) => i);
    const f = base.filter((i) => {
      const p = ix.data.parties[i];
      const b = balanceOf(p);
      const role = roleOf(ix, i);
      switch (filter) {
        case 'customers': return role === 'Customer' || role === 'Customer & supplier';
        case 'suppliers': return role === 'Supplier' || role === 'Customer & supplier';
        case 'owes': return b.side === 'owes-you' && !isBadDebt(p);
        case 'owe': return b.side === 'you-owe';
        case 'bad': return isBadDebt(p);
        default: return true;
      }
    });
    if (q.trim()) return f; // keep best-match order while searching
    const by: Record<PSort, (a: number, b: number) => number> = {
      balance: (a, b) => balanceOf(ix.data.parties[b]).amount - balanceOf(ix.data.parties[a]).amount,
      bought: (a, b) => ix.agg[b].salesAmt - ix.agg[a].salesAmt || ix.agg[b].purchAmt - ix.agg[a].purchAmt,
      recent: (a, b) => (ix.agg[b].lastActivity > ix.agg[a].lastActivity ? 1 : ix.agg[b].lastActivity < ix.agg[a].lastActivity ? -1 : 0),
      name: (a, b) => ix.data.parties[a].name.localeCompare(ix.data.parties[b].name)
    };
    return [...f].sort(by[sort]);
  }, [ix, q, filter, sort]);

  const total = rows.reduce((t, i) => t + balanceOf(ix.data.parties[i]).amount, 0);

  return (
    <section>
      <div className="tp-toolbar">
        <input className="tp-search" value={q} onChange={(e) => { setQ(e.target.value); setN(40); }} placeholder="Search a name — e.g. akshay, sorabh, kotawala" aria-label="Search customers and suppliers" type="search" />
        <label className="tp-sort">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as PSort)} disabled={Boolean(q.trim())}>
            <option value="balance">Biggest balance</option>
            <option value="bought">Most business</option>
            <option value="recent">Most recent</option>
            <option value="name">A–Z</option>
          </select>
        </label>
      </div>
      <div className="tp-seg wrap" role="group" aria-label="Show">
        {([['customers', 'Customers'], ['suppliers', 'Suppliers'], ['owes', 'They owe you'], ['owe', 'You owe'], ['bad', 'Bad debt'], ['all', 'Everyone']] as const).map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => { setFilter(k); setN(40); }}>{l}</button>
        ))}
      </div>
      <p className="tp-count">{rows.length} {rows.length === 1 ? 'party' : 'parties'} · balances total {rupees(total)}</p>
      <ul className="tp-people">
        {rows.slice(0, n).map((i) => {
          const p = ix.data.parties[i];
          const a = ix.agg[i];
          return (
            <li key={i}>
              <button onClick={() => go({ party: p.name })}>
                <span className="tp-people-name">{p.name}</span>
                <BalancePill ix={ix} i={i} />
                <span className="tp-people-meta">
                  {roleOf(ix, i)} · {p.group}{p.state ? ` · ${p.state}` : ''}
                  {a.salesAmt > 0 && ` · bought ${rupeesShort(a.salesAmt)}`}
                  {a.purchAmt > 0 && ` · sold you ${rupeesShort(a.purchAmt)}`}
                  {a.lastActivity && ` · last ${ago(a.lastActivity, ix.today)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ShowMore total={rows.length} shown={n} onMore={() => setN(n + 50)} />
    </section>
  );
}

/* ================= Items tab ================= */

export function ItemsTab({ ix, go }: { ix: TallyIndex; go: Go }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(true);
  const groups = useMemo(() => [...new Set(ix.data.stock.map((s) => s[1]).filter(Boolean))].sort(), [ix]);

  const rows = useMemo(() => {
    const base = q.trim() ? searchStock(ix, q, 5000) : ix.data.stock.map((_, i) => i).sort((a, b) => ix.data.stock[b][6] - ix.data.stock[a][6]);
    return base.filter((si) => { const s = ix.data.stock[si]; return (!group || s[1] === group) && (!onlyInStock || s[5] > 0); });
  }, [ix, q, group, onlyInStock]);
  const value = rows.reduce((t, si) => t + ix.data.stock[si][6], 0);

  // Best-selling items for the empty state.
  const top = useMemo(() => {
    const m = new Map<number, number>();
    ix.data.sales.forEach((l) => m.set(l[3], (m.get(l[3]) || 0) + l[7]));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [ix]);

  return (
    <section>
      <div className="tp-toolbar">
        <input className="tp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an item — e.g. pearl 4.0, nano ps, mozonite" aria-label="Search items" type="search" />
        <label className="tp-sort">Group
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>
      <label className="tp-check"><input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} /> Only items in stock</label>
      {!q.trim() && !group && (
        <section className="tp-card">
          <h3>Best-selling items</h3>
          <Bars label="Best-selling items" rows={top.map(([it, v]) => ({ label: ix.data.items[it], value: v, onClick: () => go({ item: ix.data.items[it] }) }))} />
        </section>
      )}
      <p className="tp-count">{rows.length} items · {rupees(value)} of stock</p>
      <StockList key={`${q}|${group}|${onlyInStock}`} ix={ix} rows={rows} go={go} />
    </section>
  );
}

/* ================= Day book ================= */

export function DaybookTab({ ix, go }: { ix: TallyIndex; go: Go }) {
  const last = ix.data.meta.lastDate;
  const weekAgo = useMemo(() => { const d = new Date(`${last}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); }, [last]);
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(last);
  const a = useMemo(() => periodAnswer(ix, from <= to ? from : to, from <= to ? to : from, `${day(from)} – ${day(to)}`), [ix, from, to]);
  const presets: [string, () => void][] = [
    ['Last day', () => { setFrom(last); setTo(last); }],
    ['Last 7 days', () => { setFrom(weekAgo); setTo(last); }],
    ['This month', () => { setFrom(`${last.slice(0, 7)}-01`); setTo(last); }],
    ['Everything', () => { setFrom(ix.data.meta.firstDate); setTo(last); }]
  ];
  return (
    <section>
      <div className="tp-toolbar dates">
        <label>From<input type="date" value={from} min={ix.data.meta.firstDate} max={last} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} min={ix.data.meta.firstDate} max={last} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
      </div>
      <div className="tp-seg wrap">{presets.map(([l, f]) => <button key={l} onClick={f}>{l}</button>)}</div>
      <p className="tp-summary">{a.summary}</p>
      {a.kind === 'period' && <PeriodView key={`${from}|${to}`} ix={ix} a={a} go={go} />}
    </section>
  );
}
