import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { PDF_BRAND_TAGLINE } from './brand';
import { PageWatermark } from './PageWatermark';
import { displaySize, type GSeriesGrid } from '../g-series-grid';

export type GSeriesSwatch = { code: string; name: string; image: string | null; hex: string | null };
export type GSeriesKeyGroup = { letter: string; title: string | null; colors: GSeriesSwatch[] };

export type GSeriesPriceListData = {
  categoryName: string;
  generatedAt: string;
  grid: GSeriesGrid;
  /** Colours per column letter, in the order of grid.columns. */
  keyGroups: GSeriesKeyGroup[];
  /** Colours the category offers that have no price on the sheet. */
  unpriced: GSeriesSwatch[];
  priceUnit: string;
  logoUrl: string;
  contactWhatsapp: string | null;
  contactLocation: string | null;
};

// One page, read at a glance: the price grid on top, the colour key under it.
// Each price column keeps one tint from header to key, the same cue the
// supplier sheet uses, so a colour's column is found by colour, not by hunting.
const TINTS: Record<string, { head: string; body: string; ink: string }> = {
  A: { head: '#DCE2EB', body: '#F3F5F8', ink: '#3A4A63' },
  B: { head: '#F7D9CF', body: '#FDF3EF', ink: '#8A3B22' },
  C: { head: '#E4E4E4', body: '#F6F6F6', ink: '#4A4A4A' },
  D: { head: '#F6E3A8', body: '#FDF8E8', ink: '#7A5A0E' },
  E: { head: '#CFE2F4', body: '#F0F6FC', ink: '#1E4E7C' }
};
const tint = (letter: string) => TINTS[letter] || { head: '#E6E6E6', body: '#F7F7F7', ink: '#3A3F44' };

const W = 595 - 2 * 22;
const KEY_LABEL_W = 58;
const KEY_PER_ROW = 6;
const KEY_TILE_W = (W - KEY_LABEL_W) / KEY_PER_ROW;

const s = StyleSheet.create({
  page: { paddingTop: 18, paddingHorizontal: 22, paddingBottom: 30, fontFamily: 'Helvetica', color: '#12233F', fontSize: 7.5 },
  mast: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 6, marginBottom: 8, borderBottomWidth: 1.5, borderBottomColor: '#9C7A25' },
  logo: { width: 132, height: 36, objectFit: 'contain', objectPosition: 'left center' },
  tagline: { fontSize: 5.8, color: '#756e5c', marginTop: 1 },
  titleBox: { alignItems: 'flex-end' },
  title: { fontFamily: 'Times-Bold', fontSize: 17, color: '#1B3A6B' },
  sub: { fontSize: 7, color: '#756e5c', marginTop: 1 },

  table: { borderWidth: 0.6, borderColor: '#cfd5de', borderRadius: 3, overflow: 'hidden' },
  headRow: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: '#1B3A6B' },
  famHead: { paddingVertical: 4, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12233F', borderRightWidth: 0.6, borderRightColor: '#2c4570' },
  famIcons: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  famIconRing: { width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  famIcon: { width: 11, height: 11, objectFit: 'contain' },
  famName: { color: '#fff', fontSize: 6.3, fontFamily: 'Helvetica-Bold', textAlign: 'center', lineHeight: 1.2 },
  colHead: { flex: 1, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRightWidth: 0.6, borderRightColor: '#fff' },
  letter: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  colTitle: { fontSize: 6, marginTop: 0.5 },
  thumbs: { flexDirection: 'row', gap: 1.5, marginTop: 2.5 },
  thumb: { width: 11, height: 11, minHeight: 11, flexShrink: 0, borderRadius: 2, objectFit: 'cover' },
  row: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: '#e3e7ec', height: 19.5 },
  sizeCell: { justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.6, borderRightColor: '#e3e7ec' },
  size: { fontFamily: 'Helvetica-Bold', fontSize: 9.2, color: '#12233F' },
  priceCell: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.6, borderRightColor: '#fff' },
  price: { fontFamily: 'Helvetica-Bold', fontSize: 10.4 },
  dash: { color: '#b9bfc8', fontSize: 9 },

  keyTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 11, marginBottom: 4 },
  keyTitle: { fontFamily: 'Times-Bold', fontSize: 11, color: '#1B3A6B' },
  keyHint: { fontSize: 6.3, color: '#756e5c' },
  keyGroup: { flexDirection: 'row', marginBottom: 3.5, borderRadius: 3, overflow: 'hidden' },
  keyLabel: { width: KEY_LABEL_W, paddingVertical: 3, paddingHorizontal: 5, justifyContent: 'center' },
  keyLetter: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  keyLabelSub: { fontSize: 5.6, marginTop: 0.5 },
  keyTiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 1.5 },
  tile: { width: KEY_TILE_W, height: 24.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3 },
  tileImg: { width: 21, height: 21, borderRadius: 2.5, objectFit: 'cover', marginRight: 3.5 },
  tileSwatch: { width: 21, height: 21, borderRadius: 2.5, marginRight: 3.5 },
  tileText: { flex: 1 },
  tileCode: { fontFamily: 'Helvetica-Bold', fontSize: 7.3, color: '#12233F' },
  tileName: { fontSize: 6, color: '#4a4f57', lineHeight: 1.1 },

  footer: { position: 'absolute', bottom: 12, left: 22, right: 22, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#cfd5de', paddingTop: 4, fontSize: 6, color: '#62666d' }
});

