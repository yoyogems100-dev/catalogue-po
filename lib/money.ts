// One rupee format for the whole requirement flow. The sticky bar, the cart
// and the review dialog each formatted the same total their own way, so one
// basket read ₹3,97,799.6 in one place and ₹3,97,800 in the next -- and
// rounding each line separately meant the lines didn't add up to the total.

/** Indian grouping; paise as two digits when there are any (₹14.30,
 *  ₹3,97,799.60), none when the amount is whole (₹14, ₹1,025). Exact, so
 *  line amounts always add up to the total shown under them. */
export function formatRupees(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return n.toLocaleString('en-IN', whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
