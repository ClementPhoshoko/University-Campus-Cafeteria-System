-- Seed the centrally managed dietary and allergen choices used by vendor
-- menu-item configuration. This keeps the existing catalogue tables and
-- assignments intact, and does not reactivate labels an admin has disabled.

insert into public.dietary_tags (name, description)
values
  ('Vegetarian', 'Assign only when the item and its preparation meet the vendor’s vegetarian standard.'),
  ('Vegan', 'Assign only when the item and its preparation meet the vendor’s vegan standard.'),
  ('Halal', 'Assign only when the vendor can substantiate that the item and its preparation meet its halal standard.')
on conflict (name) do nothing;

insert into public.allergens (name, description)
values
  ('Egg', 'Includes egg and ingredients derived from egg that retain allergenicity.'),
  ('Cow’s milk', 'Includes cow’s milk and ingredients derived from it that retain allergenicity.'),
  ('Goat’s milk', 'South African labelling regulations call for goat’s milk to be declared in the same manner as common allergens.'),
  ('Crustaceans', 'Specify the crustacean in the item notice when known.'),
  ('Molluscs', 'Specify the mollusc in the item notice when known.'),
  ('Fish', 'Specify the fish in the item notice when known.'),
  ('Peanuts', 'Includes peanuts and ingredients derived from them that retain allergenicity.'),
  ('Soybeans', 'Includes soybeans and ingredients derived from them that retain allergenicity.'),
  ('Tree nuts', 'Specify the tree nut in the item notice when known.'),
  ('Wheat (gluten)', 'Specify wheat and disclose gluten where applicable.'),
  ('Rye (gluten)', 'Specify rye and disclose gluten where applicable.'),
  ('Barley (gluten)', 'Specify barley and disclose gluten where applicable.'),
  ('Oats (gluten)', 'Specify oats and disclose gluten where applicable.'),
  ('Triticale (gluten)', 'Triticale is a wheat/rye hybrid; disclose the specific cereal and gluten where applicable.')
on conflict (name) do nothing;
