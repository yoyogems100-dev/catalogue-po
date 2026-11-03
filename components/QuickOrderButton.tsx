'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import IconSelect from './IconSelect';
import ColorSwatch from './ColorSwatch';
import { facetAvailability, pickedSizeRows, sizeGroupsOf } from '@/lib/faceted-picker';
import { incompatibleShapeIds, NO_SHARED_SIZE_NOTE, NO_SHARED_SIZE_REASON } from '@/lib/shape-size-compat';
import SpecialOrderComposer from './SpecialOrderComposer';
import OrderReferenceCarousel from './OrderReferenceCarousel';
import type { OrderReferencePhoto } from '@/lib/order-reference-photos';
import { specialCategory, specText, quantityFactor, categoryGrades, gradeSpec } from '@/lib/order-specs';
import { DEFAULT_COLOR_BUTTONS, colorButtonFamilies, colorFamilyId } from '@/lib/color-family';
import { preferenceForFamily } from '@/lib/customer-preferences';
import { useCategoryQualities, useColorButtons, useColorFamilies, useOrderPreferences, useOwnOrderPreferences, useShapeQualities } from './useOrderPreferences';
import { lineQualities, pickQualities } from '@/lib/qualities';
import { useCatalogueMap } from './useCatalogueMap';
import { anyLines, shapesOf, sizeKeysOf, stonesForFamilies, stonesForPicks } from '@/lib/quick-order-any';
import { VOICE_ORDER_OPEN_EVENT, MicIcon } from './VoiceOrderButton';

/** Home-page colour chips open Quick Order already started on a colour. */
export const QUICK_ORDER_COLOR_EVENT = 'yoyo:quick-order-color';
import { categoryIconUrl } from '@/lib/category-icons';
import type { CategoryPricing } from '@/lib/pricing-calc';
import { loadCart, saveCart, mergeIntoCart, cartPieces, QUOTATIONS_ENABLED, ANY_CATEGORY_ID, ANY_CATEGORY_NAME, type CartItem, type RequestType } from '@/lib/cart-storage';

type CategoryOption = { id: number; name: string; slug: string };
type CategoryOptionsData = {
  shapes: { id: number; name: string; iconKey?: string | null; refPhotoUrl?: string | null }[];
  colors: { id: number; name: string; hex?: string | null; refPhotoUrl?: string | null }[];
  sizes: { id: number; shapeId: number; sizeMm: string }[];
  photos: OrderReferencePhoto[];
  colorChartUrl?: string | null;
  pricing?: CategoryPricing;
};

// Matches a plain "1" / "1.5", or a compound "AxB"/"A*B" -- same rule as the
// category-page picker, so a mixed size list sorts the same way everywhere.
function strictSizeNum(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(?:[xX*]\s*\d+(?:\.\d+)?)?$/);
  return m ? parseFloat(m[1]) : NaN;
}

/**
 * A self-contained "Quick Order" trigger + pop-up, in the spirit of ColorChart
 * or CartBag: it owns its own open state and writes straight to the shared
 * cart (lib/cart-storage.ts), so it can be dropped in anywhere -- the account
 * header, the cart page -- without any page needing to fetch categories or
 * manage cart state itself. Adding a line here doesn't leave the pop-up; it
 * resets shape/color/size/qty so several lines can be added back to back,
 * same as the category-page builder.
 */
