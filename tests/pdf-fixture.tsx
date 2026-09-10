import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import OrderPdfDocument from '../lib/pdf/OrderPdfDocument';
import PriceListPdfDocument from '../lib/pdf/PriceListPdfDocument';
async function check() {
  const order = await renderToBuffer(<OrderPdfDocument data={{
    orderId: 1, statusLabel: 'Placed', requestType: 'Request Quotation', createdAt: '2026-09-08T00:00:00Z',
    customerName: 'Test buyer', customerPhone: null, customerCompany: null, comment: 'Pack each size separately.', paymentStatus: 'partial',
    notes: [{ message: 'Price confirmed for the white beads. Please confirm the second line.', created_at: '2026-09-10T00:00:00Z' }],
    items: [{ categoryName: 'Glass Pearls', shapeName: 'Round', sizeMm: '6', colorName: 'White', quantity: 500, unitPrice: 2, requestType: 'Request Quotation' },
      { categoryName: 'Glass Pearls', shapeName: 'Oval', sizeMm: '4x6', colorName: 'Blue', quantity: 200, unitPrice: null, requestType: 'Place Order' }],
    contactWhatsapp: null, contactLocation: 'Jaipur'
  }} /> as any);
  if (process.env.PDF_QA_OUTPUT) writeFileSync(process.env.PDF_QA_OUTPUT, order);
  const prices = await renderToBuffer(<PriceListPdfDocument data={{
    categoryName: 'Glass Pearls', generatedAt: '2026-09-08T00:00:00Z', multiplier: 12,
    groups: [{ id: 1, name: 'White' }], sections: [{ shapeName: 'Round', rows: [{ sizeMm: '6', prices: { 1: 2 } }] }],
    logoUrl: '', contactWhatsapp: null, contactLocation: null
  }} /> as any);
  for (const buffer of [order, prices]) {
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buffer.length > 1000);
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; });
