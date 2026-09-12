BEGIN;
INSERT INTO color_price_groups(name,sort_order)
SELECT 'White (DEF)', coalesce(max(sort_order),0)+1 FROM color_price_groups
HAVING NOT EXISTS (SELECT 1 FROM color_price_groups WHERE name='White (DEF)');
INSERT INTO color_price_group_members(color_id,group_id)
SELECT c.id,g.id FROM colors c CROSS JOIN color_price_groups g
WHERE c.name='White (DEF)' AND g.name='White (DEF)'
AND NOT EXISTS(SELECT 1 FROM color_price_group_members m WHERE m.color_id=c.id);
COMMIT;
