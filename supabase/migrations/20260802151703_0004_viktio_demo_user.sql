/*
# Viktio — Featured Recipes

Marks a few recipes as featured by adding 'featured' to their tags.
Demo user data is created via the app's signup + edge function flow.
*/

UPDATE recipes
SET tags = array_append(tags, 'featured')
WHERE name IN (
  'Kycklinggryta med kikärtor',
  'Lax med quinoa och broccoli',
  'Ägg och keso frukost',
  'Bolognese med fullkornspasta',
  'Tonfisksallad'
)
AND NOT ('featured' = ANY(tags));
