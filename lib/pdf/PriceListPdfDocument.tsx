import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

export type PriceListGroup = { id: number; name: string };
export type PriceListRow = { sizeMm: string; prices: Record<number, number | null> }; // groupId -> RMB price
export type PriceListShapeSection = { shapeName: string; rows: PriceListRow[] };

export type PriceListData = {
  categoryName: string;
  generatedAt: string;
  multiplier: number;
  groups: PriceListGroup[];
  sections: PriceListShapeSection[];
  logoUrl: string;
  contactWhatsapp: string | null;
  contactLocation: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 8.5, fontFamily: 'Helvetica', color: '#3A3F44' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#9C7A25',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
    marginBottom: 14
  },
  logo: { height: 30, width: 'auto' },
  docType: { fontSize: 15, color: '#9C7A25', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  docMeta: { fontSize: 8.5, color: '#756e5c', textAlign: 'right', marginTop: 2 },
  metaBar: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F3EFE4',
    paddingVertical: 6, paddingHorizontal: 10, marginBottom: 16
  },
  metaLabel: { fontSize: 7.5, color: '#6B5A3E', letterSpacing: 0.4 },
  metaValue: { fontSize: 9, color: '#12233F', fontFamily: 'Helvetica-Bold', marginTop: 1 },
  shapeHeading: {
    fontSize: 11, color: '#12233F', fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: '#9C7A25', borderLeftStyle: 'solid', paddingLeft: 6
  },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#12233F', paddingVertical: 5 },
  tableHeaderCell: { color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4ddc9', borderBottomStyle: 'solid', paddingVertical: 4 },
  tableRowAlt: { backgroundColor: '#FAF8F3' },
  sizeCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#12233F', textAlign: 'center' },
  priceCell: { textAlign: 'center' },
  priceRmb: { fontSize: 7.5, color: '#3A3F44' },
  priceInr: { fontSize: 7, color: '#9C7A25', fontFamily: 'Helvetica-Bold', marginTop: 1 },
  dash: { fontSize: 7.5, color: '#c9c2ac', textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7.5, color: '#756e5c',
    textAlign: 'center', borderTopWidth: 1, borderTopColor: '#e4ddc9', borderTopStyle: 'solid', paddingTop: 6
  }
});

function money(n: number | null, symbol: string) {
  if (n === null) return null;
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function PriceListPdfDocument({ data }: { data: PriceListData }) {
  const sizeColW = 12;
  const groupColW = data.groups.length > 0 ? (100 - sizeColW) / data.groups.length : 0;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={data.logoUrl} style={styles.logo} />
          <View>
            <Text style={styles.docType}>Price List</Text>
            <Text style={styles.docMeta}>
              Generated {new Date(data.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={styles.metaBar}>
          <View>
            <Text style={styles.metaLabel}>CATEGORY</Text>
            <Text style={styles.metaValue}>{data.categoryName}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>RMB &#8594; INR RATE</Text>
            <Text style={styles.metaValue}>1 RMB = &#8377;{data.multiplier}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>CURRENCY</Text>
            <Text style={styles.metaValue}>RMB (&#165;) with INR (&#8377;) equivalent</Text>
          </View>
        </View>

        {data.sections.map((section, si) => (
          <View key={si} wrap={false}>
            <Text style={styles.shapeHeading}>{section.shapeName}</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { width: `${sizeColW}%` }]}>Size (mm)</Text>
              {data.groups.map((g) => (
                <Text key={g.id} style={[styles.tableHeaderCell, { width: `${groupColW}%` }]}>{g.name}</Text>
              ))}
            </View>
            {section.rows.map((row, ri) => (
              <View key={ri} style={[styles.tableRow, ri % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.sizeCell, { width: `${sizeColW}%` }]}>{row.sizeMm}</Text>
                {data.groups.map((g) => {
                  const rmb = row.prices[g.id] ?? null;
                  return (
                    <View key={g.id} style={[styles.priceCell, { width: `${groupColW}%` }]}>
                      {rmb === null ? (
                        <Text style={styles.dash}>--</Text>
                      ) : (
                        <>
                          <Text style={styles.priceRmb}>{money(rmb, '¥')}</Text>
                          <Text style={styles.priceInr}>{money(rmb * data.multiplier, '₹')}</Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>
          {[data.contactLocation, data.contactWhatsapp ? `WhatsApp: ${data.contactWhatsapp}` : null].filter(Boolean).join('   ·   ')}
          {'\n'}Prices are indicative and subject to change without notice. This is a computer-generated document from YOYO GEMS.
        </Text>
      </Page>
    </Document>
  );
}
