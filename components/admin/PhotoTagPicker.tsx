'use client';

import MultiSelect from '@/components/MultiSelect';

export type PhotoTagSet = { shapeIds: number[]; sizeIds: number[]; colorIds: number[]; tagIds: number[] };
export const EMPTY_TAG_SET: PhotoTagSet = { shapeIds: [], sizeIds: [], colorIds: [], tagIds: [] };
export const tagSetCount = (t: PhotoTagSet) => t.shapeIds.length + t.sizeIds.length + t.colorIds.length + t.tagIds.length;

type Option = { id: number; name: string; iconKey?: string | null; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };

/** Shapes / sizes / colours / specifications to put on several photos at
 *  once -- the batch being uploaded, or the photos ticked in Select mode.
 *  Offers only what this category carries. */
export default function PhotoTagPicker({
  categoryId,
  shapes,
  sizes,
  colors,
  tags,
  value,
  onChange,
  colorLabel = 'Color'
}: {
  categoryId: number;
  shapes: Option[];
  sizes: Size[];
  colors: Option[];
  tags: Option[];
  value: PhotoTagSet;
  onChange: (next: PhotoTagSet) => void;
  colorLabel?: string;
}) {
  // Sizes follow the chosen shapes, the same as the per-photo editor; with no
  // shape chosen every size is offered, labelled with its shape.
  const shapeName = new Map(shapes.map((s) => [s.id, s.name]));
  const sizeOptions = sizes
    .filter((s) => value.shapeIds.length === 0 || value.shapeIds.includes(s.shape_id))
    .map((s) => ({ id: s.id, name: value.shapeIds.length === 1 ? `${s.size_mm} mm` : `${s.size_mm} mm · ${shapeName.get(s.shape_id) || ''}` }));

  const toggle = (key: keyof PhotoTagSet) => (id: number, selected: boolean) => {
    const nextIds = selected ? value[key].filter((v) => v !== id) : [...value[key], id];
    const next = { ...value, [key]: nextIds };
    // Unticking a shape drops sizes that belonged only to it.
    if (key === 'shapeIds' && nextIds.length) {
      next.sizeIds = value.sizeIds.filter((sid) => sizes.some((s) => s.id === sid && nextIds.includes(s.shape_id)));
    }
    onChange(next);
  };

  return (
    <div className="photo-upload-grid">
      <div className="ps-field">
        <label>Shapes</label>
        <MultiSelect closeOnFirstPick categoryId={categoryId} optionKind="shape" options={shapes} selectedIds={value.shapeIds}
          onToggle={toggle('shapeIds')} leading="icon" placeholder="No shape" emptyHint="This category has no shapes linked yet." />
      </div>
      <div className="ps-field">
        <label>Sizes</label>
        <MultiSelect closeOnFirstPick categoryId={categoryId} optionKind="size" options={sizeOptions} selectedIds={value.sizeIds}
          onToggle={toggle('sizeIds')} placeholder="No size"
          emptyHint={value.shapeIds.length ? 'No sizes for the chosen shapes.' : 'This category has no sizes linked yet.'} />
      </div>
      <div className="ps-field">
        <label>{colorLabel}s</label>
        <MultiSelect closeOnFirstPick categoryId={categoryId} optionKind="color" options={colors} selectedIds={value.colorIds}
          onToggle={toggle('colorIds')} leading="swatch" placeholder={`No ${colorLabel.toLowerCase()}`} emptyHint={`This category has no ${colorLabel.toLowerCase()}s linked yet.`} />
      </div>
      <div className="ps-field">
        <label>Specifications</label>
        <MultiSelect closeOnFirstPick categoryId={categoryId} optionKind="tag" options={tags} selectedIds={value.tagIds}
          onToggle={toggle('tagIds')} placeholder="No specification" emptyHint="This category has no specifications yet." />
      </div>
    </div>
  );
}
