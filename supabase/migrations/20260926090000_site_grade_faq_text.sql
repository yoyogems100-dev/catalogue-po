-- Starting text for the Quality Grades page and the FAQ page.
--
-- Additive and repeat-safe: a grade's summary/description is only filled in
-- while it is still empty, and FAQs are only added while the table is empty,
-- so nothing the owner has written is ever overwritten. Everything here is
-- editable under Admin → Website → Grades / FAQ.

BEGIN;

UPDATE public.site_grades g SET
  summary     = CASE WHEN g.summary = '' THEN v.summary ELSE g.summary END,
  description = CASE WHEN g.description = '' THEN v.description ELSE g.description END
FROM (VALUES
  ('a',  'Entry commercial grade for high-volume fashion jewellery.',
         '<p>Cut to shape and polished, with softer facet edges and more variation from stone to stone than the higher grades. Suited to costume and fashion pieces where the stones are small or set in quantity.</p>'),
  ('3a', 'The everyday standard for jewellery manufacturing.',
         '<p>Cleaner facets and a brighter polish than A, with good consistency across a lot. The usual choice for silver and plated jewellery.</p>'),
  ('4a', 'A step up from 3A in cut and polish.',
         '<p>Sharper facet edges and a more even polish than 3A, for pieces where the stones are seen up close.</p>'),
  ('5a', 'Top machine-cut grade: precise facets, bright polish.',
         '<p>Facets meet cleanly and the polish is bright, so the stone returns more light. Used in fine silver and gold, and for centre stones where the stone carries the design.</p>'),
  ('7a', 'Sorted to a tighter standard than 5A.',
         '<p>Cut, polish and consistency are sorted to a tighter standard than 5A. For solitaires and high-value pieces where the stone is the centre of attention.</p>'),
  ('hd-swiss', 'High density CZ, the top of our CZ range.',
         '<p>A denser CZ material cut to our top standard. It feels heavier in the hand than regular CZ and is chosen for pieces that sit alongside fine jewellery.</p>')
) AS v(code, summary, description)
WHERE g.code = v.code AND (g.summary = '' OR g.description = '');

INSERT INTO public.site_faqs (question, answer, sort_order)
SELECT v.question, v.answer, v.sort_order
FROM (VALUES
  ('How do I get your full catalogue?',
   '<p>Fill in the <a href="/request-catalogue">catalogue request</a> with your WhatsApp number. We share the digital catalogue on WhatsApp within 24 working hours.</p>', 10),
  ('Why are there no prices on the website?',
   '<p>Price depends on the stone, grade, size and quantity. Send us your list and we confirm stock and price against it.</p>', 20),
  ('Is there a minimum order?',
   '<p>Minimum quantities depend on the stone and size. Tell us what you need and we will tell you straight away.</p>', 30),
  ('Can I mix different stones in one order?',
   '<p>Yes. Mixed lists across CZ, moissanite, nano, corundum, glass and the rest are normal for us. One supplier, one invoice.</p>', 40),
  ('Will a reorder match my first lot?',
   '<p>Every lot is checked for cut, colour and calibration before it ships, so the second order matches the first. See <a href="/quality">Quality &amp; QC</a>.</p>', 50),
  ('Which grades do you stock?',
   '<p>From A through 3A, 4A, 5A and 7A to High Density Swiss, depending on the stone. The <a href="/charts/grades">grades chart</a> explains each one.</p>', 60),
  ('Where are you based?',
   '<p>Our office and stock are in Jaipur, Rajasthan. We also have our own setup and staff in China, working directly with the factories that cut the stones.</p>', 70),
  ('Do you give GST invoices?',
   '<p>Yes. Billing is transparent and GST-compliant on every order.</p>', 80),
  ('Do you take custom orders?',
   '<p>Yes, along with bulk orders from ready stock. Send the shape, size, colour and quantity, or a photo of what you need.</p>', 90),
  ('Are your stones natural?',
   '<p>Most of our range is synthetic or lab-created: CZ, moissanite, nano, corundum, glass and more. We also carry a natural range. Each category page says what the stone is.</p>', 100)
) AS v(question, answer, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.site_faqs);

COMMIT;
