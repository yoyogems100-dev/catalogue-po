'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import OrderReferenceCarousel from './OrderReferenceCarousel';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';
import SpecialOrderComposer from './SpecialOrderComposer';
import { photoForHoles, type HoleCount } from '@/lib/drill-data';
import {specialCategory,specKey,specText,quantityFactor,categoryGrades,gradeSpec,caratSpec,caratsFor,drilledHoles,type OrderSpecs} from '@/lib/order-specs';
import { fieldHidden, type FormFields } from '@/lib/form-fields';
import { useCategoryQualities, useOrderPreferences, useShapeQualities } from './useOrderPreferences';
import { pickQualities, lineQualities, type ShapeQualities } from '@/lib/qualities';
import IconSelect from './IconSelect';
import { allowedColorsOf, facetAvailability, keepAvailable, pickedSizeRows, sizeGroupsOf } from '@/lib/faceted-picker';
import { incompatibleShapeIds, NO_SHARED_SIZE_NOTE, NO_SHARED_SIZE_REASON } from '@/lib/shape-size-compat';
import ColorSwatch from './ColorSwatch';
import ShapeReferenceImage from './ShapeReferenceImage';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { cartLinePrice } from '@/lib/pricing-calc';
import { expandQtyShorthand, parseQuantity } from '@/lib/quantity';
import { shapeAbbrevs } from '@/lib/shape-abbrev';
import { loadCart, saveCart, mergeIntoCart as mergeCartLines, QUOTATIONS_ENABLED, type CartItem, type RequestType } from '@/lib/cart-storage';
import SizeGridComposer, { countLabel, gridLines, gridHasError, type GridEntries } from './SizeGridComposer';
import { priceUnitLabel } from '@/lib/price-unit';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { formatRupees } from '@/lib/money';
import { formatQty, formatQtyTotals, rememberedQty, rememberQty, type QuantityField } from '@/lib/quantity-field';
import { SWISS_CATEGORY_ID, swissSizeLabel } from '@/lib/swiss-weights';
import { VOICE_ORDER_OPEN_EVENT, MicIcon } from './VoiceOrderButton';
import SizeQtyTable from './SizeQtyTable';
import PasteListDialog from './PasteListDialog';
import StoneSwitch, { PICK_COLOR_KEY } from './StoneSwitch';
import type { PastedLine } from '@/lib/paste-order';
import { LINE_NOTE_MAX } from '@/lib/line-note';
import { tableGroups, tableHasError, tableLines, tableSizeCount, type TableEntries } from '@/lib/size-table';

const CRUSHED_ICE_CATEGORY_ID = 1;

// Glass Pearls only ever comes in round -- the shape field is redundant noise for
// customers here, so it's hidden entirely and silently locked to Round rather than
// shown as a fixed/disabled field (contrast with Moissanite's locked color, which
// customers do still need to see spelled out).
const GLASS_PEARLS_CATEGORY_ID = 16;
// Moissanite is ordered size by size from a grid (components/SizeGridComposer):
// buyers send lists like 0.7 mm 20 ct, 1 mm 100 ct, so each size takes its own
// amount instead of one quantity shared by every picked size.
const SIZE_GRID_CATEGORY_ID = 34;
const SIZE_ENTRY_KEY = 'yoyo-size-entry';

type ShapeRef = { id: number; name: string; iconKey?: string | null; shortCode?: string | null; refPhotoUrl?: string | null; holePhotos?: Partial<Record<HoleCount, string>> };
type ColorRef = { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null };
/** pcs_per_ct: set on sizes sold by carat (Moissanite melee) -- pieces in 1 ct. */
type Size = { id: number; shape_id: number; size_mm: string; pcs_per_ct?: number | null };

type ColorPalette = { id: number; name: string; memberIds: number[] };

// "2 shapes · 7 sizes" when the lines span shapes; null for one shape, where
// the button's own count says it all.
function gridSummary(lines: { shape: { id: number } }[]) {
  const shapes = new Set(lines.map((l) => l.shape.id)).size;
  return shapes > 1 ? `${shapes} shapes · ${lines.length} sizes` : null;
}

