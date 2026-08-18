import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export type PdfItem = {
  categoryName: string;
  shapeName: string;
  sizeMm: string;
  colorName: string;
  quantity: number;
  unitPrice: number | null;
  requestType: string;
};

export type PdfOrderData = {
  orderId: number;
  statusLabel: string;
  requestType: string;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerCompany: string | null;
  comment: string | null;
  items: PdfItem[];
  contactWhatsapp: string | null;
  contactLocation: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#3A3F44' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#9C7A25',
    borderBottomStyle: 'solid',
    paddingBottom: 14,
    marginBottom: 18
  },
  brand: { fontSize: 20, color: '#1B3A6B', fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  tagline: { fontSize: 8.5, color: '#8a8370', marginTop: 2 },
  docType: { fontSize: 14, color: '#9C7A25', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  docMeta: { fontSize: 9, color: '#8a8370', textAlign: 'right', marginTop: 2 },
  metaGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metaBlock: { flexDirection: 'column', maxWidth: '48%' },
  metaLabel: { fontSize: 7.5, color: '#9C7A25', letterSpacing: 0.5, marginBottom: 3 },
  metaValue: { fontSize: 10.5, color: '#12233F', marginBottom: 2 },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#12233F', paddingVertical: 7, paddingHorizontal: 6 },
  tableHeaderCell: { color: '#fff', fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e4ddc9',
    borderBottomStyle: 'solid',
    paddingVertical: 7,
    paddingHorizontal: 6
  },
  cell: { fontSize: 9.5 },
  totalsBlock: { marginTop: 14, alignItems: 'flex-end' },
  grandTotalRow: {
    flexDirection: 'row',
    width: 220,
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#12233F',
    borderTopStyle: 'solid'
  },
  grandTotalLabel: { fontSize: 11, color: '#12233F', fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 11, color: '#12233F', fontFamily: 'Helvetica-Bold' },
  comment: { marginTop: 16, fontSize: 9.5, color: '#3A3F44' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#8a8370',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e4ddc9',
    borderTopStyle: 'solid',
    paddingTop: 8
  }
});

const COLS_NO_PRICE = { type: 0.1, category: 0.22, shape: 0.2, size: 0.13, color: 0.17, qty: 0.18 };
const COLS_WITH_PRICE = { type: 0.08, category: 0.16, shape: 0.14, size: 0.1, color: 0.13, qty: 0.12, price: 0.13, total: 0.14 };

function money(n: number) {
  return `Rs. ${n.toLocaleString('en-IN')}`;
}

export default function OrderPdfDocument({ data }: { data: PdfOrderData }) {
  const hasPricing = data.items.some((i) => i.unitPrice != null);
  const grandTotal = hasPricing ? data.items.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0) : null;
  const cols: Record<string, number> = hasPricing ? COLS_WITH_PRICE : COLS_NO_PRICE;
  const distinctTypes = new Set(data.items.map((i) => i.requestType));
  const docTitle =
    distinctTypes.size > 1
      ? 'Order Summary & Quotation'
      : data.requestType === 'Request Quotation'
      ? 'Quotation'
      : 'Order Summary';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>YOYO GEMS</Text>
            <Text style={styles.tagline}>Synthetic Gemstones. Infinite Choices. One Trusted Name.</Text>
          </View>
          <View>
            <Text style={styles.docType}>{docTitle}</Text>
            <Text style={styles.docMeta}>Order #{data.orderId}</Text>
            <Text style={styles.docMeta}>
              {new Date(data.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>CUSTOMER</Text>
            <Text style={styles.metaValue}>{data.customerName || 'N/A'}</Text>
            {data.customerCompany && <Text style={styles.metaValue}>{data.customerCompany}</Text>}
            {data.customerPhone && <Text style={styles.metaValue}>{data.customerPhone}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>STATUS</Text>
            <Text style={styles.metaValue}>{data.statusLabel}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: `${cols.type * 100}%` }]}>Type</Text>
            <Text style={[styles.tableHeaderCell, { width: `${cols.category * 100}%` }]}>Category</Text>
            <Text style={[styles.tableHeaderCell, { width: `${cols.shape * 100}%` }]}>Shape</Text>
            <Text style={[styles.tableHeaderCell, { width: `${cols.size * 100}%` }]}>Size</Text>
            <Text style={[styles.tableHeaderCell, { width: `${cols.color * 100}%` }]}>Color</Text>
            <Text style={[styles.tableHeaderCell, { width: `${cols.qty * 100}%`, textAlign: 'right' }]}>Qty</Text>
            {hasPricing && <Text style={[styles.tableHeaderCell, { width: `${cols.price * 100}%`, textAlign: 'right' }]}>Price</Text>}
            {hasPricing && <Text style={[styles.tableHeaderCell, { width: `${cols.total * 100}%`, textAlign: 'right' }]}>Total</Text>}
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.cell, { width: `${cols.type * 100}%` }]}>{item.requestType === 'Request Quotation' ? 'RQ' : 'Order'}</Text>
              <Text style={[styles.cell, { width: `${cols.category * 100}%` }]}>{item.categoryName}</Text>
              <Text style={[styles.cell, { width: `${cols.shape * 100}%` }]}>{item.shapeName}</Text>
              <Text style={[styles.cell, { width: `${cols.size * 100}%` }]}>{item.sizeMm} mm</Text>
              <Text style={[styles.cell, { width: `${cols.color * 100}%` }]}>{item.colorName}</Text>
              <Text style={[styles.cell, { width: `${cols.qty * 100}%`, textAlign: 'right' }]}>{item.quantity.toLocaleString('en-IN')}</Text>
              {hasPricing && (
                <Text style={[styles.cell, { width: `${cols.price * 100}%`, textAlign: 'right' }]}>
                  {item.unitPrice != null ? money(item.unitPrice) : '-'}
                </Text>
              )}
              {hasPricing && (
                <Text style={[styles.cell, { width: `${cols.total * 100}%`, textAlign: 'right' }]}>
                  {item.unitPrice != null ? money(item.unitPrice * item.quantity) : '-'}
                </Text>
              )}
            </View>
          ))}
        </View>

        {hasPricing && grandTotal !== null && (
          <View style={styles.totalsBlock}>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{money(grandTotal)}</Text>
            </View>
          </View>
        )}

        {data.comment && <Text style={styles.comment}>Note: {data.comment}</Text>}

        <Text style={styles.footer}>
          {[data.contactLocation, data.contactWhatsapp ? `WhatsApp: ${data.contactWhatsapp}` : null].filter(Boolean).join('   ·   ')}
          {'\n'}This is a computer-generated document from YOYO GEMS.
        </Text>
      </Page>
    </Document>
  );
}
