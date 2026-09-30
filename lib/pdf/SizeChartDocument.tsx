import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { PDF_BRAND_TAGLINE } from './brand';
import { priceUnitLabel } from '../price-unit';
import { PageWatermark } from './PageWatermark';

export type SizeChartSection = {
  name: string;
  image: string | null;
  /** pcsPerCt: sizes sold by carat (Moissanite melee) -- pieces in 1 ct. */
  rows: { size: string; diamondEquivalentCt: number | null; priceInr?: number | null; pcsPerCt?: number | null }[];
};
export type SizeChartColor = { name: string; hex: string | null; image: string | null };

// A4 in points, less the page padding, masthead, legend and footer.
const CONTENT_W = 595 - 52;
const GAP = 8;
const HALF = (CONTENT_W - GAP) / 2;
const PAGE_BODY_H = 842 - 26 - 42 - 82 - 30 - 6;
const HEAD_H = 34, COLHEAD_H = 15, ROW_H = 12.5;
// Up to this many sizes a shape takes half the page width in two columns;
// beyond it, the full width in four.
const HALF_MAX_ROWS = 44;

const css = StyleSheet.create({
  page: { padding: 26, paddingBottom: 42, fontFamily: 'Helvetica', color: '#12233f', fontSize: 8 },
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 8, borderBottomWidth: 2, borderBottomColor: '#c9a94e' },
  brandBlock: { flexDirection: 'column', width: 280 },
  brandLogo: { width: 185, height: 53, objectFit: 'contain', objectPosition: 'left center' },
  brand: { fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: 1.1 },
  strap: { marginTop: 2, color: '#756e5c', fontSize: 6.8 },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  category: { marginTop: 3, color: '#62666d', fontSize: 8.5 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#f3efe4', color: '#62666d', fontSize: 6.7 },
  // Shape cards flow in two columns and are only as tall as their sizes;
  // a shape with many sizes (Round) spans the page in four columns.
  segment: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  stack: { width: HALF, flexDirection: 'column', gap: GAP },
  card: { borderWidth: .8, borderColor: '#b9c1cc', backgroundColor: '#fff', marginBottom: GAP },
  cardInStack: { borderWidth: .8, borderColor: '#b9c1cc', backgroundColor: '#fff' },
  cardHead: { height: HEAD_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, backgroundColor: '#e5edf6', borderBottomWidth: .8, borderBottomColor: '#b9c1cc' },
  image: { width: 27, height: 27, objectFit: 'contain', marginRight: 8 },
  name: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  count: { color: '#62666d', fontSize: 6.4 },
  columnsHead: { height: COLHEAD_H, flexDirection: 'row', backgroundColor: '#12233f' },
  columnHead: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 5.8, letterSpacing: .4 },
  columns: { flexDirection: 'row' },
  column: { flex: 1, borderRightWidth: .45, borderRightColor: '#d6dbe2' },
  cell: { height: ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 6, borderBottomWidth: .35, borderBottomColor: '#d6dbe2' },
  cellAlt: { backgroundColor: '#f7f9fb' },
  size: { fontFamily: 'Helvetica-Bold', fontSize: 6.9 },
  meta: { color: '#62666d', fontSize: 6.2, textAlign: 'right' },
  dash: { color: '#b9c1cc', fontSize: 6.2, textAlign: 'right' },
  price: { color: '#8b702a', fontFamily: 'Helvetica-Bold', fontSize: 6.3, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 18, left: 26, right: 26, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 7, borderTopWidth: .5, borderTopColor: '#c8cdd5', color: '#62666d', fontSize: 6.8 },
  colorIntro: { marginBottom: 12, color: '#62666d', fontSize: 8.2, lineHeight: 1.35 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: .7, borderLeftWidth: .7, borderColor: '#c8cdd5' },
  colorCard: { width: '33.333%', height: 64, flexDirection: 'row', alignItems: 'center', padding: 7, borderRightWidth: .7, borderBottomWidth: .7, borderColor: '#c8cdd5' },
  colorImageFrame: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#f7f8fa' },
  colorImage: { width: 39, height: 39, objectFit: 'contain' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: .7, borderColor: '#b9c1cc' },
  colorName: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 7.6, lineHeight: 1.25 },
});

