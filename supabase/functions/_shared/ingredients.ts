// Turns free-text recipe ingredient lines ("2 dl havregryn", "1 gul lök, finhackad")
// into a matched food, a weight in grams, nutrition and points.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface ParsedIngredient {
  amount: number | null;
  unit: string | null;
  name: string;
  grams: number | null;
  estimated: boolean;
}

// Grams (weight units) or millilitres (volume units) per unit.
const WEIGHT_UNITS: Record<string, number> = { g: 1, gram: 1, kg: 1000, hg: 100, mg: 0.001 };
const VOLUME_UNITS: Record<string, number> = {
  l: 1000, liter: 1000, dl: 100, cl: 10, ml: 1, msk: 15, tsk: 5, krm: 1, kkp: 150, kopp: 240, nypa: 0.5,
};
const PIECE_UNITS = new Set([
  'st', 'stk', 'styck', 'stycken', 'klyfta', 'klyftor', 'skiva', 'skivor', 'burk', 'burkar', 'förp', 'förpackning',
  'paket', 'pkt', 'påse', 'kruka', 'krukor', 'knippe', 'knippen', 'blad', 'kvist', 'kvistar', 'näve', 'portion',
  'portioner', 'tärning', 'tärningar', 'bit', 'bitar', 'filé', 'filéer', 'liten', 'litet', 'små', 'stor', 'stort', 'stora',
]);

// Grams per millilitre; anything not listed is treated like water.
const DENSITIES: [RegExp, number][] = [
  [/havregryn|müsli|flingor|cornflakes/, 0.35],
  [/mjöl|maizena|majsstärkelse|kakao|bakpulver|potatismjöl/, 0.6],
  [/strösocker|^socker|farinsocker|råsocker/, 0.85],
  [/florsocker/, 0.55],
  [/ris\b|^ris|quinoa|bulgur|couscous|linser|matvete/, 0.85],
  [/pasta|makaroner|spaghetti|penne/, 0.4],
  [/ost/, 0.4],
  [/nötter|mandel|frön|kärnor|valnöt|cashew/, 0.6],
  [/olja/, 0.92],
  [/smör|margarin/, 0.95],
  [/honung|sirap/, 1.4],
  [/salt/, 1.2],
  [/russin|torkad/, 0.6],
  [/spenat|sallad|ruccola|grönkål|örter|persilja|basilika|koriander|dill/, 0.2],
  [/riven|strimlad/, 0.4],
];

// Typical weight of one piece, in grams.
const PIECE_WEIGHTS: [RegExp, number][] = [
  [/^skiv(a|or) .*(bacon|skinka|kalkon|salami|pancetta)/, 15],
  [/^skiv(a|or) .*ost/, 10],
  [/^skiv(a|or) .*(bröd|limpa|toast|levain)/, 35],
  [/^skiv(a|or) /, 25],
  // A pot or bunch of fresh herbs gives roughly a handful of leaves.
  [/^(kruka|krukor|knippe|knippen) /, 25],
  [/^(kvist|kvistar|blad) /, 1],
  [/^(burk|burkar|förp|förpackning|paket|pkt)\b|krossade tomater|kokosmjölk|bönor|kikärtor|majs/, 400],
  [/vitlök|klyft/, 5],
  [/schalottenlök/, 30],
  [/rödlök|gul lök|^lök|purjolök/, 100],
  [/äggul/, 18],
  [/äggvit/, 33],
  [/ägg/, 55],
  [/potatis/, 100],
  [/morot|morötter/, 70],
  [/tomat/, 100],
  [/paprika/, 150],
  [/gurka/, 300],
  [/zucchini|squash/, 250],
  [/aubergine/, 300],
  [/avokado/, 150],
  [/äpple|päron/, 150],
  [/banan/, 120],
  [/citron|apelsin/, 120],
  [/lime/, 60],
  [/chili/, 15],
  [/kycklingfil|kycklingbröst/, 125],
  [/kycklinglår/, 100],
  [/laxfil|torskfil|fiskfil/, 125],
  [/tortilla/, 40],
  [/brödskiv|skiva bröd|knäcke/, 30],
  [/buljongtärning|tärning/, 10],
  [/ingefära/, 20],
  [/broccoli|blomkål/, 400],
  [/champinjon/, 20],
  [/selleri/, 40],
];

