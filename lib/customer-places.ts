// Where a customer is based. Any place can be saved (a small town, a city
// abroad); this list only feeds the suggestions in the Place box.
//
// Tier 1 and tier 2 cities as classified by the Government of India (7th Pay
// Commission HRA "X" and "Y" cities), plus a few gem and jewellery centres.
// Once a place is saved on any customer it is suggested and filterable too.
export const TIER_1_CITIES = ['Ahmedabad', 'Bengaluru', 'Chennai', 'Delhi', 'Hyderabad', 'Kolkata', 'Mumbai', 'Pune'] as const;

export const TIER_2_CITIES = [
  'Agra', 'Ajmer', 'Aligarh', 'Amravati', 'Amritsar', 'Anand', 'Asansol', 'Aurangabad', 'Bareilly', 'Belagavi',
  'Bhavnagar', 'Bhilai', 'Bhiwandi', 'Bhopal', 'Bhubaneswar', 'Bikaner', 'Bilaspur', 'Bokaro', 'Chandigarh', 'Coimbatore',
  'Cuttack', 'Dehradun', 'Dhanbad', 'Durgapur', 'Erode', 'Faridabad', 'Firozabad', 'Ghaziabad', 'Gorakhpur', 'Guntur',
  'Gurugram', 'Guwahati', 'Gwalior', 'Hamirpur', 'Hubballi-Dharwad', 'Indore', 'Jabalpur', 'Jaipur', 'Jalandhar', 'Jammu',
  'Jamnagar', 'Jamshedpur', 'Jhansi', 'Jodhpur', 'Kakinada', 'Kalaburagi', 'Kannur', 'Kanpur', 'Karnal', 'Kochi',
  'Kolhapur', 'Kollam', 'Kota', 'Kozhikode', 'Kurnool', 'Lucknow', 'Ludhiana', 'Madurai', 'Malappuram', 'Mangaluru',
  'Mathura', 'Meerut', 'Moradabad', 'Mysuru', 'Nagpur', 'Nanded', 'Nashik', 'Nellore', 'Noida', 'Patna',
  'Prayagraj', 'Puducherry', 'Purulia', 'Raipur', 'Rajahmundry', 'Rajkot', 'Ranchi', 'Ratlam', 'Rourkela', 'Salem',
  'Sangli', 'Shimla', 'Siliguri', 'Solapur', 'Srinagar', 'Surat', 'Thanjavur', 'Thiruvananthapuram', 'Thrissur', 'Tiruchirappalli',
  'Tirunelveli', 'Tiruvannamalai', 'Ujjain', 'Vadodara', 'Varanasi', 'Vasai-Virar', 'Vellore', 'Vijayapura', 'Vijayawada', 'Visakhapatnam',
  'Warangal'
] as const;

const TRADE_CENTRES = ['Navi Mumbai', 'Thane', 'Udaipur'] as const;

export const SUGGESTED_PLACES: readonly string[] = [...new Set<string>([...TIER_1_CITIES, ...TIER_2_CITIES, ...TRADE_CENTRES])]
  .sort((a, b) => a.localeCompare(b));

export const PLACE_MAX = 60;

const byLower = new Map(SUGGESTED_PLACES.map((p) => [p.toLowerCase(), p]));
// Old spellings people still type.
const ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru', bombay: 'Mumbai', calcutta: 'Kolkata', madras: 'Chennai', 'new delhi': 'Delhi', gurgaon: 'Gurugram',
  allahabad: 'Prayagraj', mysore: 'Mysuru', mangalore: 'Mangaluru', trivandrum: 'Thiruvananthapuram', cochin: 'Kochi',
  vizag: 'Visakhapatnam', baroda: 'Vadodara', pondicherry: 'Puducherry', calicut: 'Kozhikode', trichy: 'Tiruchirappalli',
  belgaum: 'Belagavi', gulbarga: 'Kalaburagi', hubli: 'Hubballi-Dharwad', bijapur: 'Vijayapura', banaras: 'Varanasi'
};

/** One spelling per place, so "jodhpur", " JODHPUR " and "Jodhpur" are the same
 *  customer group. Empty or unusable input gives null. */
export function canonicalPlace(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const clean = input.replace(/\s+/g, ' ').trim().slice(0, PLACE_MAX);
  if (!clean) return null;
  const lower = clean.toLowerCase();
  const known = byLower.get(lower) || ALIASES[lower];
  if (known) return known;
  // Title case what the team typed, keeping short all-caps words (e.g. "UAE").
  return clean.split(' ').map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
}

/** Suggestions for the Place box: the city list plus places already in use. */
export function placeSuggestions(used: readonly string[]): string[] {
  return [...new Set([...SUGGESTED_PLACES, ...used])].sort((a, b) => a.localeCompare(b));
}