function formatDew(value: number): string {
  return `${value.toFixed(value < .1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '')} ct`;
}

type Card = { section: SizeChartSection; full: boolean; columns: number; height: number };

function cardOf(section: SizeChartSection): Card {
  const full = section.rows.length > HALF_MAX_ROWS;
  const columns = full ? 4 : section.rows.length > 6 ? 2 : 1;
  const lines = Math.ceil(section.rows.length / columns);
  return { section, full, columns, height: HEAD_H + COLHEAD_H + lines * ROW_H + 2 };
}

// A page is a run of segments: a full-width card, or two stacks of half cards
// side by side. Each gap is filled with the first card (in chart order) that
// fits it, so no page is left half empty while a later shape would have fitted;
// a card never splits across pages.
type Segment = { kind: 'full'; card: Card } | { kind: 'pair'; left: Card[]; right: Card[] };
export function layoutCards(sections: SizeChartSection[]): Segment[][] {
  const remaining = sections.filter((s) => s.rows.length).map(cardOf);
  const pages: Segment[][] = [];
  const take = (i: number) => remaining.splice(i, 1)[0];
  while (remaining.length) {
    const page: Segment[] = [];
    let used = 0;
    // Full-width cards first, while they fit (always at least one per page).
    for (let i = 0; i < remaining.length; i++) {
      const h = remaining[i].height + GAP;
      if (remaining[i].full && (used + h <= PAGE_BODY_H || !page.length)) { page.push({ kind: 'full', card: take(i) }); used += h; i--; }
    }
    const left: Card[] = [], right: Card[] = [];
    let lh = 0, rh = 0;
    for (;;) {
      const sides = lh <= rh ? (['l', 'r'] as const) : (['r', 'l'] as const);
      let placed = false;
      for (const side of sides) {
        const sideH = side === 'l' ? lh : rh;
        const i = remaining.findIndex((c) => !c.full && used + sideH + c.height + GAP <= PAGE_BODY_H);
        if (i < 0) continue;
        const card = take(i);
        if (side === 'l') { left.push(card); lh += card.height + GAP; } else { right.push(card); rh += card.height + GAP; }
        placed = true;
        break;
      }
      if (!placed) break;
    }
    // A card taller than a whole page still gets a page of its own.
    if (!page.length && !left.length && remaining.length) left.push(take(0));
    if (left.length || right.length) page.push({ kind: 'pair', left, right });
    pages.push(page);
  }
  return pages;
}