// Rewrites from common recipe wording to the names used in the food database.
const SYNONYMS: [RegExp, string][] = [
  [/^(vitlöksklyft[a-zåäö]*|klyft[a-zåäö]* vitlök)$/, 'vitlök'],
  [/^(spaghetti|spagetti|penne|makaroner|tagliatelle|fusilli|farfalle|rigatoni|linguine|pappardelle|fullkornspasta|pasta|lasagneplattor)$/, 'pasta okokt'],
  [/^(pancetta|guanciale|sidfläsk|rökt sidfläsk|baconbitar)$/, 'bacon'],
  [/^(pecorino|pecorinoost|parmesan|parmesanost|grana padano|parmigiano reggiano|parmigiano)$/, 'ost hårdost parmesan fett 30% typ parmiggiano reggiano'],
  [/^schalottenlök[a-zåäö]*$/, 'lök gul'],
  [/^äggul(a|or)$/, 'äggula rå'],
  [/^äggvit(a|or)$/, 'äggvita rå'],
  [/^(riven ost|ost|hushållsost|prästost|cheddar)$/, 'ost hårdost fett 28%'],
  [/^grädde$/, 'vispgrädde'],
  [/^(strösocker|socker)$/, 'socker'],
  [/^cr[eè]me fra[iî]che$/, 'crème fraiche fett 34%'],
  [/^köttfärs$/, 'blandfärs rå nöt 50% gris 50%'],
  [/^rödlök$/, 'lök röd'],
  [/^gul lök$/, 'lök gul'],
  [/^kycklinglårfil[eé][a-zåäö]*$/, 'kyckling lår rå u. skinn'],
  [/^kycklingbröst[a-zåäö]*$/, 'kycklingfilé'],
  [/^(jasminris|basmatiris|långkornigt ris)$/, 'ris jasmin okokt'],
  [/^ris$/, 'ris jasmin okokt'],
  [/^(mjöl|vetemjöl)$/, 'vetemjöl'],
  [/^mjölk$/, 'mjölk fett 3% berikad'],
  [/^(olja|neutral olja|matolja)$/, 'rapsolja'],
  [/^(smör till stekning|smör)$/, 'smör fett 80%'],
  [/^(naturell yoghurt|yoghurt)$/, 'yoghurt naturell fett 3% berikad'],
  [/(^|\s)soja$/, 'sojasås'],
  [/chili(frukt|peppar)?$/, 'chilipeppar färsk'],
  [/^svamp$/, 'champinjon'],
  [/^(bifftomat|bifftomater|kvisttomat|kvisttomater|plommontomat|plommontomater|tomater)$/, 'tomat'],
  [/^(körsbärstomat|körsbärstomater|cocktailtomat|cocktailtomater)$/, 'tomat körsbärstomat röd'],
  [/^(citronsaft|pressad citron|saft av citron|citronjuice)$/, 'citronjuice färskpressad'],
  [/^(limesaft|pressad lime|saft av lime|limejuice)$/, 'limejuice färskpressad'],
  [/^(haricots? verts?|brytbönor|gröna bönor)$/, 'gröna bönor'],
  [/^(bladpersilja|plattpersilja|krusig persilja|persiljeblad)$/, 'persilja blad'],
];

// Equipment that recipes list among the ingredients ("4 plankor till plankstek").
const NOT_FOOD = /^(plank(a|or)|grillspett|spett|träspett|tandpetare|bakplåtspapper|folie|aluminiumfolie|plastfolie|snöre|kökssnöre|bindgarn|form|bakform|ugnsform|muffinsform(ar)?|engångsform(ar)?)$/;

// Lines that point to another part of the recipe ("3 msk beareduktion, se nedan").
const REFERENCE = /\b(se nedan|se ovan|se recept|enligt recept|se under)\b/;

// Seasonings that contribute no meaningful points.
const NEGLIGIBLE = /^(salt( och peppar)?|peppar|svartpeppar|vitpeppar|kryddpeppar|cayennepeppar|oregano|basilika|timjan|rosmarin|spiskummin|paprikapulver|chiliflakes|chilipulver|curry(pulver)?|gurkmeja|lagerblad|kanel|muskot|kardemumma|vatten|is|dill|koriander|persilja|gräslök|mynta|dragon|torkad dragon|körvel|salvia|mejram|citronmeliss|[a-zåäö]*pepparkorn|rosépeppar|enbär|kryddnejlik[a-zåäö]*|nejlikor|stjärnanis|saffran|fänkålsfrö|senapsfrö|[a-zåäö]*buljong[a-zåäö]*|[a-zåäö]*fond|ättika|vinäger|bakpulver|bikarbonat|jäst|vaniljsocker|citronskal|limeskal)$/;

