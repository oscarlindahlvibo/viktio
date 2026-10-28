// Imports Livsmedelsverket's food database (names, nutrients per 100 g, EuroFIR group).
//
//   node scripts/livsmedelsverket.mjs fetch <cache.json>   download everything to a JSON file
//   node scripts/livsmedelsverket.mjs sql <cache.json>     print an idempotent upsert as SQL
//
// The SQL is meant to be piped into the database, e.g.
//   node scripts/livsmedelsverket.mjs sql lmv.json | ssh vibo-server 'docker exec -i supabase-viktio-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction'
import { readFile, writeFile } from 'node:fs/promises';

const BASE = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1';
const CONCURRENCY = 6;

// EuroFIR codes we store, mapped to our column names.
const NUTRIENTS = {
  'Energi (kcal)': 'kcal',
  Protein: 'protein_g',
  'Kolhydrater, tillgängliga': 'carbohydrate_g',
  'Sockerarter, totalt': 'sugar_g',
  'Fett, totalt': 'fat_g',
  'Summa mättade fettsyror': 'saturated_fat_g',
  Fiber: 'fiber_g',
  'Natrium, Na': 'sodium_mg',
  'Salt, NaCl': 'salt_g',
};

async function getJson(path, attempt = 1) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return getJson(path, attempt + 1);
    }
    throw new Error(`${res.status} ${path}`);
  }
  return res.json();
}

async function listFoods() {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const page = await getJson(`/livsmedel?offset=${offset}&limit=500&sprak=1`);
    all.push(...page.livsmedel);
    if (all.length >= page._meta.totalRecords || page.livsmedel.length === 0) break;
  }
  return all;
}

async function loadDetails(food) {
  const [nutrients, classes] = await Promise.all([
    getJson(`/livsmedel/${food.nummer}/naringsvarden?sprak=1`),
    getJson(`/livsmedel/${food.nummer}/klassificeringar?sprak=1`),
  ]);
  const nutrition = {};
  for (const n of nutrients) {
    const key = NUTRIENTS[n.namn];
    if (key) nutrition[key] = Number(n.varde) || 0;
  }
  const group = classes.find((c) => c.fasett?.startsWith('A '))?.namn ?? null;
  return { nummer: food.nummer, name: food.namn, version: food.version, group, nutrition };
}

// EuroFIR group → food_categories.slug.
const CATEGORY_BY_GROUP = {
  'Frukt och bär': 'frukt',
  'Processad frukt och bär': 'frukt',
  'Grönsaker och svamp': 'gronsaker',
  'Grönsaker, rotfrukter och svamp': 'gronsaker',
  'Grönsaksprodukter': 'gronsaker',
  Ägg: 'agg',
  Fisk: 'fisk',
  'Fisk och skaldjur': 'fisk',
  'Fisk- och skaldjursprodukt': 'fisk',
  Baljväxter: 'baljvaxter',
  'Rött kött': 'kott',
  Fågel: 'kott',
  'Kött eller köttprodukter': 'kott',
  'Konserverat kött': 'kott',
  'Innanmat och inälvsmat': 'kott',
  'Korv eller liknande produkt': 'flask',
  Mjölk: 'mejeri',
  'Fil och yoghurt': 'mejeri',
  Mejeriprodukter: 'mejeri',
  'Övriga mjölkprodukter': 'mejeri',
  Grädde: 'mejeri',
  Färskost: 'mejeri',
  Hårdost: 'mejeri',
  Mjukost: 'mejeri',
  'Lagrad ost': 'mejeri',
  'Halvhård ost': 'mejeri',
  'Övriga ostprodukter': 'mejeri',
  Ost: 'mejeri',
  'Vegetabiliska mejeriprodukter': 'mejeri',
  'Jäst bröd': 'brod',
  'Ojäst bröd': 'brod',
  'Övriga bröd': 'brod',
  'Ris eller annat spannmål': 'pasta_ris',
  'Pasta och liknande produkter': 'pasta_ris',
  Frukostflingor: 'spannmal',
  'Cerealier eller cerealielika mjölprodukter och derivat': 'spannmal',
  'Spannmål och spannmålsprodukter': 'spannmal',
  'Potatis och stärkelserika rötter': 'potatis',
  'Bageriprodukter, söta och/eller feta': 'sotsaker',
  'Choklad eller chokladprodukt': 'sotsaker',
  'Konfekt och annan sockerprodukt dvs ej choklad ': 'sotsaker',
  Dessert: 'sotsaker',
  'Glass och annan frusen dessert med mejeriprodukter': 'sotsaker',
  'Söta kakor': 'sotsaker',
  'Socker, honung eller sirap': 'sotsaker',
  'Socker och söta livsmedel': 'sotsaker',
  'Sylt eller marmelad': 'sotsaker',
  'Pannkaka eller våffla': 'sotsaker',
  Snacks: 'snacks',
  'Dryck utan alkohol': 'drycker',
  'Juice och nektar': 'drycker',
  Läsk: 'drycker',
  'Kaffe, te och kakao': 'drycker',
  'Vin och vinliknande drycker': 'drycker',
  'Likör eller sprit': 'drycker',
  'Öl eller maltdryck': 'drycker',
  'Cider och liknande drycker': 'drycker',
  Vatten: 'drycker',
  'Margarin och blandade fetter': 'fett_olja',
  'Vegetabiliskt fett och olja': 'fett_olja',
  'Andra djurfetter': 'fett_olja',
  Smör: 'fett_olja',
  'Dressing, majonnäs': 'sas_dressing',
  'Sås i maträtt': 'sas_dressing',
  'Smaksättare, tex ketchup, sojasås, senap': 'sas_dressing',
  Dessertsås: 'sas_dressing',
  'Kryddor smaksättare dressing röror': 'sas_dressing',
  'Nöt eller frö produkt': 'notter_fron',
  'Nöt, frö eller kärna': 'notter_fron',
  Kötträtt: 'fardigmat',
  'Fisk- och skaldjursrätt': 'fardigmat',
  Grönsaksrätter: 'fardigmat',
  Potatisrätter: 'fardigmat',
  Pastarätter: 'fardigmat',
  Soppa: 'fardigmat',
  'Matpaj eller pizza': 'fardigmat',
  'Cerealierätter t.ex. klimp, risotto, pannkakor med fyllning, couscous, smörgåsar': 'fardigmat',
  Baljväxträtter: 'fardigmat',
  Äggrätter: 'fardigmat',
  Färdigsallad: 'fardigmat',
  Smörgåsar: 'fardigmat',
  'Maträtter och efterrätter': 'fardigmat',
  Svamprätter: 'fardigmat',
  'Vegetariska produkter': 'fardigmat',
};