function ShapeCard({ card, includePrices, showName, inStack }: { card: Card; includePrices: boolean; showName: boolean; inStack: boolean }) {
  const { section, columns: count } = card;
  const perColumn = Math.ceil(section.rows.length / count);
  const columns = Array.from({ length: count }, (_, index) => section.rows.slice(index * perColumn, (index + 1) * perColumn));
  return (
    <View style={inStack ? css.cardInStack : css.card} wrap={false}>
      <View style={css.cardHead}>
        {section.image && <Image src={section.image} style={css.image} />}
        {/* With one shape in the whole chart the name says nothing the photo
            beside it doesn't -- for round-only categories it is just "Round". */}
        <Text style={css.name}>{showName ? (section.name === 'Cushion Elongated' ? 'Long cushion' : section.name) : ''}</Text>
        <Text style={css.count}>{section.rows.length} {section.rows.length === 1 ? 'size' : 'sizes'}</Text>
      </View>
      <View style={css.columnsHead}>
        {columns.map((_, i) => <View key={i} style={css.columnHead}><Text>SIZE (MM)</Text><Text>{includePrices ? 'PRICE' : 'DEW'}</Text></View>)}
      </View>
      <View style={css.columns}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={[css.column, columnIndex === columns.length - 1 ? { borderRightWidth: 0 } : {}]}>
            {column.map((row, rowIndex) => (
              <View key={`${row.size}-${rowIndex}`} style={[css.cell, rowIndex % 2 ? css.cellAlt : {}]}>
                <Text style={css.size}>{row.size.replace(/x/g, ' x ')}</Text>
                {includePrices
                  ? <Text style={css.price}>{row.priceInr == null ? 'On request' : row.priceInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                  : row.pcsPerCt
                  ? <Text style={css.meta}>1ct = ~{row.pcsPerCt} pcs</Text>
                  : row.diamondEquivalentCt === null
                  ? <Text style={css.dash}>–</Text>
                  : <Text style={css.meta}>{formatDew(row.diamondEquivalentCt)}</Text>}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function SizeChartDocument({ sections, colors = [], categoryName = 'Moissanite', includePrices = false, logoUrl = '', priceUnit = null }: { sections: SizeChartSection[]; colors?: SizeChartColor[]; categoryName?: string; includePrices?: boolean; logoUrl?: string; priceUnit?: string | null }) {
  const pages = layoutCards(sections);
  const showName = sections.length > 1;
  const showColorPage = colors.length > 1;
  const totalPages = pages.length + (showColorPage ? 1 : 0);
  const categoryLabel = colors.length === 1 ? `${categoryName} - ${colors[0].name}` : categoryName;
  return (
    <Document title={`YOYO GEMS - ${categoryName} ${includePrices ? 'price list' : 'shapes and sizes'}`} author="YOYO GEMS">
      {showColorPage && <Page size="A4" style={css.page}>
        <PageWatermark />
        <View style={css.masthead}>
          <View style={css.brandBlock}>
            {logoUrl ? <Image src={logoUrl} style={css.brandLogo} /> : <Text style={css.brand}>YOYO GEMS</Text>}
            <Text style={css.strap}>{PDF_BRAND_TAGLINE}</Text>
          </View>
          <View style={css.titleBlock}>
            <Text style={css.title}>AVAILABLE COLORS</Text>
            <Text style={css.category}>{categoryName}</Text>
          </View>
        </View>
        <Text style={css.colorIntro}>The following {colors.length} colors are currently selected for this category. Images are visual references; final shade and availability are confirmed by our team.</Text>
        <View style={css.colorGrid}>
          {colors.map((color) => <View key={color.name} style={css.colorCard} wrap={false}>
            <View style={css.colorImageFrame}>
              {color.image ? <Image src={color.image} style={css.colorImage} /> : <View style={[css.colorSwatch, { backgroundColor: color.hex || '#f2f2f2' }]} />}
            </View>
            <Text style={css.colorName}>{color.name}</Text>
          </View>)}
        </View>
        <View style={css.footer} fixed>
          <Text>yoyogems.co.in  |  +91 9079914601  |  Jaipur</Text>
          <Text>1 / {totalPages}</Text>
        </View>
      </Page>}
      {pages.map((group, pageIndex) => (
        <Page key={pageIndex} size="A4" style={css.page}>
          <PageWatermark />
          <View style={css.masthead}>
            <View style={css.brandBlock}>
              {logoUrl ? <Image src={logoUrl} style={css.brandLogo} /> : <Text style={css.brand}>YOYO GEMS</Text>}
              <Text style={css.strap}>{PDF_BRAND_TAGLINE}</Text>
            </View>
            <View style={css.titleBlock}>
              <Text style={css.title}>{includePrices ? 'PRICE LIST' : 'SHAPE & SIZE CHART'}</Text>
              <Text style={css.category}>{categoryLabel}</Text>
            </View>
          </View>
          <View style={css.legend}>
            <Text>Dimensions in millimetres</Text>
            <Text>{includePrices ? `Prices in INR (Rs.) per ${priceUnitLabel(priceUnit)} - availability and final price confirmed by our team` : sections.some((s) => s.rows.some((r) => r.pcsPerCt)) ? 'DEW is approximate diamond-equivalent weight  |  1ct = ~pcs: approx. pieces per carat' : 'DEW is approximate diamond-equivalent weight'}</Text>
          </View>
          {group.map((segment, i) => segment.kind === 'full'
            ? <ShapeCard key={i} card={segment.card} includePrices={includePrices} showName={showName} inStack={false} />
            : <View key={i} style={css.segment}>
                {[segment.left, segment.right].map((stack, side) => (
                  <View key={side} style={css.stack}>
                    {stack.map((card) => <ShapeCard key={card.section.name} card={card} includePrices={includePrices} showName={showName} inStack />)}
                  </View>
                ))}
              </View>)}
          <View style={css.footer} fixed>
            <Text>yoyogems.co.in  |  +91 9079914601  |  Jaipur</Text>
            <Text>{pageIndex + 1 + (showColorPage ? 1 : 0)} / {totalPages}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
