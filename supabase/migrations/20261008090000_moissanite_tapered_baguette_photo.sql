-- Moissanite's Tapered Baguette borrowed the Trapezoid photo as its
-- category-specific reference, which hid the shape's own photo set on
-- Admin > Shapes. Clear just that override so the shape's photo shows.
-- Guarded on the old value, so a photo the team uploads later is never undone.
update public.category_shapes
   set ref_photo_url = null
 where category_id = 34
   and shape_id = 82
   and ref_photo_url = '/moissanite-shapes/trapezoid.png';
