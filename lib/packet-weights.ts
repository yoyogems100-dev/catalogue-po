import { formatQtyTotals, formatWeight, type WeightUnit } from './quantity-field';

// Goods go out in packets: every line of one shape, or of one shape and size,
// packed together -- "12 materials of Oval 6x8 mm in one packet" -- and the
// team weighs the packet, not each material. Stored on orders.packet_weights.

export type PacketMode = 'shape' | 'shape_size';
export type PacketWeight = { categoryId: number; shapeId: number; sizeId: number | null; weight: number; unit: WeightUnit };
export type PacketWeights = { mode: PacketMode; packets: PacketWeight[] };

export type PacketLine = {
  categoryId: number;
  categoryName: string;
  shapeId: number | null;
  shapeName: string;
  sizeId: number | null;
  sizeMm: string;
  quantity: number;
  qtyUnit?: string | null;
};

export type PacketGroup = {
  key: string;
  categoryId: number;
  shapeId: number;
  sizeId: number | null;
  /** "Oval 6x8 mm", or "Oval" when packed by shape. */
  label: string;
  categoryName: string;
  lines: number;
  /** "96 lines", "2,000 pcs". */
  quantity: string;
  /** "12 materials" for bead lines, "3 colours" for stones. */
  count: string;
};

export function packetKey(categoryId: number, shapeId: number, sizeId: number | null) {
  return `${categoryId}:${shapeId}:${sizeId ?? '*'}`;
}

/** The packets an order's lines fall into, in the order lines first appear. */
export function packetGroups(lines: PacketLine[], mode: PacketMode): PacketGroup[] {
  const groups = new Map<string, PacketGroup & { items: { qty: number; unit?: string | null }[] }>();
  for (const line of lines) {
    if (!line.shapeId) continue;
    const sizeId = mode === 'shape_size' ? line.sizeId : null;
    const key = packetKey(line.categoryId, line.shapeId, sizeId);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        categoryId: line.categoryId,
        shapeId: line.shapeId,
        sizeId,
        label: mode === 'shape_size' ? `${line.shapeName} ${line.sizeMm} mm` : line.shapeName,
        categoryName: line.categoryName,
        lines: 0,
        quantity: '',
        count: '',
        items: []
      };
      groups.set(key, group);
    }
    group.lines += 1;
    group.items.push({ qty: line.quantity, unit: line.qtyUnit });
  }
  return [...groups.values()].map(({ items, ...group }) => {
    const word = items.some((i) => i.unit) ? 'material' : 'colour';
    return { ...group, quantity: formatQtyTotals(items), count: `${group.lines} ${word}${group.lines === 1 ? '' : 's'}` };
  });
}

/** Checks what the admin form (or the column) holds; undefined when unusable. */
export function normalizePacketWeights(raw: unknown): PacketWeights | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const mode = (raw as any).mode;
  if (mode !== 'shape' && mode !== 'shape_size') return undefined;
  const list = (raw as any).packets;
  if (!Array.isArray(list) || list.length > 500) return undefined;
  const packets: PacketWeight[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    const categoryId = Number(p?.categoryId);
    const shapeId = Number(p?.shapeId);
    const sizeId = mode === 'shape_size' && p?.sizeId != null ? Number(p.sizeId) : null;
    const weight = Number(p?.weight);
    const unit = p?.unit === 'ct' ? 'ct' : p?.unit === 'g' ? 'g' : null;
    if (!Number.isSafeInteger(categoryId) || categoryId < 1 || !Number.isSafeInteger(shapeId) || shapeId < 1) return undefined;
    if (sizeId !== null && (!Number.isSafeInteger(sizeId) || sizeId < 1)) return undefined;
    if (!Number.isFinite(weight) || weight <= 0 || weight >= 1e9 || !unit) return undefined;
    const key = packetKey(categoryId, shapeId, sizeId);
    if (seen.has(key)) continue;
    seen.add(key);
    packets.push({ categoryId, shapeId, sizeId, weight: Math.round(weight * 1000) / 1000, unit });
  }
  return { mode, packets };
}

/** Packets that have a weight, labelled for a document. */
export function weighedPackets(lines: PacketLine[], saved: PacketWeights | null | undefined) {
  if (!saved?.packets.length) return [];
  const byKey = new Map(saved.packets.map((p) => [packetKey(p.categoryId, p.shapeId, p.sizeId), p]));
  return packetGroups(lines, saved.mode)
    .filter((g) => byKey.has(g.key))
    .map((g) => {
      const p = byKey.get(g.key)!;
      return { ...g, weight: formatWeight(p.weight, p.unit) };
    });
}
