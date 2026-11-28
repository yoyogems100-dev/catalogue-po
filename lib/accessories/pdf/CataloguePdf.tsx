// The Accessories PDF catalogue as a react-pdf document. Built from a Plan
// (./plan.ts) and a map of picture URL -> JPEG data URL loaded beforehand, so the
// same document renders in the admin's browser and in the test script.
import React from 'react';
import { Document, Font, Image, Link, Page, Path, Circle, Svg, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { EffectiveStyle } from '../overrides';
import {
  BOT, COLS, CONT_TOP, FIND, FNAME, GRID_ROW, GRID_TOP0, GRID_TOPN, H, HB, IDX_TOP, IMG, MX, ROW_H, RH, SEC_H, TW, W,
  coloursWord, coverOf, dotsOf, fams, prettyPhone, styleSummary, waLink, type CatPage, type Plan, type PdfOptions, type PdfSection
} from './plan';

const NAVY = '#1B3A6B', INK = '#12233F', GOLDS = '#C9A94E', GOLDT = '#8A6A1F';
const IVORY = '#FAF8F3', CHAR = '#3A3F44', IG = '#EAE0C8', IGD = '#DDCFA6', UMBER = '#6B5A3E', MUTED = '#756E5C';

let registered = '';
/** `base` is where the TTFs live: a URL path in the browser, a folder on disk in the test script. */
export function registerPdfFonts(base: string) {
  if (registered === base) return;
  registered = base;
  Font.register({ family: 'Jost', fonts: [300, 400, 500, 600].map((w) => ({ src: `${base}/Jost-${w}.ttf`, fontWeight: w })) });
  Font.register({
    family: 'Playfair',
    fonts: [
      { src: `${base}/PlayfairDisplay-400.ttf`, fontWeight: 400 },
      { src: `${base}/PlayfairDisplay-400i.ttf`, fontWeight: 400, fontStyle: 'italic' },
      { src: `${base}/PlayfairDisplay-600.ttf`, fontWeight: 600 },
      { src: `${base}/PlayfairDisplay-700.ttf`, fontWeight: 700 }
    ]
  });
  Font.registerHyphenationCallback((w) => [w]);
}

type F = 'J3' | 'J' | 'J5' | 'J6' | 'PF' | 'PFi' | 'PF6';
const FONT: Record<F, Style> = {
  J3: { fontFamily: 'Jost', fontWeight: 300 }, J: { fontFamily: 'Jost', fontWeight: 400 }, J5: { fontFamily: 'Jost', fontWeight: 500 },
  J6: { fontFamily: 'Jost', fontWeight: 600 }, PF: { fontFamily: 'Playfair', fontWeight: 400 },
  PFi: { fontFamily: 'Playfair', fontWeight: 400, fontStyle: 'italic' }, PF6: { fontFamily: 'Playfair', fontWeight: 600 }
};
const ASC = 1.07; // baseline sits this many font sizes below the top of a react-pdf line

const dest = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, '-');

/** Text with its baseline at y (counted up from the page bottom), like the reportlab original. */
function T({ x, y, s, f = 'J', size = 9, color = CHAR, align = 'l', cs = 0, width, lines = 1, href, style }: {
  x: number; y: number; s: string; f?: F; size?: number; color?: string; align?: 'l' | 'r' | 'c'; cs?: number; width?: number; lines?: number; href?: string; style?: Style;
}) {
  const top = H - y - ASC * size;
  const w = width ?? (align === 'l' ? W - x - 4 : align === 'r' ? x - 4 : 2 * Math.min(x, W - x));
  const pos: Style = align === 'l' ? { left: x, width: w } : align === 'r' ? { left: x - w, width: w, textAlign: 'right' } : { left: x - w / 2, width: w, textAlign: 'center' };
  const t = (
    <Text
      style={{ position: 'absolute', top, ...pos, ...FONT[f], fontSize: size, color, letterSpacing: cs || undefined, lineHeight: 1.18, ...(lines ? { maxLines: lines, textOverflow: 'ellipsis' as const } : {}), ...(style || {}) }}
      
    >
      {s}
    </Text>
  );
  return href ? <Link src={href} style={{ textDecoration: 'none' }}>{t}</Link> : t;
}

/** A clickable area (bottom-up coordinates). */
function Hot({ href, x0, y0, x1, y1 }: { href: string; x0: number; y0: number; x1: number; y1: number }) {
  return <Link src={href} style={{ position: 'absolute', left: x0, top: H - y1, width: x1 - x0, height: y1 - y0 }}><View style={{ width: '100%', height: '100%' }} /></Link>;
}
const go = (key: string) => `#${dest(key)}`;

