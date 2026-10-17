-- A note on one order line ("Radiant cut required", "for hand setting"),
-- typed by the buyer or carried over from a pasted list. Optional and short.
alter table public.order_items
  add column if not exists note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_note_length') then
    alter table public.order_items
      add constraint order_items_note_length check (note is null or char_length(note) <= 300);
  end if;
end $$;
