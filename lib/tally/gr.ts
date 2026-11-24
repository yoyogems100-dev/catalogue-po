/** Voucher numbers marked GR — "8576(gr)", "GR", "gr(-5042 CASH)" — are goods returns, not sales. */
export function isGoodsReturn(vno: string): boolean {
  return /(^|[^a-z])gr([^a-z]|$)/i.test(vno);
}
