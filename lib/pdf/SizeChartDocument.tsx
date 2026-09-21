import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { PDF_BRAND_TAGLINE } from './brand';
import { priceUnitLabel } from '../price-unit';

export type SizeChartSection = {
  name: string;
  image: string | null;
  rows: { size: string; diamondEquivalentCt: number | null; priceInr?: number | null }[];
};
export type SizeChartColor = { name: string; hex: string | null; image: string | null };

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
  sectionStack: { flexDirection: 'column', gap: 9 },
  section: { height: 325, flexDirection: 'row', borderWidth: .8, borderColor: '#b9c1cc', backgroundColor: '#fff' },
  identity: { width: 98, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#e5edf6', borderRightWidth: .8, borderRightColor: '#b9c1cc' },
  imageFrame: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  image: { width: 62, height: 62, objectFit: 'contain' },
  vectorFallback: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderWidth: .8, borderColor: '#8995a6', color: '#8995a6', fontSize: 6 },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, textAlign: 'center', lineHeight: 1.25 },
  values: { flex: 1, minWidth: 0 },
  valuesHead: { height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, backgroundColor: '#12233f', color: '#fff' },
  valuesTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7.2, letterSpacing: .5 },
  valuesCount: { color: '#d8bf73', fontSize: 6.2 },
  columns: { flex: 1, flexDirection: 'row' },
  column: { flex: 1, borderRightWidth: .45, borderRightColor: '#d6dbe2' },
  cell: { minHeight: 15.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 6, borderBottomWidth: .35, borderBottomColor: '#d6dbe2' },
  cellAlt: { backgroundColor: '#f7f9fb' },
  size: { fontFamily: 'Helvetica-Bold', fontSize: 6.9 },
  meta: { color: '#62666d', fontSize: 6.2, textAlign: 'right' },
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

function formatDew(value: number | null) {
  if (value === null) return 'DEW -';
  return `${value.toFixed(value < .1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '')} ct`;
}

function sectionColumns(rows: SizeChartSection['rows']) {
  const count = rows.length > 54 ? 4 : rows.length > 34 ? 3 : 2;
  const perColumn = Math.ceil(rows.length / count);
  return Array.from({ length: count }, (_, index) => rows.slice(index * perColumn, (index + 1) * perColumn));
}

function ShapeSection({ section, includePrices, showName }: { section: SizeChartSection; includePrices: boolean; showName: boolean }) {
  const columns = sectionColumns(section.rows);
  return (
    <View style={css.section} wrap={false}>
      <View style={css.identity}>
        <View style={css.imageFrame}>
          {section.image ? <Image src={section.image} style={css.image} /> : <View style={css.vectorFallback}><Text>VECTOR REFERENCE</Text></View>}
        </View>
        {/* With one shape in the whole chart the name says nothing the photo
            above it doesn't -- and for the round-only categories it is just
            the word "Round" over the only table on the page. */}
        {showName && <Text style={css.name}>{section.name === 'Cushion Elongated' ? 'Long cushion' : section.name}</Text>}
      </View>
      <View style={css.values}>
        <View style={css.valuesHead}>
          <Text style={css.valuesTitle}>{includePrices ? 'SIZE (MM) AND PRICE' : 'AVAILABLE SIZE (MM) AND DEW'}</Text>
          <Text style={css.valuesCount}>{section.rows.length} sizes</Text>
        </View>
        <View style={css.columns}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={[css.column, columnIndex === columns.length - 1 ? { borderRightWidth: 0 } : {}]}>
              {column.map((row, rowIndex) => (
                <View key={`${row.size}-${rowIndex}`} style={[css.cell, rowIndex % 2 ? css.cellAlt : {}]}>
                  <Text style={css.size}>{row.size.replace(/x/g, ' x ')}</Text>
                  {includePrices
                    ? <Text style={css.price}>{row.priceInr == null ? 'On request' : row.priceInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                    : <Text style={css.meta}>{formatDew(row.diamondEquivalentCt)}</Text>}
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function SizeChartDocument({ sections, colors = [], categoryName = 'Moissanite', includePrices = false, logoUrl = '', priceUnit = null }: { sections: SizeChartSection[]; colors?: SizeChartColor[]; categoryName?: string; includePrices?: boolean; logoUrl?: string; priceUnit?: string | null }) {
  const pages = Array.from({ length: Math.ceil(sections.length / 2) }, (_, index) => sections.slice(index * 2, (index + 1) * 2));
  const showColorPage = colors.length > 1;
  const totalPages = pages.length + (showColorPage ? 1 : 0);
  const categoryLabel = colors.length === 1 ? `${categoryName} - ${colors[0].name}` : categoryName;
  return (
    <Document title={`YOYO GEMS - ${categoryName} ${includePrices ? 'price list' : 'shapes and sizes'}`} author="YOYO GEMS">
      {showColorPage && <Page size="A4" style={css.page}>
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
            <Text>{includePrices ? `Prices in INR (Rs.) per ${priceUnitLabel(priceUnit)} - availability and final price confirmed by our team` : 'DEW is approximate diamond-equivalent weight'}</Text>
          </View>
          <View style={css.sectionStack}>
            {group.map((section) => <ShapeSection key={section.name} section={section} includePrices={includePrices} showName={sections.length > 1} />)}
          </View>
          <View style={css.footer} fixed>
            <Text>yoyogems.co.in  |  +91 9079914601  |  Jaipur</Text>
            <Text>{pageIndex + 1 + (showColorPage ? 1 : 0)} / {totalPages}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