export default function POSelector({
  categoryId,
  categoryName,
  whatsappNumber,
  shapes: allShapes,
  colors: allColors,
  sizes,
  colorPalettes,
  photos = [],
  colorChartUrl,
  loggedIn = false,
  active = true,
  pricing,
  priceUnit,
  optionLabel,
  sizeColors,
  quantityField,
  qualities,
  formFields,
  shapeQualities
}: {
  categoryId: number;
  categoryName: string;
  whatsappNumber?: string;
  shapes: ShapeRef[];
  colors: ColorRef[];
  sizes: Size[];
  active?: boolean;
  photos?: OrderReferencePhoto[];
  colorChartUrl?: string | null;
  loggedIn?: boolean;
  colorPalettes?: ColorPalette[];
  pricing?: CategoryPricing;
  priceUnit?: string | null;
  /** What the "Color" field is called here ("Material" for Semi Precious Beads). */
  optionLabel?: string | null;
  /** [shape_size_id, color_id] pairs this category offers. Empty means every
      colour comes in every size, the rule for every other category. */
  sizeColors?: [number, number][];
  /** What the quantity field is called and starts on ("No. of Lines", 5). */
  quantityField?: QuantityField;
  /** The qualities this category offers, as the page rendered them. */
  qualities?: string[];
  /** Field names and hidden fields set on the category's admin Overview. */
  formFields?: FormFields;
  /** Shapes/cuts here with their own qualities (Green OSP HW: 3A / AA). */
  shapeQualities?: Record<number, string[]>;
}) {
  // Swiss High Density CZ is White Round only: both are shown as fixed,
  // pre-chosen fields. The category's other colour links stay in the data
  // (Explore Photos still uses them); only this order form narrows them.
  const swiss = categoryId === SWISS_CATEGORY_ID;
  const shapes = useMemo(() => {
    const round = swiss ? allShapes.filter((s) => s.name === 'Round') : [];
    return round.length ? round : allShapes;
  }, [swiss, allShapes]);
  const colors = useMemo(() => {
    const white = swiss ? allColors.filter((c) => c.name === 'White') : [];
    return white.length ? white : allColors;
  }, [swiss, allColors]);
  // Picked once and shown read-only: Moissanite's White (DEF), Swiss's White.
  const colorLocked = categoryId === 34 || (swiss && colors.length === 1);
  const shapeLocked = swiss && shapes.length === 1;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // The server renders this category's price list, so its own lines are priced
  // on first paint with no flash. Lines the buyer added in OTHER categories are
  // priced from lists fetched here -- without them the same basket showed a
  // total on one category page and nothing at all on the next.
  const [otherPricing, setOtherPricing] = useState<Record<number, CategoryPricing>>({});
  // Multi-select: an order line can now cover several shapes, colors, and
  // sizes at once -- "Add line" fans out into one cart line per
  // shape x color x size combination.
  const [pickShapeIds, setPickShapeIds] = useState<number[]>([]);
  const [pickColorIds, setPickColorIds] = useState<number[]>([]);
  const [pickSizeIdxs, setPickSizeIdxs] = useState<number[]>([]);
  // After a line is added every pick stays, and the first new pick in a field
  // replaces its old value (Round -> Star) rather than adding to it.
  const NO_SWAP = { shape: false, size: false, color: false };
  const [swapNext, setSwapNext] = useState(NO_SWAP);
  // Where the quantity starts: the buyer's own last number for this category,
  // else the shop's default, else empty. Only categories with a default
  // remember -- elsewhere quantities vary too much line to line.
  const adminDefaultQty = quantityField?.defaultQty ?? null;
  const [startQty, setStartQty] = useState(adminDefaultQty ? String(adminDefaultQty) : '');
  const [pickQty, setPickQty] = useState(startQty);
  // Per-line, not per-order -- one requirement can mix Place Order and Request
  // Quotation lines. Defaults to Place Order, the more common/actionable case.
  const [pickRequestType, setPickRequestType] = useState<RequestType>('Place Order');
  const [justAdded, setJustAdded] = useState(0);
  const [toast, setToast] = useState('');
  // The cart as it was before the last "Add", so that add can be taken back.
  const [undo, setUndo] = useState<{ cart: CartItem[]; message: string } | null>(null);
  const undoCart = undo && undo.message === toast ? undo.cart : null;
  // Set when the buyer types something that isn't a whole number of pieces.
  const [qtyError, setQtyError] = useState(false);
  // Several sizes/shapes/colours at once take one quantity for all, or one
  // each from a grid (owner, 2026-10-17). A line's own number wins over the
  // all-lines box; "Set all to" clears them.
  const [qtyEach, setQtyEach] = useState(false);
  const [lineQty, setLineQty] = useState<Record<string, string>>({});
  // After shape (and colour), every size is a row with its own quantity box --
  // a buyer copying a list types the numbers straight in (owner, 2026-10-17).
  // The table is the default; "Pick sizes from a list" is the old picker, and
  // the buyer's choice is remembered on this device.
  const [sizeTable, setSizeTable] = useState(true);
  const [tableQty, setTableQty] = useState<TableEntries>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(SIZE_ENTRY_KEY) === 'list') setSizeTable(false); } catch { /* storage unavailable */ }
  }, []);
  function chooseSizeTable(on: boolean) {
    setSizeTable(on);
    try { localStorage.setItem(SIZE_ENTRY_KEY, on ? 'table' : 'list'); } catch { /* not remembered */ }
  }
  // Weight in whole carats, for sizes sold by carat; pieces follow from it.
  const [pickCt, setPickCt] = useState('');
  const [ctError, setCtError] = useState(false);
  const sizeGrid = categoryId === SIZE_GRID_CATEGORY_ID;
  const [gridShapeId, setGridShapeId] = useState<number | null>(null);
  const [gridEntries, setGridEntries] = useState<GridEntries>({});

  // POSelector isn't remounted when a customer client-side-navigates from one
  // category page to another (same component, new categoryId prop) -- without
  // this, a shape/color/size picked on category A silently survives into
  // category B, where those ids can point at an unrelated shape/color/size, or
  // simply not exist in B's options at all (addLine then skips every combo and
  // used to still report "Added to your order"). Clear the picker whenever the
  // category actually changes, same as SpecialOrderComposer's key={categoryId}
  // achieves by remounting entirely.
  useEffect(() => {
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setSwapNext(NO_SWAP);
    setPickCt('');
    setCtError(false);
    const start = adminDefaultQty ? String(rememberedQty(categoryId) ?? adminDefaultQty) : '';
    setStartQty(start);
    setPickQty(start);
    setQtyError(false);
    setPickRequestType('Place Order');
    setLineQty({});
    setTableQty({});
    setGridShapeId(null);
    setGridEntries({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, adminDefaultQty]);

  // Arriving from the stone search ("Yellow CZ") with ?color=: that colour is
  // picked. Runs after the reset above; the address is then tidied so a
  // reload doesn't re-pick it.
  useEffect(() => {
    let id = Number(new URLSearchParams(window.location.search).get('color')) || 0;
    try {
      const handed = JSON.parse(sessionStorage.getItem(PICK_COLOR_KEY) || 'null');
      if (handed?.categoryId === categoryId) id = Number(handed.colorId) || id;
      sessionStorage.removeItem(PICK_COLOR_KEY);
    } catch { /* storage unavailable: the address is enough */ }
    if (!id) return;
    if (!colorLocked && colors.some((c) => c.id === id)) setPickColorIds([id]);
    const url = new URL(window.location.href);
    if (!url.searchParams.has('color')) return;
    url.searchParams.delete('color');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  // The grid opens on Round -- most melee orders are Round -- so sizes are on
  // screen straight away.
  useEffect(() => {
    if (!sizeGrid) return;
    if (gridShapeId === null || !shapes.some((s) => s.id === gridShapeId)) setGridShapeId((shapes.find((s) => s.name === 'Round') || shapes[0])?.id ?? null);
  }, [sizeGrid, shapes, gridShapeId]);
  const gridShapes = useMemo(() => [...shapes].sort((a, b) => Number(b.name === 'Round') - Number(a.name === 'Round')), [shapes]);
  const gridLineList = useMemo(() => (sizeGrid ? gridLines(gridShapes, sizes, gridEntries) : []), [sizeGrid, gridShapes, sizes, gridEntries]);
  const gridInvalid = sizeGrid && gridHasError(gridEntries);
  // The sheet is kept in this browser until it is added to the order, so a
  // reload or a look at another page doesn't lose a long list.
  const gridDraftKey = `yoyo-size-sheet-${categoryId}`;
  const gridRestored = useRef<number | null>(null);
  useEffect(() => {
    if (!sizeGrid) return;
    try {
      const saved = JSON.parse(localStorage.getItem(gridDraftKey) || 'null');
      if (saved && typeof saved === 'object') setGridEntries(saved);
    } catch { /* no saved sheet */ }
    gridRestored.current = categoryId;
  }, [sizeGrid, gridDraftKey, categoryId]);
  useEffect(() => {
    if (!sizeGrid || gridRestored.current !== categoryId) return;
    try {
      if (Object.keys(gridEntries).length) localStorage.setItem(gridDraftKey, JSON.stringify(gridEntries));
      else localStorage.removeItem(gridDraftKey);
    } catch { /* storage unavailable: the sheet just isn't kept */ }
  }, [sizeGrid, gridEntries, gridDraftKey, categoryId]);
  // While the size panel is open its own Add and Done finish the job; the
  // order button waits below until Done, so nothing typed there is skipped.
  const [gridPanelOpen, setGridPanelOpen] = useState(false);
  // "Clear all" asks for a second tap before wiping a long sheet.
  const [confirmGridClear, setConfirmGridClear] = useState(false);
  useEffect(() => {
    if (!confirmGridClear) return;
    const t = setTimeout(() => setConfirmGridClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmGridClear]);

  // Glass Pearls: the shape field isn't shown at all (see GLASS_PEARLS_CATEGORY_ID
  // above), so silently keep the selection pinned to Round instead of leaving it
  // empty -- nothing else could ever be picked here anyway.
  useEffect(() => {
    if (categoryId !== GLASS_PEARLS_CATEGORY_ID) return;
    const roundId = shapes.find((s) => s.name === 'Round')?.id;
    if (roundId && (pickShapeIds.length !== 1 || pickShapeIds[0] !== roundId)) setPickShapeIds([roundId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, shapes]);

  useEffect(() => {
    if (active) {
      setCart(loadCart());
      setHydrated(true);
    }
  }, [active]);

  useEffect(() => {
    if (hydrated) saveCart(cart);
  }, [cart, hydrated]);

  useEffect(() => {
    if (!toast) return;
    // Longer when there is an Undo to reach, or a change to existing lines to read.
    const t = setTimeout(() => { setToast(''); setUndo(null); }, undoCart ? 6000 : 2200);
    return () => clearTimeout(t);
  }, [toast, undoCart]);

  // Shape, size and colour can be picked in any order: each list offers only
  // what goes with the picks already made in the other two (lib/faceted-picker).
  // Sizes are indexed into the category's full size list, so a size picked
  // before a shape stays picked when the shape is chosen.
  const sizeGroups = useMemo(
    () => sizeGroupsOf(sizes.map((s) => ({ ...s, shapeId: s.shape_id, sizeMm: s.size_mm }))),
    [sizes]
  );

  // Field names: the admin Overview's, else the usual ones (and a category's
  // own colour word, "Material"). A name the team typed isn't pluralised.
  const names = formFields?.labels || {};
  const label = names.color || optionLabel || 'Color';
  const lowerLabel = label.toLowerCase();
  const plural = (custom: string | undefined, n: number) => (!custom && n > 1 ? 's' : '');
  const shapeLabel = names.shape || 'Shape/Cut';
  const sizeLabel = names.size || 'Size';
  const qualityLabel = names.quality || 'Quality';
  // A field the team hid has one option; it's picked without asking.
  const shapeHidden = fieldHidden(formFields, 'shape', shapes.length);
  const colorHidden = fieldHidden(formFields, 'color', colors.length);
  const sizeHidden = fieldHidden(formFields, 'size', sizeGroups.length);
  useEffect(() => {
    if (shapeHidden && pickShapeIds.length === 0) setPickShapeIds([shapes[0].id]);
    if (colorHidden && pickColorIds.length === 0) setPickColorIds([colors[0].id]);
    if (sizeHidden && pickSizeIdxs.length === 0) setPickSizeIdxs([0]);
  }, [shapeHidden, colorHidden, sizeHidden, pickShapeIds.length, pickColorIds.length, pickSizeIdxs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Categories like Semi Precious Beads list which materials each shape+size
  // comes in; there the material list and the shape/size lists narrow each other.
  const allowedBySize = useMemo(() => allowedColorsOf(sizeColors), [sizeColors]);
  const comboAllowed = (sizeId: number, colorId: number) => !allowedBySize || !!allowedBySize.get(sizeId)?.has(colorId);

  const available = useMemo(
    () => facetAvailability(shapes.map((s) => s.id), colors.map((c) => c.id), sizeGroups, allowedBySize,
      { shapeIds: pickShapeIds, sizeIdxs: pickSizeIdxs, colorIds: pickColorIds }),
    [shapes, colors, sizeGroups, allowedBySize, pickShapeIds, pickSizeIdxs, pickColorIds]
  );
  // Every shape is listed; those cut in the picked size(s) and colour(s) come
  // first. Picking one of the others clears the picks it doesn't come in.
  const shapeOptions = shapes;
  const fittingShapeIds = useMemo(() => shapes.filter((s) => available.shapeIds.has(s.id)).map((s) => s.id), [shapes, available]);
  const colorOptions = useMemo(() => colors.filter((c) => available.colorIds.has(c.id)), [colors, available]);
  const sizeOptions = useMemo(
    () => sizeGroups
      .map((g, i) => ({ id: i, hotIds: g.rows.filter((r) => !pickShapeIds.length || pickShapeIds.includes(r.shape_id)).map((row) => row.id), name: swiss ? swissSizeLabel(g.sizeMm) : `${g.sizeMm} mm` }))
      .filter((o) => available.sizeIdxs.has(o.id)),
    [sizeGroups, available, pickShapeIds, swiss]
  );

  // Picks only ever narrow the other lists, so this is a safety net for a
  // pick left over from data that has since changed, not a normal path.
  useEffect(() => {
    setPickSizeIdxs((cur) => keepAvailable(cur, available.sizeIdxs));
    setPickColorIds((cur) => keepAvailable(cur, available.colorIds));
  }, [available]);

  // Among several shapes, a shape sharing no size with those already picked
  // is greyed out with the reason on the row, so an impossible combination
  // can't be built at all.
  const incompatibleShapes = useMemo(
    () => incompatibleShapeIds(shapes, sizes.map((s) => ({ shapeId: s.shape_id, sizeMm: s.size_mm })), pickShapeIds),
    [pickShapeIds, shapes, sizes]
  );

  const pickedRows = useMemo(() => pickedSizeRows(sizeGroups, pickSizeIdxs, pickShapeIds), [sizeGroups, pickSizeIdxs, pickShapeIds]);

  // Sizes sold by carat (Moissanite melee) take a weight. With one such size
  // picked, weight and pieces are linked both ways; with several, the weight
  // applies to each of them and any other sizes take pieces.
  const caratRows = pickedRows.filter((r) => r.pcs_per_ct);
  const plainRowCount = pickedRows.length - caratRows.length;
  // Pieces in one carat when exactly one size by carat is being added -- the
  // linked mode -- else null.
  const caratRate = pickedRows.length === 1 ? pickedRows[0].pcs_per_ct ?? null : null;
  const multiCarat = caratRows.length > 0 && !caratRate;
  const ctNum = parseQuantity(pickCt) || 0;
  // The pieces box: linked to the weight, for the other sizes, or not needed.
  const showPieces = !!caratRate || plainRowCount > 0 || caratRows.length === 0;
  // Carats are whole: pieces round up to the next full carat, and the pieces
  // box then shows that carat's pieces (130 at 62/ct -> 3 ct, 186 pcs).
  function settlePieces(pcs: number, rate: number) {
    const ct = caratsFor(pcs, rate);
    setPickCt(ct ? String(ct) : '');
    setCtError(false);
    setPickQty(ct ? String(ct * rate) : '');
  }
  // A new carat size keeps the weight already entered and re-derives pieces.
  const wasLinked = useRef(false);
  useEffect(() => {
    // Leaving the linked mode: the pieces shown were the weight's, not a
    // number anyone typed for the other sizes.
    if (!caratRate) { if (wasLinked.current) setPickQty(startQty); wasLinked.current = false; return; }
    wasLinked.current = true;
    const ct = parseQuantity(pickCt);
    if (ct) setPickQty(String(ct * caratRate));
    else { const pcs = parseQuantity(pickQty); if (pcs) settlePieces(pcs, caratRate); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caratRate]);

  // Quality grade, for categories that offer one inside the category (Ruby
  // Corundum 5A / 7A). Starts on the buyer's usual grade for this category,
  // if they have one on file; required before a line can be added.
  const allQualities = useCategoryQualities();
  const categoryList = allQualities ? categoryGrades(categoryId, allQualities) : qualities ?? categoryGrades(categoryId);
  // A shape/cut with its own list (Nano's Green OSP HW: 3A / AA) replaces the
  // category's while it's picked, and starts on its first quality.
  const allShapeQualities = useShapeQualities();
  const shapeLists: ShapeQualities = allShapeQualities ?? (shapeQualities ? { [categoryId]: shapeQualities } : {});
  const { grades, start: shapeStart } = pickQualities({ [categoryId]: categoryList }, shapeLists, categoryId, pickShapeIds);
  const gradesKey = grades.join('|');
  const preferences = useOrderPreferences();
  const [pickGrade, setPickGrade] = useState('');
  const preferredGrade = preferences.find((p) => p.categoryId === categoryId && p.grade && grades.includes(p.grade))?.grade || '';
  // The usual quality, else the only one there is.
  const onlyGrade = grades.length === 1 ? grades[0] : '';
  useEffect(() => { const start = preferredGrade || onlyGrade || shapeStart; if (start) setPickGrade((g) => (g && grades.includes(g) ? g : start)); }, [preferredGrade, onlyGrade, shapeStart, gradesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every shape x size x colour line the picks make, in the order they are added.
  const combos = useMemo(() => {
    const list: { key: string; shape: ShapeRef; size: Size; color: ColorRef }[] = [];
    for (const colorId of pickColorIds) {
      const color = colors.find((c) => c.id === colorId);
      if (!color) continue;
      for (const shapeId of pickShapeIds) {
        const shape = shapes.find((x) => x.id === shapeId);
        if (!shape) continue;
        for (const sizeIdx of pickSizeIdxs) {
          const match = sizeGroups[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
          if (!match || !comboAllowed(match.id, colorId)) continue;
          list.push({ key: `${shapeId}-${match.id}-${colorId}`, shape, size: match, color });
        }
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickShapeIds, pickColorIds, pickSizeIdxs, sizeGroups, shapes, colors, allowedBySize]);
  // Per-line quantities: only for lines in pieces (not by carat) and when there is more than one.
  const perLineOffered = !sizeGrid && combos.length > 1 && caratRows.length === 0;
  const perLine = perLineOffered && qtyEach;
  const lineText = (key: string) => lineQty[key] ?? pickQty;
  const lineInvalid = perLine && combos.some((c) => !/^\d*$/.test(lineText(c.key).trim()));
  const lineTotal = perLine ? combos.reduce((sum, c) => sum + (parseQuantity(lineText(c.key)) || 0), 0) : 0;
  const filledLines = perLine ? combos.filter((c) => (parseQuantity(lineText(c.key)) || 0) > 0).length : 0;
  const shortShape = useMemo(() => shapeAbbrevs(shapes.filter((x) => pickShapeIds.includes(x.id))), [shapes, pickShapeIds]);

  const qtyNum = parseQuantity(pickQty) || 0;
  const isQuotation = pickRequestType === 'Request Quotation';
  // A quotation is asking what something would cost, so a quantity is not
  // required to send one. A purchase still needs one.
  const quantitiesOk = multiCarat ? ctNum > 0 && (plainRowCount === 0 || qtyNum > 0) : perLine ? filledLines > 0 && !lineInvalid : qtyNum > 0;
  const canAdd = pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0
    && (isQuotation ? !lineInvalid : quantitiesOk) && (grades.length === 0 || grades.includes(pickGrade));
  // The size table: offered once a shape is picked and it has more than one
  // size to choose from. Sizes sold by carat keep the weight-linked picker.
  const tableGroupList = useMemo(
    () => tableGroups(pickShapeIds, sizes, (s) => !allowedBySize || !pickColorIds.length || pickColorIds.some((c) => comboAllowed(s.id, c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickShapeIds, sizes, allowedBySize, pickColorIds]
  );
  const tableOffered = !sizeGrid && !sizeHidden && tableSizeCount(tableGroupList) > 1
    && !tableGroupList.some((g) => g.sizes.some((s) => s.pcs_per_ct));
  const tableMode = tableOffered && sizeTable;
  // Sizes picked from the list before the shape don't apply to the table, and
  // left in place they would keep narrowing the colour and shape lists.
  useEffect(() => { if (tableMode && pickSizeIdxs.length) setPickSizeIdxs([]); }, [tableMode, pickSizeIdxs.length]);
  const tableLineList = useMemo(() => (tableMode ? tableLines(tableGroupList, tableQty) : []), [tableMode, tableGroupList, tableQty]);
  const tableInvalid = tableMode && tableHasError(tableGroupList, tableQty);
  // One line per filled size for each picked colour (that size comes in).
  const tableAddCount = tableLineList.reduce((n, l) => n + pickColorIds.filter((c) => comboAllowed(l.size.id, c)).length, 0);
  const tablePieces = tableLineList.reduce((n, l) => n + l.qty * pickColorIds.filter((c) => comboAllowed(l.size.id, c)).length, 0);
  const tableCanAdd = tableMode && pickColorIds.length > 0 && tableAddCount > 0 && !tableInvalid && (grades.length === 0 || grades.includes(pickGrade));
  const comboCount = useMemo(() => {
    if (!allowedBySize) return pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;
    let n = 0;
    for (const shapeId of pickShapeIds) for (const sizeIdx of pickSizeIdxs) {
      const match = sizeGroups[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
      if (match) n += pickColorIds.filter((colorId) => comboAllowed(match.id, colorId)).length;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedBySize, pickShapeIds, pickColorIds, pickSizeIdxs, sizeGroups]);

  const pricingByCategory = useMemo(
    () => ({ ...otherPricing, ...(pricing ? { [categoryId]: pricing } : {}) }),
    [otherPricing, pricing, categoryId]
  );


  // Request Quotation is only offered when something in the current selection
  // has no price yet -- there is nothing to quote on an item whose price is
  // already published. Purchase stays available either way.
  const selectionHasUnpriced = useMemo(() => {
    if (sizeGrid) {
      if (!gridLineList.length || !pickColorIds.length) return true;
      return gridLineList.some((l) => pickColorIds.some((colorId) =>
        cartLinePrice(pricingByCategory, { categoryId, shapeId: l.shape.id, sizeId: l.size.id, colorId }) === null));
    }
    if (!pickShapeIds.length || !pickColorIds.length || !pickSizeIdxs.length) return true;
    for (const shapeId of pickShapeIds) {
      for (const sizeIdx of pickSizeIdxs) {
        const match = sizeGroups[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
        if (!match) continue;
        for (const colorId of pickColorIds) {
          if (!comboAllowed(match.id, colorId)) continue;
          if (cartLinePrice(pricingByCategory, { categoryId, shapeId, sizeId: match.id, colorId }) === null) return true;
        }
      }
    }
    return false;
  }, [sizeGrid, gridLineList, pickShapeIds, pickColorIds, pickSizeIdxs, sizeGroups, pricingByCategory, categoryId]);

  // The price of what is picked, shown before it is added -- a buyer used to
  // only learn it from the running total after adding. Only when every picked
  // combination has a price: a partial figure would read as the whole story.
  const selectionPrice = useMemo(() => {
    if (!pickShapeIds.length || !pickColorIds.length || !pickSizeIdxs.length) return null;
    const prices: number[] = [];
    for (const shapeId of pickShapeIds) {
      for (const sizeIdx of pickSizeIdxs) {
        const match = sizeGroups[sizeIdx]?.rows.find((r) => r.shape_id === shapeId);
        if (!match) continue;
        for (const colorId of pickColorIds) {
          if (!comboAllowed(match.id, colorId)) continue;
          const p = cartLinePrice(pricingByCategory, { categoryId, shapeId, sizeId: match.id, colorId });
          if (p === null) return null;
          prices.push(p);
        }
      }
    }
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices), sum: prices.reduce((a, b) => a + b, 0) };
  }, [pickShapeIds, pickColorIds, pickSizeIdxs, sizeGroups, pricingByCategory, categoryId]);

  // Never leave the buyer stuck on a request type that is no longer offered.
  useEffect(() => {
    if (!selectionHasUnpriced && isQuotation) setPickRequestType('Place Order');
  }, [selectionHasUnpriced, isQuotation]);


  // Fetch a price list for every other category sitting in the cart, once each.
  const missingPricingIds = useMemo(() => {
    const ids = new Set<number>();
    cart.forEach((item) => {
      if (item.categoryId !== categoryId && !otherPricing[item.categoryId]) ids.add(item.categoryId);
    });
    return Array.from(ids).sort((a, b) => a - b);
  }, [cart, categoryId, otherPricing]);

  const missingKey = missingPricingIds.join(',');
  useEffect(() => {
    if (!missingKey) return;
    let active = true;
    fetch(`/api/category-pricing?ids=${missingKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.pricing) return;
        // Merge rather than replace: the buyer may have added another
        // category while this request was in flight.
        setOtherPricing((prev) => ({ ...prev, ...data.pricing }));
      })
      .catch(() => { /* prices stay unresolved; lines still submit correctly */ });
    return () => { active = false; };
  }, [missingKey]);

  // Unit price is looked up live from the pricing map, not stored on the cart
  // item -- so it always reflects the current admin-set price, and categories
  // with no pricing set up yet just show nothing (no crash).
  function unitPriceInr(item: CartItem): number | null {
    // A quotation is a request for a price, so it never displays one and never
    // contributes to the estimated total -- even where the catalogue happens to
    // have a published price for that shape/size/colour.
    if (item.requestType === 'Request Quotation') return null;
    return cartLinePrice(pricingByCategory, item);
  }
  const cartTotalInr = cart.reduce((sum, item) => {
    const unit = unitPriceInr(item);
    return unit === null ? sum : sum + unit * item.qty;
  }, 0);
  const hasAnyPricedLine = cart.some((item) => unitPriceInr(item) !== null);
  const unpricedLines = cart.filter((item) => unitPriceInr(item) === null).length;

  // The dedupe rule itself lives in lib/cart-storage so /po/cart applies exactly
  // the same one; only the shape photo/icon enrichment is local, since this is
  // the one place that has the category's shape list to hand.
  function mergeIntoCart(current: CartItem[], item: CartItem): CartItem[] {
    const shape = shapes.find((s) => s.id === item.shapeId);
    // A Hole Punched line shows the stone with the number of holes chosen.
    return mergeCartLines(current, { ...item, shapeRefPhotoUrl: photoForHoles(shape, drilledHoles(item.orderSpecs)), shapeIconKey: shape?.iconKey });
  }

  // Clicking away commits whatever's currently checked (like a native <select>
  // dismissing on blur) -- only the explicit close button discards. Scoped to
  // this one panel's own DOM subtree so a click inside the nested IconSelect's
  // own popup (picking an option) never counts as "outside".


  // Everything the compose form is currently holding. A locked colour or
  // shape is re-applied by the picker itself, so clearing it would only
  // flicker -- leave it alone.
  const hasSelection =
    (!shapeLocked && pickShapeIds.length > 0) || pickSizeIdxs.length > 0 || pickQty !== startQty || Object.keys(lineQty).length > 0 || Object.keys(tableQty).length > 0 ||
    (!colorLocked && pickColorIds.length > 0);

  const missingFields = [
    categoryId !== GLASS_PEARLS_CATEGORY_ID && pickShapeIds.length === 0 && shapeLabel.toLowerCase(),
    !tableMode && pickSizeIdxs.length === 0 && sizeLabel.toLowerCase(),
    pickColorIds.length === 0 && lowerLabel,
    !tableMode && !isQuotation && multiCarat && ctNum <= 0 && 'weight',
    tableMode
      ? tableLineList.length === 0 && `a ${(quantityField?.label || 'quantity').toLowerCase()} against at least one ${sizeLabel.toLowerCase()}`
      : !isQuotation && showPieces && (perLine ? filledLines === 0 : qtyNum <= 0) && (quantityField?.label?.toLowerCase() || 'quantity')
  ].filter(Boolean) as string[];

  // A shape that isn't cut in the picked size (Marquise after Round 4 mm)
  // clears that size -- and, where materials depend on the size, any material
  // it doesn't come in -- instead of being hidden from the list.
  function changeShapes(ids: number[]) {
    setSwapNext((r) => ({ ...r, shape: false }));
    setPickShapeIds(ids);
    const keptSizes = pickSizeIdxs.filter((i) => ids.every((sid) => sizeGroups[i]?.rows.some((r) => r.shapeId === sid)));
    if (keptSizes.length !== pickSizeIdxs.length) setPickSizeIdxs(keptSizes);
    if (allowedBySize) {
      const fits = facetAvailability(shapes.map((x) => x.id), colors.map((c) => c.id), sizeGroups, allowedBySize, { shapeIds: ids, sizeIdxs: keptSizes, colorIds: [] });
      setPickColorIds((cur) => cur.filter((c) => fits.colorIds.has(c)));
    }
  }
  function changeSizes(idxs: number[]) {
    setSwapNext((r) => ({ ...r, size: false }));
    setPickSizeIdxs(idxs);
  }
  function changeColors(ids: number[]) {
    setSwapNext((r) => ({ ...r, color: false }));
    setPickColorIds(ids);
  }

  function clearSelection() {
    setSwapNext(NO_SWAP);
    if (!shapeLocked) setPickShapeIds([]);
    setPickSizeIdxs([]);
    if (!colorLocked) setPickColorIds([]);
    setPickCt('');
    setCtError(false);
    setPickQty(startQty);
    setLineQty({});
    setTableQty({});
    setQtyError(false);
    setPickRequestType('Place Order');
  }

  // Table mode: one line per filled size and picked colour, each at the
  // quantity typed against that size.
  function addTableLines() {
    if (!tableCanAdd) {
      setToast(grades.length > 0 && !grades.includes(pickGrade) ? `Choose a ${qualityLabel.toLowerCase()} (${grades.join(' or ')}) first.`
        : tableInvalid ? 'Whole numbers only — fix the highlighted size.'
        : `Choose a ${lowerLabel} and type a quantity against at least one ${sizeLabel.toLowerCase()} first.`);
      return;
    }
    let next = cart;
    let added = 0;
    for (const colorId of pickColorIds) {
      const color = colors.find((c) => c.id === colorId);
      if (!color) continue;
      for (const l of tableLineList) {
        const shape = shapes.find((x) => x.id === l.shapeId);
        if (!shape || !comboAllowed(l.size.id, color.id)) continue;
        next = mergeIntoCart(next, {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          categoryId,
          categoryName,
          shapeId: shape.id,
          shapeName: shape.name,
          sizeId: l.size.id,
          sizeMm: l.size.size_mm,
          colorId: color.id,
          colorName: color.name,
          colorHex: color.hex || '#ccc',
          colorRefPhotoUrl: color.refPhotoUrl || null,
          qty: l.qty,
          qtyUnit: quantityField?.unit ?? null,
          requestType: pickRequestType,
          ...(pickGrade && lineQualities({ [categoryId]: categoryList }, shapeLists, categoryId, shape.id).includes(pickGrade) ? { orderSpecs: gradeSpec(pickGrade) } : {})
        });
        added++;
      }
    }
    if (!commitAdd(next, added)) return;
    // The table empties; shape and colour stay, and the next pick in either
    // replaces it -- the next block of a list is usually a new shape or colour.
    setTableQty({});
    setSwapNext({ shape: true, size: false, color: true });
    setPickRequestType('Place Order');
  }

  function addLine() {
    if (!canAdd) {
      setToast(grades.length > 0 && !pickGrade ? `Choose a ${qualityLabel.toLowerCase()} (${grades.join(' or ')}) first.` : `Pick at least one ${shapeLabel.toLowerCase()}, ${lowerLabel} and ${sizeLabel.toLowerCase()}, and enter quantity first.`);
      return;
    }

    let next = cart;
    let added = 0;
    // By carat: always a whole number of carats' worth of pieces.
    // Linked mode settles pieces to whole carats; several sizes by carat each
    // get the weight's pieces at their own rate; other sizes take the pieces.
    const qtyFor = (rate: number | null | undefined) => !rate ? qtyNum : caratRate ? caratsFor(qtyNum, rate) * rate : ctNum * rate;

    for (const shapeId of pickShapeIds) {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape) continue;
      for (const colorId of pickColorIds) {
        const color = colors.find((c) => c.id === colorId);
        if (!color) continue;
        for (const sizeIdx of pickSizeIdxs) {
          const group = sizeGroups[sizeIdx];
          const match = group?.rows.find((r) => r.shape_id === shapeId);
          if (!match) continue; // shouldn't happen -- only sizes every picked shape has are offered
          if (!comboAllowed(match.id, color.id)) continue; // this shape/size doesn't come in this material
          // In the per-line grid a line left empty (or 0) is not wanted.
          const own = perLine ? parseQuantity(lineText(`${shape.id}-${match.id}-${color.id}`)) || 0 : null;
          if (own === 0 && !isQuotation) continue;

          const item: CartItem = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            categoryId,
            categoryName,
            shapeId: shape.id,
            shapeName: shape.name,
            sizeId: match.id,
            sizeMm: match.size_mm,
            colorId: color.id,
            colorName: color.name,
            colorHex: color.hex || '#ccc',
            colorRefPhotoUrl: color.refPhotoUrl || null,
            qty: own ?? qtyFor(match.pcs_per_ct),
            qtyUnit: quantityField?.unit ?? null,
            requestType: pickRequestType,
            // Only lines whose shape/cut (or category) offers the chosen quality carry it.
            ...(pickGrade && lineQualities({ [categoryId]: categoryList }, shapeLists, categoryId, shape.id).includes(pickGrade) ? { orderSpecs: gradeSpec(pickGrade) } : {}),
            ...(match.pcs_per_ct && qtyFor(match.pcs_per_ct) > 0 ? { orderSpecs: caratSpec(match.pcs_per_ct) } : {})
          };
          next = mergeIntoCart(next, item);
          added++;
        }
      }
    }

    if (!commitAdd(next, added)) return;
    // Every pick stays for the next line; the first new pick in a field
    // replaces its old value (owner, 2026-10-15). Request type always returns
    // to Purchase -- a quotation is a deliberate per-line choice.
    setSwapNext({ shape: true, size: true, color: true });
    setPickCt('');
    setCtError(false);
    // The quantity just used stays in the box for the next line (owner,
    // 2026-10-15). With a shop default it also becomes this buyer's starting
    // point here on later visits.
    if (adminDefaultQty && qtyNum > 0) {
      rememberQty(categoryId, qtyNum);
      setStartQty(String(qtyNum));
    }
    setLineQty({});
    setQtyError(false);
    setPickRequestType('Place Order');
  }

  // Grid mode: one line per filled size, each with its own amount -- whole
  // carats for melee (stored as that many carats' pieces), else pieces.
  function addGridLines() {
    if (!gridLineList.length || gridInvalid || !pickColorIds.length) {
      setToast(gridInvalid ? 'Whole numbers only — fix the highlighted size.' : 'Type a weight or quantity against at least one size first.');
      return;
    }
    let next = cart;
    let added = 0;
    for (const l of gridLineList) {
      for (const colorId of pickColorIds) {
        const color = colors.find((c) => c.id === colorId);
        if (!color) continue;
        next = mergeIntoCart(next, {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          categoryId,
          categoryName,
          shapeId: l.shape.id,
          shapeName: l.shape.name,
          sizeId: l.size.id,
          sizeMm: l.size.size_mm,
          colorId: color.id,
          colorName: color.name,
          colorHex: color.hex || '#ccc',
          colorRefPhotoUrl: color.refPhotoUrl || null,
          qty: l.pcs,
          qtyUnit: quantityField?.unit ?? null,
          requestType: pickRequestType,
          ...(l.size.pcs_per_ct ? { orderSpecs: caratSpec(l.size.pcs_per_ct) } : {})
        });
        added++;
      }
    }
    if (!commitAdd(next, added)) return;
    setGridEntries({});
    setPickRequestType('Place Order');
  }

  // A pasted list: lines from any category, each already matched and checked.
  function addPasted(lines: PastedLine[]) {
    let next = cart;
    for (const l of lines) {
      next = mergeCartLines(next, {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        categoryId: l.categoryId,
        categoryName: l.categoryName,
        shapeId: l.shapeId,
        shapeName: l.shapeName,
        shapeRefPhotoUrl: l.shapeRefPhotoUrl ?? null,
        shapeIconKey: l.shapeIconKey ?? null,
        sizeId: l.sizeId,
        sizeMm: l.sizeMm,
        colorId: l.colorId,
        colorName: l.colorName,
        colorHex: l.colorHex || '#ccc',
        colorRefPhotoUrl: l.colorRefPhotoUrl,
        qty: l.qty,
        qtyUnit: l.qtyUnit ?? null,
        requestType: 'Place Order',
        ...(l.note.trim() ? { note: l.note.trim().slice(0, LINE_NOTE_MAX) } : {}),
        ...(l.grade ? { orderSpecs: gradeSpec(l.grade) } : {})
      });
    }
    commitAdd(next, lines.length);
  }

  // Shared by both composers: checks the new cart, then saves it with an Undo
  // and a toast that says what was added and what was merged.
  function commitAdd(next: CartItem[], added: number): boolean {
    // Quotation lines may carry no quantity at all (0 = "not specified"), so
    // only purchase lines are held to a positive whole quantity.
    if (next.some((item) => item.requestType !== 'Request Quotation' && parseQuantity(String(item.qty)) === null)) {
      setToast('This would exceed the supported quantity for a line. Reduce the quantity and try again.');
      return false;
    }
    if (next.some((item) => item.requestType === 'Request Quotation' && item.qty > 0 && parseQuantity(String(item.qty)) === null)) {
      setToast('This would exceed the supported quantity for a line. Reduce the quantity and try again.');
      return false;
    }
    // Every shape/color/size combo was skipped (e.g. a stale selection left over
    // from switching categories no longer matches this category's options) --
    // never claim success when nothing was actually added.
    if (added === 0) {
      setToast('Those selections are no longer valid for this category. Please pick again.');
      return false;
    }
    // A combination already in the requirement is merged into that line rather
    // than added twice -- say so, with the new total, since "Added 4 lines"
    // while two existing lines quietly grew read as an over-order.
    const grown = next.filter((item) => {
      const before = cart.find((c) => c.id === item.id);
      return before && before.qty !== item.qty;
    });
    const fresh = added - grown.length;
    const parts: string[] = [];
    if (fresh > 0) parts.push(fresh > 1 ? `Added ${fresh} lines` : 'Added 1 line');
    if (grown.length === 1) {
      const g = grown[0];
      parts.push(`${g.shapeName} ${g.sizeMm} mm ${g.colorName} was already in your order — now ${g.orderSpecs?.kind === 'carat' ? `${(g.qty / g.orderSpecs.pcsPerCt).toLocaleString('en-IN')} ct` : formatQty(g.qty, g.qtyUnit)}`);
    } else if (grown.length > 1) {
      parts.push(`${grown.length} lines were already in your order — quantities added to them`);
    }
    const message = parts.join(' · ');
    setUndo({ cart, message });
    setCart(next);
    setJustAdded((n) => n + 1);
    setToast(message);
    return true;
  }






  const colorField = (
    <div>
      <label className="po-label">{label}{plural(names.color, pickColorIds.length)}</label>
      <IconSelect
        categoryId={categoryId}
        multiple
        options={colorOptions}
        locked={colorLocked}
        values={pickColorIds}
        onChange={changeColors}
        replaceOnPick={swapNext.color}
        // Crushed Ice Cut is ordered colour by colour from a 60-colour card, so
        // its list stays open for picking several, with a Done bar to finish.
        closeOnFirstPick={categoryId !== CRUSHED_ICE_CATEGORY_ID && pickShapeIds.length === 0}
        doneBar={categoryId === CRUSHED_ICE_CATEGORY_ID}
        placeholder={colorOptions.length === 0 ? `No ${lowerLabel} for this shape and size` : `Choose ${lowerLabel}(s)`}
        leading="swatch"
      />
    </div>
  );

  return (
    <div className="po-wrap">
      <section className="po-card po-compose-card">
        <div className="po-compose-head">
          <h2 className="po-heading">Add to Order</h2>
          <span className="po-compose-actions">
            {/* Opens Speak order already on this stone (the header mic, see category page). */}
            <button type="button" className="voice-order-btn po-speak-btn" onClick={() => window.dispatchEvent(new CustomEvent(VOICE_ORDER_OPEN_EVENT))}>
              <MicIcon size={15} /> Speak order
            </button>
            <button type="button" className="po-paste-btn" onClick={() => setPasteOpen(true)}>Paste a list</button>
          </span>
        </div>
        <StoneSwitch categoryId={categoryId} onPickColor={(id) => { if (!colorLocked && colors.some((c) => c.id === id)) changeColors([id]); }} />
        <PasteListDialog open={pasteOpen} onClose={() => setPasteOpen(false)} onAdd={addPasted} ownPageHref={(slug) => `/po/category/${slug}`} />
        <OrderReferenceCarousel colorChartUrl={colorChartUrl} photos={photos} categoryName={categoryName} shapeIds={sizeGrid ? (gridShapeId ? [gridShapeId] : []) : pickShapeIds} colorIds={pickColorIds} sizeIds={sizeGrid ? sizes.filter(z=>z.shape_id===gridShapeId && gridEntries[z.id] !== undefined).map(z=>z.id) : pickedRows.map(row=>row.id)} shapes={shapes} colors={colors} />
        <div className="po-compose-fields">
        {!specialCategory(categoryId) && shapes.length === 0 ? (
          <div className="po-no-options">
            <p><strong>Sizes for {categoryName} are being added.</strong></p>
            <p>See the range under Explore Photos, or send us the shapes, sizes and quantities you need.</p>
            {whatsappNumber && (
              <a className="po-add-line-btn po-no-options-action" href={buildWhatsAppUrl(whatsappNumber, `Hi YOYO GEMS, I'd like to order ${categoryName}:\n`)} target="_blank" rel="noopener noreferrer">
                Message your requirement
              </a>
            )}
          </div>
        ) : specialCategory(categoryId) ? <SpecialOrderComposer key={categoryId} categoryId={categoryId} categoryName={categoryName} shapes={shapes} colors={colors} sizes={sizes.map(s=>({id:s.id,shapeId:s.shape_id,sizeMm:s.size_mm}))} onAdd={line=>{setCart(current=>mergeIntoCart(current,line));setJustAdded(n=>n+1);}} /> : <>
        <div className="po-add-form">
          {grades.length > 0 && (
            <div>
              <label className="po-label" id="po-grade-label">{qualityLabel}</label>
              <div className="po-type-toggle po-grade-toggle" role="group" aria-labelledby="po-grade-label">
                {grades.map((g) => (
                  <button key={g} type="button" aria-pressed={pickGrade === g} className={pickGrade === g ? 'active' : ''} onClick={() => setPickGrade(g)}>{g}</button>
                ))}
              </div>
            </div>
          )}
          {!allowedBySize && !colorHidden && colorField}
          {!sizeGrid && categoryId !== GLASS_PEARLS_CATEGORY_ID && !shapeHidden && <div>
            <label className="po-label">{shapeLabel}</label>
            <IconSelect
              categoryId={categoryId}
              multiple
              options={shapeOptions}
              locked={shapeLocked}
              values={pickShapeIds}
              onChange={changeShapes}
              replaceOnPick={swapNext.shape}
              closeOnFirstPick={pickColorIds.length === 0}
              placeholder={`Choose ${shapeLabel.toLowerCase()}`}
              leading="icon"
              fitIds={fittingShapeIds.length < shapes.length ? fittingShapeIds : undefined}
              otherLabel={pickSizeIdxs.length ? `Not in ${pickSizeIdxs.length === 1 ? 'this size' : 'these sizes'} — picking one changes the size` : `Not in the chosen ${lowerLabel.toLowerCase()}`}
              disabledIds={swapNext.shape ? [] : incompatibleShapes}
              disabledReason={NO_SHARED_SIZE_REASON}
              disabledNote={NO_SHARED_SIZE_NOTE}
            />
          </div>}
          {!sizeGrid && !sizeHidden && !tableMode && <div>
            <label className="po-label">{sizeLabel}{plural(names.size, pickSizeIdxs.length)}{/mm/i.test(sizeLabel) ? '' : ' (mm)'}{swiss && <span className="po-label-note"> · weight of 1000 pcs</span>}</label>
            <IconSelect
              categoryId={categoryId}
              multiple
              optionKind="size"
              options={sizeOptions}
              values={pickSizeIdxs}
              onChange={changeSizes}
              replaceOnPick={swapNext.size}
              // A shape that comes in just one size shows that size, already
              // chosen and read-only -- there is nothing to pick.
              locked={pickShapeIds.length > 0 && sizeOptions.length === 1}
              placeholder={
                sizeOptions.length === 0
                  ? 'No size matches these picks'
                  : sizeOptions.length === 1
                  ? 'Size'
                  : `Choose ${sizeLabel.toLowerCase()}${names.size ? '' : '(s)'}`
              }
            />
            {tableOffered && (
              <button type="button" className="po-size-entry-switch" onClick={() => { chooseSizeTable(true); setPickSizeIdxs([]); }}>
                Type quantities in a {sizeLabel.toLowerCase()} table
              </button>
            )}
          </div>}
          {allowedBySize && !colorHidden && colorField}
          {!sizeGrid && caratRows.length > 0 && (
            <div>
              <label className="po-label" htmlFor="po-new-carats">Weight (ct){multiCarat ? ' per size' : ''}</label>
              <input
                type="text"
                inputMode="numeric"
                className="po-qty-input"
                id="po-new-carats"
                placeholder="e.g. 2"
                value={pickCt}
                aria-invalid={ctError || undefined}
                aria-describedby={ctError ? 'po-new-carats-error' : 'po-new-carats-rate'}
                onChange={(e) => {
                  const v = e.target.value;
                  setPickCt(v);
                  const bad = !/^\d*$/.test(v.trim());
                  setCtError(bad);
                  const ct = parseQuantity(v);
                  if (!bad && caratRate) setPickQty(ct ? String(ct * caratRate) : '');
                  setQtyError(false);
                }}
              />
              {ctError
                ? <p className="po-field-error" id="po-new-carats-error" role="alert">Whole carats only — e.g. 2.</p>
                : <p className="po-carat-rate" id="po-new-carats-rate">{caratRate
                    ? `1ct = ~${caratRate} pcs`
                    : caratRows.map((r) => `${r.size_mm} mm: 1ct = ~${r.pcs_per_ct} pcs`).join(' · ')}</p>}
            </div>
          )}
          {!sizeGrid && showPieces && !tableMode && <div>
            <label className="po-label" htmlFor="po-new-quantity">{quantityField?.label || 'Qty (pcs)'}{perLine && <span className="po-label-note"> · all lines</span>}</label>
            <input
              type="text"
              inputMode="numeric"
              className="po-qty-input"
              id="po-new-quantity"
              placeholder={adminDefaultQty ? `e.g. ${adminDefaultQty}` : 'e.g. 5000'}
              // Pieces worked out from carats are approximate: shown as "~128".
              value={caratRate && pickQty ? `~${pickQty}` : pickQty}
              aria-invalid={qtyError || undefined}
              aria-describedby={qtyError ? 'po-new-quantity-error' : undefined}
              onChange={(e) => {
                // Keep what was typed and flag it, rather than rewrite it:
                // stripping the "." turned 12.5 into 125. An invalid entry
                // parses to nothing, so Add stays off until it is fixed.
                const v = caratRate ? e.target.value.replace(/^\s*~/, '') : expandQtyShorthand(e.target.value);
                setPickQty(v);
                setQtyError(!/^\d*$/.test(v.trim()));
              }}
              onBlur={() => { if (caratRate && qtyNum > 0) settlePieces(qtyNum, caratRate); }}
            />
            {qtyError && <p className="po-field-error" id="po-new-quantity-error" role="alert">{quantityField?.label ? `Whole numbers only — e.g. ${adminDefaultQty || 5}.` : 'Whole pieces only — enter a number like 500.'}</p>}
            {multiCarat && <p className="po-carat-rate">For {plainRowCount === 1 ? 'the size' : 'the sizes'} not sold by weight</p>}
          </div>}
        </div>
        {tableMode && (
          <div className="po-size-table-wrap">
            <div className="po-size-table-head">
              <label className="po-label">
                {quantityField?.label || 'Qty (pcs)'} by {sizeLabel.toLowerCase()}{/mm/i.test(sizeLabel) ? '' : ' (mm)'}
                {pickColorIds.length > 1 && <span className="po-label-note"> · for each {lowerLabel}</span>}
              </label>
              <button type="button" className="po-size-entry-switch" onClick={() => chooseSizeTable(false)}>Pick {sizeLabel.toLowerCase()}s from a list</button>
            </div>
            <p className="po-size-table-hint">Type a quantity against each {sizeLabel.toLowerCase()} you need; leave the rest empty.</p>
            <SizeQtyTable
              groups={tableGroupList}
              shapeName={(id) => shapes.find((x) => x.id === id)?.name || ''}
              sizeName={(sz) => (swiss ? swissSizeLabel(sz.size_mm) : `${sz.size_mm} mm`)}
              entries={tableQty}
              onEntries={setTableQty}
              unitLabel={quantityField?.label || 'Quantity'}
            />
            {tableInvalid && <p className="po-field-error" role="alert">Whole numbers only — fix the highlighted {sizeLabel.toLowerCase()}.</p>}
          </div>
        )}
        {perLineOffered && !tableMode && (
          <div className="po-qty-mode">
            <div className="po-type-toggle" role="group" aria-label="Quantity for these lines">
              <button type="button" aria-pressed={!qtyEach} className={!qtyEach ? 'active' : ''} onClick={() => setQtyEach(false)}>Same qty for all {combos.length}</button>
              <button type="button" aria-pressed={qtyEach} className={qtyEach ? 'active' : ''} onClick={() => setQtyEach(true)}>Different qty each</button>
            </div>
            {perLine && <>
              <div className="po-line-qty-head">
                <span>Type a quantity against each line; leave one empty to skip it.</span>
                {Object.keys(lineQty).length > 0 && (
                  <button type="button" className="po-clear-selection" onClick={() => setLineQty({})}>
                    {qtyNum > 0 ? `Set all to ${qtyNum.toLocaleString('en-IN')}` : 'Clear all'}
                  </button>
                )}
              </div>
              {pickColorIds.map((colorId) => {
                const rows = combos.filter((c) => c.color.id === colorId);
                if (!rows.length) return null;
                return (
                  <div key={colorId} className="po-line-qty-group">
                    {pickColorIds.length > 1 && <p className="po-line-qty-colour"><ColorSwatch hex={rows[0].color.hex || '#ccc'} refPhotoUrl={rows[0].color.refPhotoUrl} size={14} /> {rows[0].color.name}</p>}
                    <div className="po-line-qty-grid">
                      {rows.map((c) => {
                        const v = lineText(c.key);
                        const bad = !/^\d*$/.test(v.trim());
                        return (
                          <label key={c.key} className="po-line-qty-row">
                            <span className="po-line-qty-name" title={`${c.shape.name} ${c.size.size_mm} mm${pickColorIds.length > 1 ? '' : ` · ${c.color.name}`}`}>
                              <b>{shortShape.get(c.shape.id)}</b> {swiss ? swissSizeLabel(c.size.size_mm) : c.size.size_mm}
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="po-qty-input"
                              aria-label={`Quantity for ${c.shape.name} ${c.size.size_mm} mm ${c.color.name}`}
                              aria-invalid={bad || undefined}
                              placeholder="0"
                              value={v}
                              onChange={(e) => setLineQty((cur) => ({ ...cur, [c.key]: expandQtyShorthand(e.target.value) }))}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {lineInvalid && <p className="po-field-error" role="alert">Whole numbers only — fix the highlighted line.</p>}
            </>}
          </div>
        )}
        {sizeGrid && (
          <SizeGridComposer
            shapes={gridShapes}
            sizes={sizes}
            entries={gridEntries}
            onEntries={setGridEntries}
            shapeId={gridShapeId}
            onShape={setGridShapeId}
            onPanelChange={setGridPanelOpen}
          />
        )}

        {QUOTATIONS_ENABLED && <>
        <div className="po-type-toggle" role="group" aria-label="Request type">
          <button
            type="button"
            aria-pressed={pickRequestType === 'Place Order'}
            className={pickRequestType === 'Place Order' ? 'active' : ''}
            onClick={() => setPickRequestType('Place Order')}
          >
            Purchase
          </button>
          <button
            type="button"
            aria-pressed={pickRequestType === 'Request Quotation'}
            aria-disabled={!selectionHasUnpriced || undefined}
            aria-describedby={selectionHasUnpriced ? undefined : 'po-type-priced-note'}
            className={`${pickRequestType === 'Request Quotation' ? 'active' : ''}${selectionHasUnpriced ? '' : ' po-type-unavailable'}`}
            onClick={() => { if (selectionHasUnpriced) setPickRequestType('Request Quotation'); }}
          >
            Request Quotation
          </button>
        </div>
        {isQuotation && !sizeGrid && <p className="po-type-hint">Quantity is optional for a quotation — we&rsquo;ll send prices, then you decide.</p>}
        {/* A tooltip never shows on a phone, so the reason is printed. */}
        {!selectionHasUnpriced && <p className="po-type-hint" id="po-type-priced-note">Price already listed — no quotation needed.</p>}
        </>}
        {!sizeGrid && selectionPrice && (
          <p className="po-price-preview" role="status">
            <strong>₹{formatRupees(selectionPrice.min)}{selectionPrice.max !== selectionPrice.min && <>–₹{formatRupees(selectionPrice.max)}</>}</strong>
            {' '}per {priceUnitLabel(priceUnit)}
            {qtyNum > 0 && !multiCarat && !perLine && <> · est. ₹{formatRupees(selectionPrice.sum * qtyNum)}</>}
          </p>
        )}

        {sizeGrid ? (gridPanelOpen ? null : <>
          <button type="button" className="po-add-line-btn" onClick={addGridLines} disabled={!gridLineList.length || gridInvalid}>
            {gridLineList.length > 1 ? `+ Add ${countLabel(gridLineList)} to order` : '+ Add to order'}
          </button>
          {!gridInvalid && gridSummary(gridLineList) && (
            <p className="po-selection-summary" role="status">{gridSummary(gridLineList)}</p>
          )}
          {gridLineList.length > 0 && (
            <button
              type="button"
              className="po-clear-selection"
              onClick={() => { if (confirmGridClear) { setGridEntries({}); setConfirmGridClear(false); } else setConfirmGridClear(true); }}
            >
              {confirmGridClear ? `Tap again to clear ${countLabel(gridLineList)}` : 'Clear all'}
            </button>
          )}
        </>) : <>
        {tableMode ? <>
          <button type="button" className="po-add-line-btn" onClick={addTableLines} disabled={!tableCanAdd}>
            + Add {tableAddCount > 1 ? `${tableAddCount} lines` : 'line'} to order
          </button>
          {grades.length > 0 && !grades.includes(pickGrade) && <p className="po-type-hint">Choose a {qualityLabel.toLowerCase()} ({grades.join(' or ')}) to add this.</p>}
          {!tableCanAdd && hasSelection && missingFields.length > 0 && (
            <p className="po-type-hint po-missing-hint">Still needed: {missingFields.join(', ')}</p>
          )}
          {tableCanAdd && (
            <p className="po-selection-summary" role="status">
              {tableAddCount.toLocaleString('en-IN')} {tableAddCount === 1 ? 'line' : 'lines'} = {quantityField?.unit ? formatQty(tablePieces, quantityField.unit) : `${tablePieces.toLocaleString('en-IN')} pcs`}
            </p>
          )}
          {hasSelection && <button type="button" className="po-clear-selection" onClick={clearSelection}>Clear selection</button>}
        </> : <>
        <button type="button" className="po-add-line-btn" onClick={addLine} disabled={!canAdd}>
          + Add {(perLine ? filledLines : comboCount) > 1 ? `${perLine ? filledLines : comboCount} lines` : 'line'} to order
        </button>
        {grades.length > 0 && !pickGrade && pickShapeIds.length > 0 && <p className="po-type-hint">Choose a {qualityLabel.toLowerCase()} ({grades.join(' or ')}) to add this.</p>}
        {/* A grey button alone doesn't say what's missing. Only once the buyer
            has started, so an untouched form isn't greeted with a to-do list. */}
        {!canAdd && hasSelection && missingFields.length > 0 && (
          <p className="po-type-hint po-missing-hint">Still needed: {missingFields.join(', ')}</p>
        )}
        {canAdd && perLine
          ? <p className="po-selection-summary" role="status">{filledLines.toLocaleString('en-IN')} {filledLines === 1 ? 'line' : 'lines'} = {quantityField?.unit ? formatQty(lineTotal, quantityField.unit) : `${lineTotal.toLocaleString('en-IN')} pcs`} to add</p>
          : canAdd && multiCarat
          ? <p className="po-selection-summary" role="status">{comboCount.toLocaleString('en-IN')} lines · ~{(pickedRows.reduce((sum, r) => sum + (r.pcs_per_ct ? ctNum * r.pcs_per_ct : qtyNum), 0) * Math.max(1, pickColorIds.length)).toLocaleString('en-IN')} pcs to add</p>
          : canAdd && (quantityField?.unit
          ? <p className="po-selection-summary" role="status">{comboCount.toLocaleString('en-IN')} {comboCount === 1 ? 'item' : 'items'} × {formatQty(qtyNum, quantityField.unit)} = {formatQty(comboCount * qtyNum, quantityField.unit)} to add</p>
          : <p className="po-selection-summary" role="status">{comboCount.toLocaleString('en-IN')} {comboCount === 1 ? 'line' : 'lines'} × {caratRate ? '~' : ''}{qtyNum.toLocaleString('en-IN')} pcs = {caratRate ? '~' : ''}{(comboCount * qtyNum).toLocaleString('en-IN')} pcs to add</p>)}
        {/* Adding a line deliberately keeps the shape and colour so several
            sizes can be added in a row; this is the way back to an empty form
            without reloading the page. Plain text, not a button -- it sits
            under the primary action and must not compete with it. */}
        {hasSelection && (
          <button type="button" className="po-clear-selection" onClick={clearSelection}>Clear selection</button>
        )}
        </>}
        </>}
        </>}
        </div>
      </section>

      {/* No photo grid here: the reference beside the controls above already
          shows what the buyer needs while choosing, and Explore Photos is where
          the full set lives. Repeating them here meant two carousels on one
          screen. */}

      {toast && (
        <div className="po-toast" role="status" aria-live="polite">
          {toast}
          {undoCart && (
            <button type="button" className="po-toast-undo" onClick={() => { setCart(undoCart); setUndo(null); setToast('Undone — your order is as it was'); }}>
              Undo
            </button>
          )}
        </div>
      )}

      {/* Running total, always on screen once there's something to total, and
          the route through to the full requirement at /po/cart. */}
      {hydrated && cart.length > 0 && (
        <div className={`po-summary-bar${justAdded ? ' po-summary-bar--bump' : ''}`} key={justAdded}>
          <div className="po-summary-figures">
            <span className="po-summary-label">Your requirement</span>
            <span className="po-summary-counts">
              {cart.length} {cart.length === 1 ? 'item' : 'items'} · {formatQtyTotals(cart.map((i) => ({ qty: i.qty, unit: i.categoryId === categoryId ? quantityField?.unit : i.qtyUnit })))}
            </span>
            {/* Its own line: squeezed onto the counts it was cut to "₹12,1…" on a phone. */}
            {hasAnyPricedLine && <span className="po-summary-total">₹{formatRupees(cartTotalInr)}</span>}
          </div>
          <Link href="/po/cart" className="po-summary-action">Review &amp; send</Link>
        </div>
      )}
    </div>
  );
}