const PREP_WORDS = /\b(finhackad|finhackade|hackad|hackade|grovhackad|riven|rivet|rivna|skivad|skivade|tärnad|tärnade|strimlad|strimlade|pressad|pressade|färsk|färska|fryst|frysta|kokt|kokta|smält|smälta|mjukt|rumsvarmt|rumstempererat|kallt|kall|ca|cirka|ungefär|gärna|valfri|valfritt|till servering|till stekning|till garnering|efter smak|för servering|eller mer|ev\.?)\b/g;

function toNumber(text: string): number | null {
  const fractions: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  let t = text.trim();
  for (const [f, v] of Object.entries(fractions)) {
    t = t.replace(new RegExp(`(\\d)\\s*${f}`), (_, d) => String(Number(d) + v)).replace(f, String(v));
  }
  const range = t.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
  if (range) return (parseFloat(range[1].replace(',', '.')) + parseFloat(range[2].replace(',', '.'))) / 2;
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function lookup(table: [RegExp, number][], name: string): number | null {
  for (const [re, v] of table) if (re.test(name)) return v;
  return null;
}

export function parseIngredient(raw: string): ParsedIngredient {
  let text = raw.toLowerCase().replace(/\s+/g, ' ').trim();

  // An explicit weight anywhere wins, e.g. "1 paket kycklingfilé (ca 500 g)".
  const explicit = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|hg|g|gram)\b/);

  const amountRe = /^((?:\d+\s+)?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])\s*/;
  let amount: number | null = null;
  const m = text.match(amountRe);
  if (m) {
    amount = toNumber(m[1].replace(/\s*\/\s*/, '/'));
    text = text.slice(m[0].length);
  }

  let unit: string | null = null;
  const u = text.match(/^([a-zåäö]+)\.?\s+/);
  if (u && (u[1] in WEIGHT_UNITS || u[1] in VOLUME_UNITS || PIECE_UNITS.has(u[1]))) {
    unit = u[1];
    text = text.slice(u[0].length);
  }

  let name = text
    .replace(/\(.*?\)/g, ' ')
    .split(/,| till | att | eller | à /)[0]
    .replace(PREP_WORDS, ' ')
    .replace(/\bbaby(?=[a-zåäö]{3})/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (unit && /^(klyfta|klyftor)$/.test(unit) && name === 'vitlök') name = 'vitlök';

  let grams: number | null = null;
  let estimated = false;
  if (explicit) {
    grams = parseFloat(explicit[1].replace(',', '.')) * (WEIGHT_UNITS[explicit[2]] ?? 1);
  } else if (unit && unit in WEIGHT_UNITS) {
    grams = (amount ?? 1) * WEIGHT_UNITS[unit];
  } else if (unit && unit in VOLUME_UNITS) {
    grams = (amount ?? 1) * VOLUME_UNITS[unit] * (lookup(DENSITIES, name) ?? 1);
  } else if (amount != null) {
    const piece = lookup(PIECE_WEIGHTS, `${unit ?? ''} ${name}`.trim()) ?? lookup(PIECE_WEIGHTS, name);
    grams = amount * (piece ?? 100);
    estimated = piece == null;
  }

  return { amount, unit, name, grams: grams != null ? Math.round(grams * 10) / 10 : null, estimated };
}

function singularVariants(name: string): string[] {
  const words = name.split(' ');
  const last = words[words.length - 1];
  const stems = new Set<string>();
  for (const suffix of ['erna', 'arna', 'orna', 'er', 'ar', 'or', 'na', 'n', 'r']) {
    if (last.length > suffix.length + 2 && last.endsWith(suffix)) stems.add(last.slice(0, -suffix.length));
  }
  if (last.endsWith('ötter')) stems.add(last.replace(/ötter$/, 'ot'));
  return [...stems].map((s) => [...words.slice(0, -1), s].join(' '));
}