export default function QuickOrderButton({ label = 'Quick Order', listenForColorStart = false }: { label?: string; listenForColorStart?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const [allCategories, setAllCategories] = useState<CategoryOption[] | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [optionsCache, setOptionsCache] = useState<Record<number, CategoryOptionsData>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [pickCategoryId, setPickCategoryId] = useState<number | ''>('');
  const [pickShapeIds, setPickShapeIds] = useState<number[]>([]);
  const [pickColorIds, setPickColorIds] = useState<number[]>([]);
  const [pickSizeIdxs, setPickSizeIdxs] = useState<number[]>([]);
  const [pickQty, setPickQty] = useState('');
  const [pickRequestType, setPickRequestType] = useState<RequestType>('Place Order');
  const [addedCount, setAddedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [cartCount, setCartCount] = useState(0);

  // Colour-first ordering: "Red" + the buyer's usual picks -> Ruby Corundum 5A.
  // Only a stone the team mapped for this buyer opens by itself; with none,
  // the stone stays open and the line goes in as "Stone to confirm" (owner,
  // 2026-11-03). The shop defaults still supply a usual quality.
  const preferences = useOrderPreferences();
  const ownPreferences = useOwnOrderPreferences();
  const families = useColorFamilies();
  const qualities = useCategoryQualities();
  const shapeQualities = useShapeQualities();
  const colorButtons = colorButtonFamilies(useColorButtons() ?? DEFAULT_COLOR_BUTTONS, Object.fromEntries(families.map((f) => [f.id, f.name])));
  // Colour families picked -- the colours of a stone-less line, and the
  // filter on a stone's colour list once one is chosen.
  const [pickFamilies, setPickFamilies] = useState<number[]>([]);
  const pickFamily = pickFamilies[0] ?? null;
  // Sizes of a stone-less line, as sizeKey() spells them.
  const [pickSizeKeys, setPickSizeKeys] = useState<string[]>([]);
  // Shapes and sizes carried over when the stone is chosen or cleared.
  const [pendingCarry, setPendingCarry] = useState<{ shapeIds: number[]; sizeKeys: string[] } | null>(null);
  const [pickGrade, setPickGrade] = useState('');
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null);
  // Before a stone is chosen, shapes and sizes come from every stone that
  // carries the chosen colours (lib/quick-order-any).
  const catalogueMap = useCatalogueMap(open);
  const [pendingPick, setPendingPick] = useState<{ shapeId: number | null; size: string | null; colorId?: number | null } | null>(null);

  function chooseFamilies(next: number[]) {
    setPickFamilies(next);
    setPickColorIds([]);
    setMessage('');
    // The buyer's own stone for a colour opens when it is the only colour.
    const pref = next.length === 1 && pickCategoryId === '' ? preferenceForFamily(ownPreferences, next[0]) : null;
    if (pref) setPendingCategoryId(pref.categoryId);
  }
  function toggleFamily(familyId: number) {
    chooseFamilies(pickFamilies.includes(familyId) ? pickFamilies.filter((id) => id !== familyId) : [...pickFamilies, familyId]);
  }

  // The category list may still be loading when a colour is chosen (a home
  // chip opens the dialog and picks in one go), so the jump waits for it.
  useEffect(() => {
    if (pendingCategoryId == null || !allCategories) return;
    const id = pendingCategoryId;
    setPendingCategoryId(null);
    if (!allCategories.some((c) => c.id === id)) return;
    void handleCategoryChange(String(id), { keepFamily: true });
    // The shape, size and quantity the team preset for this colour; the
    // pendingPick effect drops a shape or size this stone no longer carries.
    const pref = pickFamily ? preferenceForFamily(ownPreferences, pickFamily) : null;
    if (pref?.categoryId !== id) return;
    if (pref.shapeId || pref.size || pref.colorId) setPendingPick({ shapeId: pref.shapeId ?? null, size: pref.size ?? null, colorId: pref.colorId ?? null });
    if (pref.qty) setPickQty(String(pref.qty));
  }, [pendingCategoryId, allCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!listenForColorStart) return;
    function onStart(e: Event) {
      const familyId = Number((e as CustomEvent).detail?.familyId);
      setOpen(true);
      if (familyId) chooseFamilies([familyId]);
    }
    window.addEventListener(QUICK_ORDER_COLOR_EVENT, onStart);
    return () => window.removeEventListener(QUICK_ORDER_COLOR_EVENT, onStart);
  }); // re-bound each render so chooseFamilies sees the latest preferences

  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);

  useEffect(() => {
    if (!open || allCategories || loadingCategories) return;
    setLoadingCategories(true);
    fetch('/api/app/categories')
      .then((res) => res.json())
      .then((data) => setAllCategories((data.categories || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))))
      .catch(() => setAllCategories([]))
      .finally(() => setLoadingCategories(false));
  }, [open, allCategories, loadingCategories]);

  function close() { dialog.current?.close(); }

  function reset() {
    setPickFamilies([]);
    setPickSizeKeys([]);
    setPendingCarry(null);
    setPickGrade('');
    setPendingCategoryId(null);
    setPickCategoryId('');
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setPickQty('');
    setPickRequestType('Place Order');
    setMessage('');
  }

  async function handleCategoryChange(idStr: string, opts: { keepFamily?: boolean } = {}) {
    const id = idStr ? Number(idStr) : '';
    // The colours stay as the filter, and the shapes and sizes picked so far
    // carry over to the stone (or back to "any stone") where it has them.
    const sizeKeys = pickCategoryId === '' ? pickSizeKeys : pickSizeIdxs.map((i) => sizeGroups[i]?.key).filter((k): k is string => !!k);
    const carry = { shapeIds: pickShapeIds, sizeKeys };
    setPickCategoryId(id);
    setPickShapeIds([]);
    setPickColorIds([]);
    setPickSizeIdxs([]);
    setPickSizeKeys([]);
    setMessage('');
    if (opts.keepFamily) setPendingCarry(null);
    else if (id === '') { setPickShapeIds(carry.shapeIds); setPickSizeKeys(carry.sizeKeys); }
    else setPendingCarry(carry);
    // The buyer's usual grade for this stone -- from the colour they started
    // with if that points here, else any usual pick for this category.
    const grades = typeof id === 'number' ? categoryGrades(id, qualities) : [];
    const fromFamily = opts.keepFamily && pickFamily ? preferenceForFamily(preferences, pickFamily) : null;
    const usual = (fromFamily?.categoryId === id ? fromFamily : null) || preferences.find((p) => p.categoryId === id && p.grade);
    setPickGrade(usual?.grade && grades.includes(usual.grade) ? usual.grade : grades.length === 1 ? grades[0] : '');
    if (!id || optionsCache[id]) return;
    const cat = allCategories?.find((c) => c.id === id);
    if (!cat) return;
    setLoadingOptions(true);
    try {
      const res = await fetch(`/api/app/categories/${cat.slug}`);
      const data = await res.json();
      setOptionsCache((cur) => ({ ...cur, [id]: { shapes: data.shapes || [], colors: data.colors || [], sizes: data.sizes || [], photos: data.photos || [], colorChartUrl: data.colorChartUrl, pricing: data.pricing } }));
    } finally {
      setLoadingOptions(false);
    }
  }

  const currentOptions = typeof pickCategoryId === 'number' ? optionsCache[pickCategoryId] : null;
  const currentCategory = typeof pickCategoryId === 'number' ? allCategories?.find((c) => c.id === pickCategoryId) : null;

  // Same rule as the category page's builder -- a shape that shares no size
  // with what's already picked is greyed out where it's picked, not left to
  // be discovered at the size list.
  const incompatibleShapes = useMemo(
    () => incompatibleShapeIds(currentOptions?.shapes || [], currentOptions?.sizes || [], pickShapeIds),
    [currentOptions, pickShapeIds]
  );

  // Shape and size can be picked in either order: each list offers only what
  // goes with the other's picks (lib/faceted-picker). Sizes index into the
  // category's full size list, so a size picked first survives a shape pick.
  const sizeGroups = useMemo(() => sizeGroupsOf(currentOptions?.sizes || []), [currentOptions]);
  const available = useMemo(
    () => facetAvailability((currentOptions?.shapes || []).map((s) => s.id), (currentOptions?.colors || []).map((c) => c.id), sizeGroups, null,
      { shapeIds: pickShapeIds, sizeIdxs: pickSizeIdxs, colorIds: pickColorIds }),
    [currentOptions, sizeGroups, pickShapeIds, pickSizeIdxs, pickColorIds]
  );
  const shapeOptions = useMemo(() => (currentOptions?.shapes || []).filter((s) => available.shapeIds.has(s.id)), [currentOptions, available]);
  const sizeOptions = useMemo(
    () => sizeGroups
      .map((g, i) => ({ id: i, hotIds: g.rows.filter((r) => !pickShapeIds.length || pickShapeIds.includes(r.shapeId)).map((row) => row.id), name: `${g.sizeMm} mm` }))
      .filter((o) => available.sizeIdxs.has(o.id)),
    [sizeGroups, available, pickShapeIds]
  );

  // Carry the finder's shape and size into the stone the buyer chose, once
  // its options have loaded. Sizes no longer wait on a shape, so both land
  // together.
  useEffect(() => {
    if (!pendingPick || !currentOptions) return;
    const shapeId = pendingPick.shapeId && currentOptions.shapes.some((s) => s.id === pendingPick.shapeId) ? pendingPick.shapeId : null;
    if (shapeId && pickShapeIds.length === 0) setPickShapeIds([shapeId]);
    // The shade the team set for this colour (Blue -> Blue Nano #113).
    if (pendingPick.colorId && currentOptions.colors.some((c) => c.id === pendingPick.colorId)) setPickColorIds([pendingPick.colorId]);
    if (pendingPick.size) {
      const idx = sizeGroups.findIndex((g) => g.key === pendingPick.size && (!shapeId || g.rows.some((r) => r.shapeId === shapeId)));
      if (idx >= 0) setPickSizeIdxs([idx]);
    }
    setPendingPick(null);
  }, [pendingPick, currentOptions, pickShapeIds, sizeGroups]);

  useEffect(() => {
    if (!pendingCarry || !currentOptions) return;
    const shapeIds = pendingCarry.shapeIds.filter((id) => currentOptions.shapes.some((s) => s.id === id));
    if (shapeIds.length) setPickShapeIds(shapeIds);
    setPickSizeIdxs(sizeGroups.flatMap((g, i) => (
      pendingCarry.sizeKeys.includes(g.key) && (!shapeIds.length || g.rows.some((r) => shapeIds.includes(r.shapeId))) ? [i] : []
    )));
    setPendingCarry(null);
  }, [pendingCarry, currentOptions, sizeGroups]);

  // No stone chosen: colour families, then shapes and sizes from every stone
  // that carries them.
  const anyMode = pickCategoryId === '';
  const familyName = (id: number) => families.find((f) => f.id === id)?.name || colorButtons.find((f) => f.id === id)?.name || 'Colour';
  const anyShapeOptions = useMemo(
    () => (catalogueMap ? shapesOf(catalogueMap, stonesForFamilies(catalogueMap, pickFamilies)) : []),
    [catalogueMap, pickFamilies]
  );
  const anySizeKeys = useMemo(
    () => (catalogueMap ? sizeKeysOf(catalogueMap, stonesForPicks(catalogueMap, pickFamilies, pickShapeIds), pickShapeIds) : []),
    [catalogueMap, pickFamilies, pickShapeIds]
  );
  // A size the new shape doesn't come in drops out of the picks.
  useEffect(() => {
    if (!anyMode || !catalogueMap) return;
    setPickSizeKeys((cur) => (cur.every((k) => anySizeKeys.includes(k)) ? cur : cur.filter((k) => anySizeKeys.includes(k))));
  }, [anyMode, catalogueMap, anySizeKeys]);
  const anyLineList = useMemo(
    () => (anyMode && catalogueMap ? anyLines(catalogueMap, pickFamilies.map((id) => ({ id, name: familyName(id) })), pickShapeIds, pickSizeKeys) : []),
    [anyMode, catalogueMap, pickFamilies, pickShapeIds, pickSizeKeys] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // The stone list narrows to the stones that carry what's picked.
  const stoneOptions = useMemo(() => {
    if (!allCategories) return [];
    if (!anyMode || !catalogueMap || (!pickFamilies.length && !pickShapeIds.length)) return allCategories;
    const ids = new Set(stonesForPicks(catalogueMap, pickFamilies, pickShapeIds).map((c) => c.id));
    return allCategories.filter((c) => ids.has(c.id));
  }, [allCategories, anyMode, catalogueMap, pickFamilies, pickShapeIds]);

  // A picked shape/cut with its own qualities (Green OSP HW: 3A / AA) replaces
  // the category's, starting on its first.
  const { grades, start: shapeStart } = typeof pickCategoryId === 'number'
    ? pickQualities(qualities, shapeQualities, pickCategoryId, pickShapeIds)
    : { grades: [] as string[], start: '' };
  const gradesKey = grades.join('|');
  useEffect(() => {
    if (pickGrade && !grades.includes(pickGrade)) setPickGrade(shapeStart || (grades.length === 1 ? grades[0] : ''));
    else if (!pickGrade && shapeStart) setPickGrade(shapeStart);
  }, [gradesKey, shapeStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // With a colour chosen, only that family's colours are offered -- unless the
  // category has none in it, in which case hiding everything would be a dead end.
  const familyColors = useMemo(
    () => (currentOptions && pickFamilies.length ? currentOptions.colors.filter((c) => pickFamilies.includes(colorFamilyId(c.name, c.hex) ?? -1)) : []),
    [currentOptions, pickFamilies]
  );
  const colorOptions = pickFamilies.length && familyColors.length > 0 ? familyColors : currentOptions?.colors || [];
  const familyMissing = pickFamilies.length > 0 && !!currentOptions && familyColors.length === 0;
  useEffect(() => {
    if (familyColors.length === 1 && pickColorIds.length === 0) setPickColorIds([familyColors[0].id]);
  }, [familyColors]); // eslint-disable-line react-hooks/exhaustive-deps

  const qtyNum = parseInt(pickQty, 10) || 0;
  const canAdd = anyMode
    ? anyLineList.length > 0 && qtyNum > 0
    : !!currentOptions && pickShapeIds.length > 0 && pickColorIds.length > 0 && pickSizeIdxs.length > 0 && qtyNum > 0
    && (grades.length === 0 || grades.includes(pickGrade));
  const comboCount = anyMode ? anyLineList.length : pickShapeIds.length * pickColorIds.length * pickSizeIdxs.length;

  function addAnyLines() {
    if (!canAdd) {
      setMessage('Pick a colour, shape/cut and size, and enter quantity first.');
      return;
    }
    let cart = loadCart();
    for (const line of anyLineList) {
      cart = mergeIntoCart(cart, {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        categoryId: ANY_CATEGORY_ID,
        categoryName: ANY_CATEGORY_NAME,
        shapeId: line.shapeId,
        shapeName: line.shapeName,
        shapeIconKey: line.shapeIconKey,
        sizeId: line.sizeId,
        sizeMm: line.sizeMm,
        colorId: line.colorId,
        colorName: line.colorName,
        colorHex: line.colorHex || '#ccc',
        colorRefPhotoUrl: line.colorRefPhotoUrl,
        qty: qtyNum,
        requestType: pickRequestType
      });
    }
    saveCart(cart);
    setCartCount(cartPieces(cart));
    setAddedCount((n) => n + anyLineList.length);
    setMessage(anyLineList.length > 1 ? `Added ${anyLineList.length} lines to your cart.` : 'Added to your cart.');
    setPickSizeKeys([]);
  }

  function addLines() {
    if (anyMode) return addAnyLines();
    if (!canAdd || !currentOptions || !currentCategory) {
      setMessage(grades.length > 0 && !pickGrade ? `Choose a quality (${grades.join(' or ')}) first.` : 'Pick a shape/cut, color and size, and enter quantity first.');
      return;
    }
    let cart = loadCart();
    let added = 0;
    for (const shapeId of pickShapeIds) {
      const shape = currentOptions.shapes.find((s) => s.id === shapeId);
      if (!shape) continue;
      for (const colorId of pickColorIds) {
        const color = currentOptions.colors.find((c) => c.id === colorId);
        if (!color) continue;
        for (const sizeIdx of pickSizeIdxs) {
          const group = sizeGroups[sizeIdx];
          const match = group?.rows.find((r) => r.shapeId === shapeId);
          if (!match) continue;
          const item: CartItem = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            categoryId: currentCategory.id,
            categoryName: currentCategory.name,
            shapeId: shape.id,
            shapeName: shape.name,
            shapeRefPhotoUrl: shape.refPhotoUrl,
            shapeIconKey: shape.iconKey,
            sizeId: match.id,
            sizeMm: match.sizeMm,
            colorId: color.id,
            colorName: color.name,
            colorHex: color.hex || '#ccc',
            colorRefPhotoUrl: color.refPhotoUrl || null,
            qty: qtyNum,
            requestType: pickRequestType,
            ...(pickGrade && lineQualities(qualities, shapeQualities, currentCategory.id, shape.id).includes(pickGrade) ? { orderSpecs: gradeSpec(pickGrade) } : {})
          };
          cart = mergeIntoCart(cart, item);
          added++;
        }
      }
    }
    saveCart(cart);
    setCartCount(cartPieces(cart));
    setAddedCount((n) => n + added);
    setMessage(added > 1 ? `Added ${added} lines to your cart.` : 'Added to your cart.');
    // The quantity stays for the next line; only the sizes clear.
    setPickSizeIdxs([]);
  }

  function addSpecialLine(line: any) {
    const cart = mergeIntoCart(loadCart(), { ...line, id: line.id || `${Date.now()}-${Math.random().toString(16).slice(2)}` });
    saveCart(cart);
    setCartCount(cartPieces(cart));
    setAddedCount((n) => n + 1);
    setMessage('Added to your cart.');
  }

  return (
    <>
      <button type="button" className="quick-order-btn" onClick={(e) => { opener.current = e.currentTarget; setOpen(true); }}>
        + {label}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="quick-order-dialog"
          aria-label="Quick order"
          onCancel={(e) => { e.preventDefault(); close(); }}
          onClose={() => { setOpen(false); reset(); opener.current?.focus(); }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="quick-order-head">
            <strong>Quick Order</strong>
            <button type="button" autoFocus onClick={close} aria-label="Close quick order">✕</button>
          </div>
          <p className="quick-order-hint">
            Pick colour, shape, size and quantity. The stone is optional &mdash; we confirm it with you.{' '}
            <button
              type="button"
              className="po-inline-link qo-speak-link"
              onClick={() => { close(); window.dispatchEvent(new CustomEvent(VOICE_ORDER_OPEN_EVENT)); }}
            >
              <MicIcon size={13} /> Or speak your order
            </button>
          </p>

          {colorButtons.length > 0 && <div className="qo-family-chips" role="group" aria-label="Colours">
            {colorButtons.map((f) => {
              const usual = preferenceForFamily(ownPreferences, f.id);
              const usualName = usual ? allCategories?.find((c) => c.id === usual.categoryId)?.name : null;
              const active = pickFamilies.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`qo-family-chip${active ? ' active' : ''}`}
                  aria-pressed={active}
                  title={usualName ? `${usualName}${usual?.grade ? ` ${usual.grade}` : ''}` : undefined}
                  ref={pickFamily === f.id ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
                  onClick={() => toggleFamily(f.id)}
                >
                  <ColorSwatch hex={f.hex} refPhotoUrl={f.refPhotoUrl} size={22} />
                  {f.name}
                </button>
              );
            })}
          </div>}

          <div className="po-add-form" data-special-category={specialCategory(Number(pickCategoryId)) || undefined}>
            <div>
              <label className="po-label">Color{(anyMode ? pickFamilies : pickColorIds).length > 1 ? 's' : ''}</label>
              {familyMissing && <p className="quick-order-hint" style={{ margin: '0 0 6px' }}>No {familyName(pickFamily!).toLowerCase()} in this stone — showing all colours.</p>}
              {/* Before a stone is chosen a colour is a colour family -- White,
                  Red -- same as the buttons above; a stone lists its own shades. */}
              {anyMode || !currentOptions ? (
                <IconSelect
                  multiple
                  options={colorButtons.length > 0 ? colorButtons : families}
                  values={pickFamilies}
                  onChange={chooseFamilies}
                  closeOnFirstPick={pickShapeIds.length === 0}
                  placeholder="Choose colour(s)"
                  leading="swatch"
                />
              ) : (
                <IconSelect
                  categoryId={Number(pickCategoryId) || undefined}
                  multiple
                  options={colorOptions}
                  locked={pickCategoryId === 34}
                  values={pickColorIds}
                  onChange={setPickColorIds}
                  closeOnFirstPick={pickShapeIds.length === 0}
                  placeholder="Choose color(s)"
                  leading="swatch"
                />
              )}
            </div>
            <div>
              <label className="po-label">Shape/Cut</label>
              {anyMode ? (
                <IconSelect
                  multiple
                  options={anyShapeOptions}
                  values={pickShapeIds}
                  onChange={setPickShapeIds}
                  closeOnFirstPick={pickFamilies.length === 0}
                  placeholder={catalogueMap ? 'Choose shape(s)' : 'Loading shapes…'}
                  leading="icon"
                />
              ) : (
                <IconSelect
                  categoryId={Number(pickCategoryId) || undefined}
                  multiple
                  options={shapeOptions}
                  values={pickShapeIds}
                  onChange={setPickShapeIds}
                  closeOnFirstPick={pickColorIds.length === 0}
                  placeholder={!currentOptions ? 'Loading shapes…' : 'Choose shape(s)'}
                  leading="icon"
                  disabledIds={incompatibleShapes}
                  disabledReason={NO_SHARED_SIZE_REASON}
                  disabledNote={NO_SHARED_SIZE_NOTE}
                />
              )}
            </div>
            <div>
              <label className="po-label">Size{(anyMode ? pickSizeKeys : pickSizeIdxs).length > 1 ? 's' : ''} (mm)</label>
              {anyMode ? (
                <IconSelect
                  multiple
                  optionKind="size"
                  options={anySizeKeys.map((key, i) => ({ id: i + 1, name: `${key} mm` }))}
                  values={pickSizeKeys.map((k) => anySizeKeys.indexOf(k) + 1).filter((id) => id > 0)}
                  onChange={(ids) => setPickSizeKeys(ids.map((id) => anySizeKeys[id - 1]).filter(Boolean))}
                  placeholder={!catalogueMap ? 'Loading sizes…' : anySizeKeys.length === 0 ? 'No size matches these picks' : 'Choose size(s)'}
                />
              ) : (
                <IconSelect
                  categoryId={Number(pickCategoryId) || undefined}
                  multiple
                  optionKind="size"
                  options={sizeOptions}
                  values={pickSizeIdxs}
                  onChange={setPickSizeIdxs}
                  placeholder={!currentOptions ? 'Loading sizes…' : sizeOptions.length === 0 ? 'No size matches these picks' : 'Choose size(s)'}
                />
              )}
            </div>
            <div>
              <label className="po-label">Stone <span className="qo-optional">(optional)</span></label>
              <IconSelect
                options={stoneOptions.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
                value={pickCategoryId === '' ? 'all' : pickCategoryId}
                onChange={(v) => handleCategoryChange(v === 'all' ? '' : String(v))}
                allLabel={loadingCategories ? 'Loading stones…' : 'Any stone — we confirm'}
                leading="photo"
                searchable
              />
            </div>
            {grades.length > 0 && (
              <div>
                <label className="po-label" id="qo-grade-label">Quality</label>
                <div className="po-type-toggle po-grade-toggle" role="group" aria-labelledby="qo-grade-label">
                  {grades.map((g) => (
                    <button key={g} type="button" aria-pressed={pickGrade === g} className={pickGrade === g ? 'active' : ''} onClick={() => setPickGrade(g)}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="po-label">Qty (pcs)</label>
              <input
                type="text"
                inputMode="numeric"
                className="po-qty-input"
                placeholder="e.g. 5000"
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          {loadingOptions && <p className="quick-order-hint">Loading category options…</p>}

          {currentOptions && currentCategory && (
            <OrderReferenceCarousel
              colorChartUrl={currentOptions.colorChartUrl}
              photos={currentOptions.photos}
              categoryName={currentCategory.name}
              shapeIds={pickShapeIds}
              colorIds={pickColorIds}
              sizeIds={pickedSizeRows(sizeGroups, pickSizeIdxs, pickShapeIds).map((row) => row.id)}
              shapes={currentOptions.shapes}
              colors={currentOptions.colors}
            />
          )}

          {specialCategory(Number(pickCategoryId)) && currentOptions && (
            <SpecialOrderComposer
              key={pickCategoryId}
              categoryId={Number(pickCategoryId)}
              categoryName={currentCategory?.name || ''}
              shapes={currentOptions.shapes}
              colors={currentOptions.colors}
              sizes={currentOptions.sizes}
              onAdd={addSpecialLine}
            />
          )}
          <div hidden={!!specialCategory(Number(pickCategoryId))}>
            <div className="po-type-toggle" role="group" aria-label="Request type" hidden={!QUOTATIONS_ENABLED}>
              <button type="button" aria-pressed={pickRequestType === 'Place Order'} className={pickRequestType === 'Place Order' ? 'active' : ''} onClick={() => setPickRequestType('Place Order')}>Purchase</button>
              <button type="button" aria-pressed={pickRequestType === 'Request Quotation'} className={pickRequestType === 'Request Quotation' ? 'active' : ''} onClick={() => setPickRequestType('Request Quotation')}>Request Quotation</button>
            </div>
            <button type="button" className="po-add-line-btn" onClick={addLines} disabled={!canAdd}>
              + Add {comboCount > 1 ? `${comboCount} lines` : 'line'} to cart
            </button>
            {/* Adding keeps the stone, shape and colour so the next line is
                quick; this empties the form completely, stone included. */}
            {(pickCategoryId !== '' || pickFamilies.length > 0 || pickSizeKeys.length > 0 || pickShapeIds.length > 0 || pickColorIds.length > 0 || pickSizeIdxs.length > 0 || pickQty !== '') && (
              <button type="button" className="po-clear-selection" onClick={reset}>Clear selection</button>
            )}
          </div>

          {message && <p className="quick-order-message" aria-live="polite">{message}</p>}

          <div className="quick-order-footer">
            <span>{addedCount > 0 ? `${addedCount} line${addedCount === 1 ? '' : 's'} added this session` : ''}</span>
            <Link href="/po/cart" className="btn-ghost" onClick={close}>Go to cart{cartCount > 0 ? ` (${cartCount})` : ''}</Link>
          </div>
        </dialog>
      )}
    </>
  );
}