/** Invisible words so a viewer's Find (Ctrl/Cmd+F) finds colours and families without cluttering the page. */
function Hidden({ x, y, s, bg = IVORY }: { x: number; y: number; s: string; bg?: string }) {
  return <Text style={{ position: 'absolute', left: x, top: H - y, width: TW, height: 2, fontFamily: 'Jost', fontSize: 1, color: bg, lineHeight: 1 }}>{s}</Text>;
}

function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1} ${y1} Z`;
}
/** A colour dot centred at (x, y) bottom-up; several colours split it into slices. */
function Dot({ x, y, r, cols, ring = true }: { x: number; y: number; r: number; cols: string[]; ring?: boolean }) {
  const s = 2 * r + 1;
  return (
    <Svg style={{ position: 'absolute', left: x - r - 0.5, top: H - y - r - 0.5, width: s, height: s }} viewBox={`0 0 ${s} ${s}`}>
      {cols.length === 1
        ? <Circle cx={r + 0.5} cy={r + 0.5} r={r} fill={cols[0]} />
        : cols.map((c, i) => <Path key={i} d={wedge(r + 0.5, r + 0.5, r, 90 + (360 * i) / cols.length, 90 + (360 * (i + 1)) / cols.length)} fill={c} />)}
      {ring ? <Circle cx={r + 0.5} cy={r + 0.5} r={r} fill="none" stroke={IGD} strokeWidth={0.4} /> : null}
    </Svg>
  );
}
const Line = ({ x0, x1, y, color = IG, w = 0.6 }: { x0: number; x1: number; y: number; color?: string; w?: number }) =>
  <View style={{ position: 'absolute', left: x0, top: H - y - w / 2, width: x1 - x0, height: w, backgroundColor: color }} />;
/** A box given by its bottom-left corner, bottom-up. */
const Box = ({ x, y, w, h, style }: { x: number; y: number; w: number; h: number; style?: Style }) =>
  <View style={{ position: 'absolute', left: x, top: H - y - h, width: w, height: h, ...(style || {}) }} />;
function Pic({ src, x, y, w, h, pad = 0 }: { src?: string; x: number; y: number; w: number; h: number; pad?: number }) {
  if (!src) return null;
  return <Image src={src} style={{ position: 'absolute', left: x + pad, top: H - y - h + pad, width: w - 2 * pad, height: h - 2 * pad, objectFit: 'contain' }} />;
}

export type PdfProps = { plan: Plan; opt: PdfOptions; img: Record<string, string> };

export default function CataloguePdf({ plan, opt, img }: PdfProps) {
  const { sections, byCat, order, pg, total } = plan;
  const code = (cid: string) => plan.rangeOf.get(cid)!.series || cid.toUpperCase();
  const name = (cid: string) => plan.rangeOf.get(cid)!.name;
  const phone = prettyPhone(opt.whatsapp);

  function Footer({ n, section }: { n: number; section?: PdfSection }) {
    const items: [string, string][] = [];
    if (opt.contents) items.push(['Contents', 'contents']);
    if (opt.index) items.push(['Category index', 'index']);
    if (opt.finder) items.push(['Colour finder', 'finder']);
    if (section) items.push([section.name, `sec:${section.id}`]);
    return (
      <>
        <Line x0={MX} x1={W - MX} y={40} />
        <T x={MX} y={26} s="YOYO GEMS" f="J6" size={7.5} color={NAVY} cs={1.2} width={90} />
        <View style={{ position: 'absolute', left: 125, top: H - 26 - ASC * 7.5, width: 360, flexDirection: 'row' }}>
          {items.map(([label, d], i) => (
            <View key={d} style={{ flexDirection: 'row' }}>
              {i ? <Text style={{ ...FONT.J5, fontSize: 7.5, color: IGD, marginHorizontal: 5, lineHeight: 1.18 }}>·</Text> : null}
              <Link src={go(d)} style={{ textDecoration: 'none' }}><Text style={{ ...FONT.J5, fontSize: 7.5, color: GOLDT, lineHeight: 1.18 }}>{label}</Text></Link>
            </View>
          ))}
        </View>
        <T x={W - MX} y={26} s={`${n} / ${total}`} size={7.5} color={MUTED} align="r" width={60} />
      </>
    );
  }
  const PageHead = ({ title, sub }: { title: string; sub?: string }) => (
    <>
      <T x={MX} y={H - 58} s={title} f="PF6" size={22} color={NAVY} />
      {sub ? <T x={MX} y={H - 76} s={sub} size={9} color={UMBER} /> : null}
      <Line x0={MX} x1={MX + 40} y={H - 86} color={GOLDS} w={0.8} />
    </>
  );
  const PageA4 = ({ children, bg = IVORY, id, bookmark }: { children: React.ReactNode; bg?: string; id?: string; bookmark?: string }) => (
    <Page size={[W, H]} style={{ backgroundColor: bg }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} {...(id ? { id: dest(id) } : {})} {...(bookmark ? { bookmark: { title: bookmark, fit: true } } : {})}>
        {children}
      </View>
      {bg === IVORY ? <Watermark /> : null}
    </Page>
  );

  // ================= COVER =================
  const stripCats = (sections.length >= 3 ? sections.map((s) => s.cats[0].id) : order).slice(0, 6);
  const sz = 72, gap = 10, x0 = (W - (stripCats.length * sz + (stripCats.length - 1) * gap)) / 2;
  const stats: [string, string][] = [
    ...(sections.length > 1 ? [[String(sections.length), sections.length === 1 ? 'look' : 'looks'] as [string, string]] : []),
    [String(order.length), order.length === 1 ? 'category' : 'categories'],
    [plan.styleCount.toLocaleString('en-IN'), 'styles & colours']
  ];
  const cover = (
    <PageA4 bg={NAVY} id="cover" bookmark="Cover">
      <Box x={0} y={0} w={W} h={150} style={{ backgroundColor: INK }} />
      <Box x={22} y={22} w={W - 44} h={H - 44} style={{ borderWidth: 0.7, borderColor: GOLDS }} />
      {img.logo ? <Image src={img.logo} style={{ position: 'absolute', left: (W - 230) / 2, top: 250 - (230 * 120) / 440, width: 230, height: (230 * 120) / 440 }} /> : null}
      <T x={W / 2} y={H - 330} s="THE ACCESSORIES COLLECTION" f="J5" size={9} color={GOLDS} align="c" cs={3} />
      <T x={W / 2} y={H - 382} s={opt.title} f="PF" size={opt.title.length > 26 ? 30 : 40} color={IVORY} align="c" width={W - 90} />
      {opt.subtitle ? <T x={W / 2} y={H - 412} s={opt.subtitle} f="PFi" size={14} color={IG} align="c" width={W - 90} /> : null}
      <Line x0={W / 2 - 30} x1={W / 2 + 30} y={H - 436} color={GOLDS} />
      {stats.map(([a, b], i) => {
        const x = W / 2 + (i - (stats.length - 1) / 2) * 150;
        return (
          <React.Fragment key={b}>
            <T x={x} y={H - 494} s={a} f="PF6" size={30} color={IVORY} align="c" width={140} />
            <T x={x} y={H - 512} s={b.toUpperCase()} f="J5" size={7.5} color={GOLDS} align="c" cs={1.5} width={140} />
          </React.Fragment>
        );
      })}
      {stripCats.map((cid, i) => {
        const x = x0 + i * (sz + gap);
        return (
          <React.Fragment key={cid}>
            <Box x={x} y={H - 630} w={sz} h={sz} style={{ backgroundColor: '#FFFFFF', borderRadius: 6 }} />
            <Pic src={img[coverOf(plan.rangeOf.get(cid)!)]} x={x} y={H - 630} w={sz} h={sz} pad={3} />
            <Hot href={go(`cat:${cid}`)} x0={x} y0={H - 630} x1={x + sz} y1={H - 630 + sz} />
          </React.Fragment>
        );
      })}
      {opt.preparedFor ? <T x={W / 2} y={H - 670} s={`Prepared for ${opt.preparedFor}`} f="PFi" size={12} color={IG} align="c" width={W - 90} /> : null}
      <T x={W / 2} y={112} s="Synthetic Gemstones. Infinite Choices. One Trusted Name." f="PFi" size={11} color={IG} align="c" />
      <T x={W / 2} y={86} s={`Order on WhatsApp  ${phone}`} f="J5" size={9.5} color={GOLDS} align="c" width={220} href={waLink(opt.whatsapp)} />
      <T x={W / 2} y={62} s={opt.edition} size={8} color={MUTED} align="c" />
    </PageA4>
  );

  // ================= CONTENTS =================
  let contents: React.ReactNode = null;
  if (opt.contents) {
    const py = H - 210;
    const tips: [string, string][] = [
      ['Browse by look', 'Tap a section below, or open the bookmarks panel in your PDF viewer.'],
      ...(opt.index ? [['See every colour at a glance', 'The Category index shows each category with a dot for every colour.'] as [string, string]] : []),
      ...(opt.finder ? [['Shop by colour', 'The Colour finder shows which categories come in blue, pink, multicolour and more.'] as [string, string]] : []),
      ['Search', 'Press Ctrl+F (⌘F on Mac, or the search icon on a phone): try a colour such as lavender, a name, or a style code.'],
      ['Order', 'Tap any photo to send us that style on WhatsApp.']
    ].slice(0, 4) as [string, string][];
    let y = py - 34;
    const guides = ([['Category index', 'index', 'Every category with its colours'], ['Colour finder', 'finder', 'Which categories come in which colour']] as const).filter(([, d]) => pg[d]);
    const rowsStart = y - guides.length * 22 - 10;
    contents = (
      <PageA4 id="contents" bookmark="Contents">
        <PageHead title="Contents" sub="Tap any line to jump straight to it" />
        <Box x={MX} y={py} w={W - 2 * MX} h={100} style={{ backgroundColor: '#FFFFFF', borderWidth: 0.6, borderColor: IG, borderRadius: 8 }} />
        <T x={MX + 18} y={py + 78} s="HOW TO FIND A STYLE" f="J6" size={7.5} color={GOLDT} cs={1.5} />
        {tips.map(([a, b], i) => {
          const x = MX + 18 + (i % 2) * 262, ty = py + 58 - Math.floor(i / 2) * 30;
          return (
            <React.Fragment key={a}>
              <T x={x} y={ty} s={a} f="J6" size={8.5} color={NAVY} width={240} />
              <T x={x} y={ty - 10.5} s={b} size={7.6} color={CHAR} width={240} lines={2} style={{ lineHeight: 1.12 }} />
            </React.Fragment>
          );
        })}
        {guides.map(([label, d, note], i) => {
          const gy = y - i * 22;
          return (
            <React.Fragment key={d}>
              <T x={MX} y={gy} s={label} f="PF6" size={12.5} color={NAVY} width={118} />
              <T x={MX + 120} y={gy} s={note} size={8.5} color={UMBER} width={300} />
              <T x={W - MX} y={gy} s={String(pg[d])} f="J5" size={10} color={GOLDT} align="r" width={40} />
              <Hot href={go(d)} x0={MX - 4} y0={gy - 6} x1={W - MX + 4} y1={gy + 14} />
            </React.Fragment>
          );
        })}
        <T x={MX} y={rowsStart} s="SHOP BY LOOK" f="J6" size={7.5} color={GOLDT} cs={1.5} />
        <Line x0={MX} x1={W - MX} y={rowsStart - 8} />
        {sections.map((s, i) => {
          const sy = rowsStart - 12 - 23.5 * (i + 1);
          const ns = s.cats.reduce((a, c) => a + byCat.get(c.id)!.length, 0);
          return (
            <React.Fragment key={s.id}>
              <T x={MX} y={sy} s={String(i + 1).padStart(2, '0')} f="J5" size={8} color={GOLDS} width={20} />
              <View style={{ position: 'absolute', left: MX + 22, top: H - sy - ASC * 11.5, width: 440, flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={{ ...FONT.PF6, fontSize: 11.5, color: NAVY, lineHeight: 1.18 }}>{s.name}</Text>
                <Text style={{ ...FONT.J, fontSize: 8, color: UMBER, marginLeft: 8, marginBottom: 1.5, lineHeight: 1.18 }}>
                  {`${s.cats.length} categor${s.cats.length === 1 ? 'y' : 'ies'} · ${ns} styles`}
                </Text>
              </View>
              <T x={W - MX} y={sy} s={String(pg[`sec:${s.id}`])} f="J5" size={10} color={GOLDT} align="r" width={40} />
              <Hot href={go(`sec:${s.id}`)} x0={MX - 4} y0={sy - 7} x1={W - MX + 4} y1={sy + 14} />
              <Line x0={MX + 22} x1={W - MX} y={sy - 8} w={0.4} />
            </React.Fragment>
          );
        })}
        <Footer n={pg.contents} />
      </PageA4>
    );
  }

  // ================= CATEGORY INDEX =================
  const index = opt.index ? plan.indexPages.map((items, k) => {
    let y = k === 0 ? IDX_TOP : H - 70;
    return (
      <PageA4 key={`i${k}`} {...(k === 0 ? { id: 'index', bookmark: 'Category index' } : {})}>
        {k === 0
          ? <PageHead title="Category index" sub="Each dot is one colour or pattern you can order. Tap a category to open it." />
          : <T x={MX} y={H - 50} s="Category index (continued)" f="PF6" size={13} color={NAVY} />}
        {items.map((it) => {
          if (it.kind === 'sec') {
            y -= SEC_H; const v = it.sec;
            return (
              <React.Fragment key={`s${v.id}`}>
                <View style={{ position: 'absolute', left: MX, top: H - (y + 9) - ASC * 12.5, width: W - 2 * MX, flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={{ ...FONT.PF6, fontSize: 12.5, color: NAVY, lineHeight: 1.18 }}>{v.name}</Text>
                  {v.sub ? <Text style={{ ...FONT.J, fontSize: 7.6, color: UMBER, marginLeft: 10, marginBottom: 2, lineHeight: 1.18, maxWidth: 330, maxLines: 1, textOverflow: 'ellipsis' }}>{v.sub}</Text> : null}
                </View>
                <Line x0={MX} x1={W - MX} y={y + 3} color={GOLDS} />
                <Hot href={go(`sec:${v.id}`)} x0={MX} y0={y + 2} x1={W - MX} y1={y + SEC_H - 4} />
              </React.Fragment>
            );
          }
          const c = it.cat, ps = byCat.get(c.id)!; y -= ROW_H;
          const r = 3.4, step = 8.6, dx = MX + 46, maxd = Math.floor((W - MX - 30 - dx) / step);
          const show = ps.length <= maxd ? ps : ps.slice(0, maxd - 2);
          return (
            <React.Fragment key={c.id}>
              <Box x={MX} y={y + 4} w={32} h={32} style={{ backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: IG, borderRadius: 3 }} />
              <Pic src={img[coverOf(c)]} x={MX} y={y + 4} w={32} h={32} pad={1.5} />
              <View style={{ position: 'absolute', left: MX + 42, top: H - (y + 24) - ASC * 10.5, width: 380, flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={{ ...FONT.J6, fontSize: 7, color: GOLDT, letterSpacing: 0.8, marginRight: 5, marginBottom: 1.6, lineHeight: 1.18 }}>{code(c.id)}</Text>
                <Text style={{ ...FONT.PF6, fontSize: 10.5, color: NAVY, lineHeight: 1.18, maxLines: 1, textOverflow: 'ellipsis' }}>{c.name}</Text>
              </View>
              <T x={W - MX - 30} y={y + 24} s={coloursWord(ps.length)} f="J5" size={8} color={CHAR} align="r" width={80} />
              <T x={W - MX} y={y + 24} s={String(pg[`cat:${c.id}`])} f="J5" size={9.5} color={GOLDT} align="r" width={28} />
              {show.map((p, i) => <Dot key={p.sku} x={dx + r + i * step} y={y + 10.5} r={r} cols={dotsOf(p, img[`dot:${p.sku}`])} />)}
              {show.length < ps.length ? <T x={dx + show.length * step + 2} y={y + 8} s={`+${ps.length - show.length} more`} size={7} color={UMBER} width={60} /> : null}
              <Hidden x={dx} y={y + 3} s={ps.map((p) => `${p.name} ${p.sku}`).join(' ')} />
              <Hot href={go(`cat:${c.id}`)} x0={MX} y0={y + 2} x1={W - MX} y1={y + ROW_H - 2} />
              <Line x0={MX + 42} x1={W - MX} y={y + 1} w={0.35} />
            </React.Fragment>
          );
        })}
        <Footer n={pg.index + k} />
      </PageA4>
    );
  }) : null;

  // ================= COLOUR FINDER =================
  const GX0 = MX + 196, GCW = (W - MX - GX0) / FIND.length;
  const GridHead = ({ y }: { y: number }) => (
    <>
      {FIND.map(([k, label, hx], i) => {
        const cx = GX0 + GCW * (i + 0.5);
        return (
          <React.Fragment key={k}>
            <Dot x={cx} y={y + 26} r={6} cols={hx ? [hx] : ['#D2452F', '#3F86C4', '#E9C23A', '#4E9A55']} />
            <T x={cx} y={y + 11} s={label} f="J5" size={6.6} color={CHAR} align="c" width={GCW - 2} lines={2} style={{ lineHeight: 1.1 }} />
          </React.Fragment>
        );
      })}
      <Line x0={MX} x1={W - MX} y={y - 8} color={GOLDS} />
    </>
  );
  let stripe = 0;
  const finder = opt.finder ? plan.gridPages.map((items, k) => {
    let y = k === 0 ? GRID_TOP0 : GRID_TOPN - 14;
    return (
      <PageA4 key={`g${k}`} {...(k === 0 ? { id: 'finder', bookmark: 'Colour finder' } : {})}>
        {k === 0
          ? <><PageHead title="Colour finder" sub="How many styles each category has in each colour family. Tap a row to open that category." /><GridHead y={H - 138} /></>
          : <><T x={MX} y={H - 50} s="Colour finder (continued)" f="PF6" size={13} color={NAVY} /><GridHead y={H - 92} /></>}
        {items.map((it) => {
          if (it.kind === 'sec') {
            y -= GRID_ROW + 4;
            return <T key={`s${it.sec.id}`} x={MX} y={y + 4} s={it.sec.name.toUpperCase()} f="J6" size={6.8} color={GOLDT} cs={1} />;
          }
          const c = it.cat, ps = byCat.get(c.id)!; y -= GRID_ROW;
          const cnt: Record<string, number> = Object.fromEntries(FIND.map(([kk]) => [kk, 0]));
          for (const p of ps) for (const f of fams(p)) cnt[f]++;
          const striped = stripe++ % 2 === 0;
          return (
            <React.Fragment key={c.id}>
              {striped ? <Box x={MX} y={y - 3.6} w={W - 2 * MX} h={GRID_ROW} style={{ backgroundColor: '#F3EEE2' }} /> : null}
              <T x={MX + 2} y={y + 1} s={code(c.id)} f="J6" size={6.6} color={GOLDT} width={32} />
              <T x={MX + 34} y={y + 1} s={c.name} size={7.6} color={NAVY} width={150} />
              <T x={GX0 - 6} y={y + 1} s={String(ps.length)} f="J5" size={7} color={MUTED} align="r" width={30} />
              {FIND.map(([kk], i) => {
                const cx = GX0 + GCW * (i + 0.5);
                return cnt[kk]
                  ? <T key={kk} x={cx} y={y + 1} s={String(cnt[kk])} f="J6" size={7.4} color={CHAR} align="c" width={GCW} />
                  : <Box key={kk} x={cx - 0.9} y={y + 2.5} w={1.8} h={1.8} style={{ backgroundColor: IGD, borderRadius: 0.9 }} />;
              })}
              <Hot href={go(`cat:${c.id}`)} x0={MX} y0={y - 3.6} x1={W - MX} y1={y - 3.6 + GRID_ROW} />
            </React.Fragment>
          );
        })}
        {k === plan.gridPages.length - 1
          ? <T x={MX} y={52} s="A style with two or more colours is counted in each of its colour families. · = not available in that colour." size={7} color={MUTED} />
          : null}
        <Footer n={pg.finder + k} />
      </PageA4>
    );
  }) : null;

  // ================= CATEGORY PAGES =================
  function Tile({ p, x, ytop }: { p: EffectiveStyle; x: number; ytop: number }) {
    const r = plan.rangeOf.get(p.cat)!;
    const order = waLink(opt.whatsapp, `Hi, I'd like to order ${p.sku} ${p.name} (${r.series} ${r.name}).`);
    const sy = ytop - IMG - 4 - 11, ny = sy - 11;
    const words = [...p.colours, ...[...fams(p)].map((f) => FNAME[f]), p.style].join(' ');
    return (
      <>
        <Box x={x} y={ytop - IMG} w={TW} h={IMG} style={{ backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: IG, borderRadius: 4 }} />
        <Pic src={img[p.thumb || '']} x={x} y={ytop - IMG} w={TW} h={IMG} pad={3} />
        {img[p.swatch || ''] ? <Image src={img[p.swatch!]} style={{ position: 'absolute', left: x, top: H - sy - 11, width: TW, height: 11, objectFit: 'fill', borderRadius: 5.5 }} /> : null}
        <Hot href={order} x0={x} y0={sy} x1={x + TW} y1={ytop} />
        <View style={{ position: 'absolute', left: x, top: H - ny - ASC * 8.6, width: TW }}>
          <Text style={{ ...FONT.J5, fontSize: 8.6, color: INK, lineHeight: 1.16, maxLines: 2, textOverflow: 'ellipsis' }}>{p.name}</Text>
          <View style={{ flexDirection: 'row', marginTop: 1 }}>
            <Text style={{ ...FONT.J6, fontSize: 7, color: GOLDT, letterSpacing: 0.5, lineHeight: 1.18 }}>{p.sku}</Text>
            {p.code ? <Text style={{ ...FONT.J, fontSize: 7, color: UMBER, marginLeft: 5, lineHeight: 1.18 }}>{`· ${p.code}`}</Text> : null}
            {p.out ? <Text style={{ ...FONT.J6, fontSize: 6.5, color: '#A23B2A', marginLeft: 5, lineHeight: 1.18 }}>OUT OF STOCK</Text> : null}
          </View>
        </View>
        <Hidden x={x} y={ny - 26} s={words} />
      </>
    );
  }

  function Head({ cid, T: top, first }: { cid: string; T: number; first: boolean }) {
    const cat = plan.rangeOf.get(cid)!, ps = byCat.get(cid)!, sec = plan.secOf.get(cid)!;
    const B = top - HB, tw = W - 2 * MX - 150;
    const chip = coloursWord(ps.length), sm = styleSummary(ps);
    const i = order.indexOf(cid);
    const prev = i > 0 ? order[i - 1] : null, next = i < order.length - 1 ? order[i + 1] : null;
    const chipW = chip.length * 4.6 + 16;
    return (
      <View style={{ position: 'absolute', left: 0, top: H - top, width: W, height: HB }} id={dest(`cat:${cid}`)}
        {...({ bookmark: { title: `${code(cid)}  ${cat.name}`, fit: false } } as object)}>
        {first ? <View id={dest(`sec:${sec.id}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1 }} /> : null}
        <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: HB, backgroundColor: '#FFFFFF', borderBottomWidth: 0.6, borderColor: IG, ...(top < H ? { borderTopWidth: 0.6 } : {}) }} />
        <View style={{ position: 'absolute', left: MX, top: 40 - ASC * 7, flexDirection: 'row' }}>
          <Link src={go(`sec:${sec.id}`)} style={{ textDecoration: 'none' }}><Text style={{ ...FONT.J6, fontSize: 7, color: GOLDT, letterSpacing: 1.4, lineHeight: 1.18 }}>{sec.name.toUpperCase()}</Text></Link>
          <Text style={{ ...FONT.J, fontSize: 7, color: MUTED, marginLeft: 8, lineHeight: 1.18 }}>{`${sec.cats.findIndex((c) => c.id === cid) + 1} of ${sec.cats.length}`}</Text>
        </View>
        <View style={{ position: 'absolute', right: MX, top: 40 - ASC * 7.5, flexDirection: 'row' }}>
          {prev ? <Link src={go(`cat:${prev}`)} style={{ textDecoration: 'none' }}><Text style={{ ...FONT.J5, fontSize: 7.5, color: GOLDT, lineHeight: 1.18 }}>{`‹ ${code(prev)}`}</Text></Link> : null}
          {next ? <Link src={go(`cat:${next}`)} style={{ textDecoration: 'none' }}><Text style={{ ...FONT.J5, fontSize: 7.5, color: GOLDT, marginLeft: 14, lineHeight: 1.18 }}>{`${code(next)} ›`}</Text></Link> : null}
        </View>
        <View style={{ position: 'absolute', left: MX, top: 70 - ASC * 10, width: tw }}>
          <Text style={{ ...FONT.J6, fontSize: 10, color: GOLDT, letterSpacing: 1.5, lineHeight: 1.18 }}>{code(cid)}</Text>
          <Text style={{ ...FONT.PF6, fontSize: 21, color: NAVY, lineHeight: 1.14, marginTop: 6, maxLines: 2, textOverflow: 'ellipsis' }}>{cat.name}</Text>
          {cat.text ? <Text style={{ ...FONT.J, fontSize: 8.8, color: CHAR, lineHeight: 1.31, marginTop: 8, maxLines: 4, textOverflow: 'ellipsis' }}>{cat.text}</Text> : null}
          {cat.finish ? <Text style={{ ...FONT.J, fontSize: 8, color: UMBER, lineHeight: 1.18, marginTop: 4, maxLines: 1, textOverflow: 'ellipsis' }}>{`Finish: ${cat.finish}`}</Text> : null}
        </View>
        <View style={{ position: 'absolute', left: MX, top: HB - 16 - 11, height: 16, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ backgroundColor: NAVY, borderRadius: 8, height: 16, paddingHorizontal: 8, justifyContent: 'center' }}>
            <Text style={{ ...FONT.J6, fontSize: 8, color: IVORY, lineHeight: 1 }}>{chip}</Text>
          </View>
          <Text style={{ ...FONT.J, fontSize: 8, color: UMBER, marginLeft: 8, lineHeight: 1 }}>{sm}</Text>
          <View style={{ flexDirection: 'row', marginLeft: 6 }}>
            {ps.slice(0, Math.max(0, Math.floor((tw - chipW - sm.length * 3.9 - 20) / 7.5))).map((p) => (
              <View key={p.sku} style={{ width: 7.5, height: 7, position: 'relative' }}><DotInline cols={dotsOf(p, img[`dot:${p.sku}`])} /></View>
            ))}
          </View>
        </View>
        <View style={{ position: 'absolute', left: W - MX - 132, top: HB - 14 - 132, width: 132, height: 132, backgroundColor: IVORY, borderWidth: 0.6, borderColor: IG, borderRadius: 6, padding: 3 }}>
          {img[coverOf(cat)] ? <Image src={img[coverOf(cat)]} style={{ width: 126, height: 126, objectFit: 'contain' }} /> : null}
        </View>
      </View>
    );
  }

  const catPages = plan.catPages.map((p: CatPage, i) => {
    const n = (opt.contents ? 1 : 0) + (opt.index ? plan.indexPages.length : 0) + (opt.finder ? plan.gridPages.length : 0) + 2 + i;
    return (
      <PageA4 key={`c${i}`}>
        {p.ops.map((op, j) => {
          if (op.kind === 'head') return <Head key={j} cid={op.cat} T={op.T} first={p.sec.cats[0].id === op.cat} />;
          if (op.kind === 'cont') {
            return (
              <React.Fragment key={j}>
                <View style={{ position: 'absolute', left: MX, top: 42 - ASC * 11, width: W - 2 * MX, flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={{ ...FONT.J6, fontSize: 8, color: GOLDT, letterSpacing: 1.2, width: 40, marginBottom: 1.5, lineHeight: 1.18 }}>{code(op.cat)}</Text>
                  <Text style={{ ...FONT.PF6, fontSize: 11, color: NAVY, lineHeight: 1.18 }}>{`${name(op.cat)}  ·  continued`}</Text>
                </View>
                <Hot href={go(`cat:${op.cat}`)} x0={MX - 2} y0={H - 48} x1={W - MX} y1={H - 30} />
                <Line x0={MX} x1={W - MX} y={H - 52} />
              </React.Fragment>
            );
          }
          return op.styles.map((s, k) => <Tile key={`${j}-${s.sku}`} p={s} x={MX + (k % COLS) * (TW + 12)} ytop={op.ytop - Math.floor(k / COLS) * RH} />);
        })}
        <Footer n={n} section={p.sec} />
      </PageA4>
    );
  });

  // ================= HOW TO ORDER =================
  const howTo = opt.howToOrder ? (
    <PageA4 bg={NAVY} id="order" bookmark="How to order">
      <Box x={22} y={22} w={W - 44} h={H - 44} style={{ borderWidth: 0.7, borderColor: GOLDS }} />
      {img.logo ? <Image src={img.logo} style={{ position: 'absolute', left: (W - 200) / 2, top: 150, width: 200, height: (200 * 120) / 440 }} /> : null}
      <T x={W / 2} y={H - 330} s="How to order" f="PF" size={34} color={IVORY} align="c" />
      <Line x0={W / 2 - 30} x1={W / 2 + 30} y={H - 352} color={GOLDS} />
      {([
        ['1', 'Pick your styles', 'Note the style code under each photo, such as Y10-05, or tap the photo.'],
        ['2', 'Send them on WhatsApp', `Tapping a photo opens WhatsApp with that style ready to send. Or message ${phone.replace(/ /g, '\u00A0')} with your codes and quantities.`],
        ['3', 'We confirm', 'We reply with availability, prices and delivery time for your order.']
      ] as const).map(([n, a, b], i) => {
        const y = H - 410 - i * 70;
        return (
          <React.Fragment key={n}>
            <T x={MX + 70} y={y} s={n} f="PF6" size={26} color={GOLDS} width={30} />
            <T x={MX + 110} y={y + 6} s={a} f="J6" size={12} color={IVORY} width={340} />
            <T x={MX + 110} y={y - 10} s={b} size={9.5} color={IG} width={340} lines={2} style={{ lineHeight: 1.35 }} />
          </React.Fragment>
        );
      })}
      <View style={{ position: 'absolute', left: (W - 260) / 2, top: H - 220, width: 260, height: 40, borderRadius: 20, backgroundColor: GOLDS, justifyContent: 'center' }}>
        <Link src={waLink(opt.whatsapp)} style={{ textDecoration: 'none' }}>
          <Text style={{ ...FONT.J6, fontSize: 11, color: INK, textAlign: 'center' }}>{`WhatsApp  ${phone}`}</Text>
        </Link>
      </View>
      <T x={W / 2} y={140} s="Colours can look slightly different on screen. Ask us for a photo or sample of any style." size={8.5} color={IG} align="c" width={W - 120} />
      <T x={W / 2} y={112} s="Synthetic Gemstones. Infinite Choices. One Trusted Name." f="PFi" size={11} color={IG} align="c" />
      <T x={W / 2} y={62} s={opt.edition} size={8} color={MUTED} align="c" />
    </PageA4>
  ) : null;

  return (
    <Document title={`YOYO GEMS — ${opt.title}`} author="YOYO GEMS" subject="Accessories catalogue: categories, colours and style codes"
      keywords="YOYO GEMS bracelets necklaces cords charms colours catalogue" creator="YOYO GEMS" producer="YOYO GEMS" pageMode="useOutlines">
      {cover}
      {contents}
      {index}
      {finder}
      {catPages}
      {howTo}
    </Document>
  );
}

/**
 * A faint diagonal YOYO GEMS across every ivory page, drawn over the photos so a
 * screenshot or cropped picture still carries it (like the site's other PDFs, but
 * on top, since the photo tiles would hide a mark underneath).
 */
function Watermark() {
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'Playfair', fontWeight: 600, fontSize: 84, letterSpacing: 10, color: NAVY, opacity: 0.07, transform: 'rotate(-35deg)' }}>YOYO GEMS</Text>
    </View>
  );
}

/** A small dot drawn in flow (the header's colour strip). */
function DotInline({ cols }: { cols: string[] }) {
  const r = 3;
  return (
    <Svg style={{ width: 7, height: 7 }} viewBox="0 0 7 7">
      {cols.length === 1
        ? <Circle cx={3.5} cy={3.5} r={r} fill={cols[0]} />
        : cols.map((c, i) => <Path key={i} d={wedge(3.5, 3.5, r, 90 + (360 * i) / cols.length, 90 + (360 * (i + 1)) / cols.length)} fill={c} />)}
      <Circle cx={3.5} cy={3.5} r={r} fill="none" stroke={IGD} strokeWidth={0.4} />
    </Svg>
  );
}

export { BOT, CONT_TOP };