// Zero-point foods are deliberately conservative: plain fruit, vegetables, legumes, fish, eggs,
// lean poultry and plain low-fat yoghurt — never anything fried, sweetened, in oil or processed.
const NOT_ZERO = /stekt|friterad|panerad|olja|socker|sockrad|sirap|sylt|torkad(?! kokt)|chips|juice|smoothie|barnmat|inlagd|marinerad|stuvad|gratäng|sås|burgare|m\. skinn|frysvara m\.|avokado|oliv/i;

function categorize(food) {
  const name = food.name.toLowerCase();
  if (food.group === 'Fågel' && /^(kyckling|kalkon)/.test(name) && /filé|kött/.test(name) && !/m\. skinn/.test(name)) {
    return { slug: name.startsWith('kalkon') ? 'kalkonbrost' : 'kycklingbrost', zero: !NOT_ZERO.test(name) };
  }
  if (food.group === 'Fil och yoghurt' && /naturell|lättfil/.test(name) && /0,5%|lätt/.test(name)) {
    return { slug: 'mejeri_latt', zero: true };
  }
  const slug = CATEGORY_BY_GROUP[food.group] ?? null;
  const zeroGroup = ['Frukt och bär', 'Grönsaker och svamp', 'Grönsaker, rotfrukter och svamp', 'Ägg', 'Fisk', 'Baljväxter'];
  return { slug, zero: zeroGroup.includes(food.group) && !NOT_ZERO.test(name) };
}

const sqlText = (v) => (v == null ? 'NULL' : `'${String(v).trim().replace(/'/g, "''")}'`);
const sqlNum = (v) => (Number.isFinite(v) ? String(v) : '0');

function toSql(foods) {
  const rows = foods.map((f) => {
    const { slug, zero } = categorize(f);
    const n = f.nutrition;
    return `(${sqlText(f.nummer)}, ${sqlText(f.name)}, ${sqlText(slug)}, ${zero}, ${[
      n.kcal, n.protein_g, n.carbohydrate_g, n.sugar_g, n.fat_g, n.saturated_fat_g, n.fiber_g, n.sodium_mg, n.salt_g,
    ].map(sqlNum).join(', ')})`;
  });
  return `CREATE TEMP TABLE lmv (
  external_id text, name text, category_slug text, zero_point boolean,
  kcal numeric, protein_g numeric, carbohydrate_g numeric, sugar_g numeric, fat_g numeric,
  saturated_fat_g numeric, fiber_g numeric, sodium_mg numeric, salt_g numeric
) ON COMMIT DROP;

INSERT INTO lmv VALUES
${rows.join(',\n')};

INSERT INTO foods (name, category_id, source_id, external_id, status, zero_point)
SELECT l.name, c.id, s.id, l.external_id, 'verified', l.zero_point
FROM lmv l
CROSS JOIN (SELECT id FROM food_sources WHERE slug = 'livsmedelsverket') s
LEFT JOIN food_categories c ON c.slug = l.category_slug
ON CONFLICT (source_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  zero_point = EXCLUDED.zero_point,
  updated_at = now();

DELETE FROM food_nutrition n
USING foods f, food_sources s
WHERE n.food_id = f.id AND f.source_id = s.id AND s.slug = 'livsmedelsverket';

INSERT INTO food_nutrition (food_id, kcal, protein_g, carbohydrate_g, sugar_g, fat_g, saturated_fat_g, fiber_g, sodium_mg, salt_g, per_amount, unit)
SELECT f.id, l.kcal, l.protein_g, l.carbohydrate_g, l.sugar_g, l.fat_g, l.saturated_fat_g, l.fiber_g, l.sodium_mg, l.salt_g, 100, 'g'
FROM lmv l
JOIN food_sources s ON s.slug = 'livsmedelsverket'
JOIN foods f ON f.source_id = s.id AND f.external_id = l.external_id;
`;
}

const [command, file] = process.argv.slice(2);
if (command === 'fetch' && file) {
  const foods = await listFoods();
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < foods.length) {
        const food = foods[next++];
        results.push(await loadDetails(food));
        if (results.length % 250 === 0) console.error(`${results.length}/${foods.length}`);
      }
    }),
  );
  results.sort((a, b) => a.nummer - b.nummer);
  await writeFile(file, JSON.stringify(results));
  console.error(`Wrote ${results.length} foods to ${file}`);
} else if (command === 'sql' && file) {
  process.stdout.write(toSql(JSON.parse(await readFile(file, 'utf8'))));
} else {
  console.error('Usage: node scripts/livsmedelsverket.mjs fetch|sql <cache.json>');
  process.exit(1);
}
