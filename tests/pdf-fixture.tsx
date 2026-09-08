import assert from 'node:assert/strict';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import OrderPdfDocument from '../lib/pdf/OrderPdfDocument';
import PriceListPdfDocument from '../lib/pdf/PriceListPdfDocument';
async function check() {
  const order = await renderToBuffer(<OrderPdfDocument data={{
    orderId: 1, statusLabel: 'Placed', requestType: 'Request Quotation', createdAt: '2026-09-08T00:00:00Z',
    customerName: 'Test buyer', customerPhone: null, customerCompany: null, comment: null,
    items: [{ categoryName: 'Glass Pearls', shapeName: 'Round', sizeMm: '6', colorName: 'White', quantity: 500, unitPrice: 2, requestType: 'Request Quotation' }],
    contactWhatsapp: null, contactLocation: 'Jaipur'
  }} /> as any);
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