function Swatch({ c }: { c: GSeriesSwatch }) {
  return (
    <View style={s.tile}>
      {c.image ? <Image src={c.image} style={s.tileImg} /> : <View style={[s.tileSwatch, { backgroundColor: c.hex || '#ddd' }]} />}
      <View style={s.tileText}>
        <Text style={s.tileCode}>{c.code}</Text>
        <Text style={s.tileName} hyphenationCallback={(word) => [word]}>{c.name}</Text>
      </View>
    </View>
  );
}

export default function GSeriesPriceListDocument({ data }: { data: GSeriesPriceListData }) {
  const { grid } = data;
  // Size columns take what the five price columns leave, split evenly.
  const famW = grid.families.length ? Math.min(96, (W * 0.42) / grid.families.length) : 0;
  const date = new Date(data.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const hasRound = grid.families.some((f) => f.shapes.some((sh) => sh.name === 'Round'));

  return (
    <Document title={`${data.categoryName} G-Series price list`} author="YOYO GEMS">
      <Page size="A4" style={s.page}>
        <PageWatermark />
        <View style={s.mast}>
          <View>
            {data.logoUrl ? <Image src={data.logoUrl} style={s.logo} /> : <Text style={s.title}>YOYO GEMS</Text>}
            <Text style={s.tagline}>{PDF_BRAND_TAGLINE}</Text>
          </View>
          <View style={s.titleBox}>
            <Text style={s.title}>Ice Cut · G Series Price List</Text>
            <Text style={s.sub}>{data.categoryName} · price per {data.priceUnit} · {date}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.headRow}>
            {grid.families.map((f, i) => (
              <View key={i} style={[s.famHead, { width: famW }]}>
                <View style={s.famIcons}>
                  {f.shapes.map((sh) => (
                    <View key={sh.name} style={s.famIconRing}>{sh.image ? <Image src={sh.image} style={s.famIcon} /> : null}</View>
                  ))}
                </View>
                <Text style={s.famName}>{f.shapes.map((sh) => sh.name).join(' · ')}</Text>
              </View>
            ))}
            {grid.columns.map((c, ci) => {
              const t = tint(c.letter);
              const thumbs = (data.keyGroups[ci]?.colors || []).filter((x) => x.image).slice(0, 5);
              return (
                <View key={c.id} style={[s.colHead, { backgroundColor: t.head }]}>
                  <Text style={[s.letter, { color: t.ink }]}>{c.letter}</Text>
                  <Text style={[s.colTitle, { color: t.ink }]}>{c.title || `${data.keyGroups[ci]?.colors.length || 0} colours`}</Text>
                  <View style={s.thumbs}>{thumbs.map((x) => <Image key={x.code} src={x.image!} style={s.thumb} />)}</View>
                </View>
              );
            })}
          </View>
          {grid.rows.map((r, ri) => (
            <View key={ri} style={[s.row, ri === grid.rows.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
              {r.sizes.map((list, fi) => (
                <View key={fi} style={[s.sizeCell, { width: famW, backgroundColor: ri % 2 ? '#F6F7F9' : '#fff' }]}>
                  <Text style={list.length ? s.size : s.dash}>{list.length ? list.map(displaySize).join(', ') : '–'}</Text>
                </View>
              ))}
              {r.prices.map((p, pi) => {
                const t = tint(grid.columns[pi].letter);
                return (
                  <View key={pi} style={[s.priceCell, { backgroundColor: ri % 2 ? t.head : t.body }]}>
                    {p === null ? <Text style={s.dash}>–</Text> : <Text style={[s.price, { color: t.ink }]}>{p.toLocaleString('en-IN')}</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={s.keyTitleRow}>
          <Text style={s.keyTitle}>Colour codes</Text>
          <Text style={s.keyHint}>Find the colour, read its letter, then the price in that column.</Text>
        </View>
        {data.keyGroups.map((g) => {
          const t = tint(g.letter);
          return (
            <View key={g.letter} style={[s.keyGroup, { backgroundColor: t.body }]} wrap={false}>
              <View style={[s.keyLabel, { backgroundColor: t.head }]}>
                <Text style={[s.keyLetter, { color: t.ink }]}>{g.letter}</Text>
                <Text style={[s.keyLabelSub, { color: t.ink }]}>{g.title || `${g.colors.length} colours`}</Text>
              </View>
              <View style={s.keyTiles}>{g.colors.map((c) => <Swatch key={c.code} c={c} />)}</View>
            </View>
          );
        })}
        {data.unpriced.length > 0 && (
          <View style={[s.keyGroup, { backgroundColor: '#FAFAFA' }]} wrap={false}>
            <View style={[s.keyLabel, { backgroundColor: '#ECECEC' }]}>
              <Text style={[s.keyLetter, { color: '#8a8f97' }]}>–</Text>
              <Text style={[s.keyLabelSub, { color: '#62666d' }]}>Price –</Text>
            </View>
            <View style={s.keyTiles}>{data.unpriced.map((c) => <Swatch key={c.code} c={c} />)}</View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>{hasRound ? 'Round: 4×4 means 4 mm, and so on.   ' : ''}Prices are subject to change; availability is confirmed with your order.</Text>
          <Text>{[data.contactWhatsapp ? `WhatsApp ${data.contactWhatsapp}` : null, data.contactLocation].filter(Boolean).join(' · ')}</Text>
        </View>
      </Page>
    </Document>
  );
}