const CONFIDENCE_THRESHOLDS: [number, 'high' | 'medium' | 'low'][] = [[1.0, 'high'], [0.75, 'medium'], [0.5, 'low']];

function applySynonyms(name: string): string {
  for (const [re, replacement] of SYNONYMS) {
    if (re.test(name)) return replacement;
  }
  return name;
}

async function topHit(db: SupabaseClient, query: string) {
  const { data } = await db.rpc('match_food', { p_query: query, p_limit: 1 });
  return (data?.[0] as { food_id: string; name: string; score: number } | undefined) ?? null;
}

async function bestMatch(db: SupabaseClient, name: string) {
  const query = applySynonyms(name);
  let best: { food_id: string; name: string; score: number } | null = null;
  for (const candidate of [query, ...singularVariants(query)]) {
    const hit = await topHit(db, candidate);
    if (hit && (!best || hit.score > best.score)) best = hit;
    if (best && best.score >= 1.0) return best;
  }

  // Swedish compounds: fall back to the tail of the word ("pecorinoost" → "ost",
  // "kycklinglårfilé" → "lårfilé"), scored a little lower than a direct hit.
  if (!best || best.score < 0.75) {
    const words = name.split(' ');
    const last = words[words.length - 1];
    for (let i = 3; i <= last.length - 3; i++) {
      const tail = applySynonyms(last.slice(i));
      const hit = await topHit(db, tail);
      if (hit && hit.score >= 1.0) {
        const scored = { ...hit, score: hit.score - 0.15 };
        if (!best || scored.score > best.score) best = scored;
        break;
      }
    }
  }
  return best;
}

// Section headings ("Duchessemos", "Baconlindade haricots verts") have no amount and start with a capital.
export function isHeading(raw: string): boolean {
  const t = raw.trim();
  return !/\d|[½¼¾⅓⅔]/.test(t) && /^[A-ZÅÄÖ]/.test(t) && t.split(/\s+/).length <= 4 && !t.includes(',');
}

export async function matchIngredient(db: SupabaseClient, ingredient: { id: string; raw_text: string | null }) {
  const parsed = parseIngredient(ingredient.raw_text ?? '');

  // Spoonfuls of paprika are the spice, not the vegetable.
  const raw = (ingredient.raw_text ?? '').trim();
  const heading = isHeading(raw);
  const isSpice = parsed.name === 'paprika' && /^(msk|tsk|krm)$/.test(parsed.unit ?? '');
  const skipped = NOT_FOOD.test(parsed.name) || REFERENCE.test(raw.toLowerCase());

  if (!parsed.name || heading || isSpice || skipped || NEGLIGIBLE.test(parsed.name)) {
    await db.rpc('apply_ingredient_match', {
      p_ingredient_id: ingredient.id, p_food_id: null, p_amount: parsed.amount, p_unit: parsed.unit,
      p_weight_g: 0, p_confidence: 'high',
    });
    return;
  }

  const match = await bestMatch(db, parsed.name);
  let confidence: 'high' | 'medium' | 'low' | 'unmatched' = 'unmatched';
  if (match) {
    confidence = CONFIDENCE_THRESHOLDS.find(([min]) => match.score >= min)?.[1] ?? 'unmatched';
  }
  if (parsed.grams == null && confidence !== 'unmatched') confidence = 'low';
  if (parsed.estimated && confidence === 'high') confidence = 'medium';

  await db.rpc('apply_ingredient_match', {
    p_ingredient_id: ingredient.id,
    p_food_id: confidence === 'unmatched' ? null : match!.food_id,
    p_amount: parsed.amount,
    p_unit: parsed.unit,
    p_weight_g: parsed.grams ?? 0,
    p_confidence: confidence,
  });
}

// Matches the given ingredients (all unmatched ones by default) and refreshes the recipe totals.
export async function matchRecipe(db: SupabaseClient, recipeId: string, onlyUnmatched = true) {
  let q = db.from('recipe_ingredients').select('id, raw_text').eq('recipe_id', recipeId);
  if (onlyUnmatched) q = q.eq('confidence', 'unmatched');
  const { data: ingredients, error } = await q;
  if (error) throw error;
  for (const ingredient of ingredients ?? []) await matchIngredient(db, ingredient);
  await db.rpc('recalculate_recipe', { p_recipe_id: recipeId });
  return ingredients?.length ?? 0;
}
