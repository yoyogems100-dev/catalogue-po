// The Tally snapshot the owner uploads as an Excel file, reduced to a compact
// shape the browser can search instantly. Rows are short arrays (not objects)
// and parties/items are stored once and referred to by index, which keeps the
// whole year's data small enough to send in one gzipped response.
//
// This data is private business accounting. It lives only in the private
// `tally` storage bucket (never in Git, never in a public table) and is served
// only to someone holding both the admin cookie and the Tally cookie.

export type DrCr = 'Dr' | 'Cr' | '';

export type TallyParty = {
  name: string;
  group: string; // Tally ledger group, e.g. Sundry Debtors
  role: string; // Customer / Supplier / Both / '' (from the Excel extract)
  state: string;
  address: string;
  opening: number;
  openingType: DrCr;
  closing: number;
  closingType: DrCr;
  purchased: number; // goods we bought from them
  sold: number; // goods we sold to them
  paidNoStock: number; // money we paid them
  receivedNoStock: number; // money they paid us
  vouchers: number;
  lastTxn: string; // YYYY-MM-DD or ''
};

/** [date, voucherNo, partyIndex, itemIndex, qty, unit, rate, amount, narration] */
export type TallyLine = [string, string, number, number, number, string, number, number, string];

/** [date, type, voucherNo, partyIndex, partyGroup, amount, stockLines, stockValue, otherLedgers, narration] */
export type TallyVoucher = [string, string, string, number, string, number, number, number, string, string];

/**
 * [name, group, unit, openingQty, openingValue, closingQty, closingValue,
 *  boughtQty, boughtValue, lastBuyRate, lastBuyDate, soldQty, soldValue, lastSellRate, lastSellDate]
 */
export type TallyStock = [string, string, string, number, number, number, number, number, number, number, string, number, number, number, string];

/** [name, group, state, closing, closingType] for ledgers that are not parties (bank, cash, expenses...). */
export type TallyLedger = [string, string, string, number, DrCr];

export type TallyData = {
  version: 1;
  meta: {
    company: string;
    note: string; // the extract's own heading line, e.g. period covered
    fileName: string;
    uploadedAt: string; // ISO
    firstDate: string;
    lastDate: string;
  };
  parties: TallyParty[]; // parties[i] referred to by index in lines/vouchers; extra names appended if a line names an unlisted party
  items: string[]; // item names referred to by index in lines
  sales: TallyLine[]; // goods out to customers
  purchases: TallyLine[]; // goods in from suppliers
  /** Goods-out lines whose voucher number is marked GR (e.g. "8576(gr)"): goods returned, not sales. */
  returns: TallyLine[];
  vouchers: TallyVoucher[];
  stock: TallyStock[];
  ledgers: TallyLedger[];
};
