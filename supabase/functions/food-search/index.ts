import { corsHeaders, json, readParams } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const params = await readParams(req);
  const query = params.q || '';
  const barcode = params.barcode || '';

  try {
    if (barcode) {
      return await searchByBarcode(barcode);
    }
    if (query) {
      return await searchByName(query);
    }
    return json({ results: [] });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Okänt fel' }, { status: 500 });
  }
});
async function searchByBarcode(barcode: string) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,image_url,image_front_small_url,quantity,nutriments,serving_size,serving_quantity`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Viktio/1.0 (web app)' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return json({ results: [] });
  }

  const data = await response.json();
  if (data.status !== 1 || !data.product) {
    return json({ results: [] });
  }

  const p = data.product;
  const result = mapOFFProduct(p, barcode);

  return json({ results: result ? [result] : [] });
}

const SEARCH_FIELDS = 'code,product_name,brands,image_url,image_front_small_url,quantity,nutriments,serving_size';

// Open Food Facts' search service (search-a-licious); the legacy cgi/search.pl endpoint is unreliable.
async function searchOFF(q: string, pageSize: number): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ q, page_size: String(pageSize), fields: SEARCH_FIELDS });
  const response = await fetch(`https://search.openfoodfacts.org/search?${params}`, {
    headers: { 'User-Agent': 'Viktio/1.0 (https://viktio.vibogruppen.se)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.hits || [];
}

async function searchByName(query: string) {
  if (query.length < 2) {
    return json({ results: [] });
  }

  // Prefer products sold in Sweden; top up with global results when there are few.
  let products = await searchOFF(`${query} countries_tags:"en:sweden"`, 30);
  if (products.length < 10) {
    const seen = new Set(products.map((p) => p.code));
    const global = await searchOFF(query, 30);
    products = products.concat(global.filter((p) => !seen.has(p.code)));
  }

  const results = products
    .filter((p) => p.product_name)
    .slice(0, 30)
    .map((p) => mapOFFProduct(p, String(p.code || '')))
    .filter(Boolean);

  return json({ results });
}

function mapOFFProduct(
  p: Record<string, unknown>,
  barcode: string,
): {
  name: string;
  brand: string | null;
  image_url: string | null;
  package_size: string | null;
  barcode: string;
  kcal: number;
  protein_g: number;
  carbohydrate_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  per_amount: number;
  serving_description: string | null;
  source: string;
} | null {
  const name = String(p.product_name || '').trim();
  if (!name) return null;

  const n = (p.nutriments || {}) as Record<string, number>;
  const kj = n['energy-kj_100g'] ?? (n['energy_100g'] != null ? n['energy_100g'] : undefined);
  const kcal = n['energy-kcal_100g'] ?? (kj != null ? kj / 4.184 : undefined);
  // Without an energy value the points would be a silent 0, so skip the product.
  if (kcal == null) return null;
  const img = (p.image_front_small_url as string) || (p.image_url as string) || null;
  const imageUrl = img ? (img.startsWith('http') ? img : `https://images.openfoodfacts.org/images/products${img}`) : null;

  return {
    name,
    brand: (Array.isArray(p.brands) ? p.brands.map((b) => String(b).trim()).join(', ') : (p.brands as string)) || null,
    image_url: imageUrl,
    package_size: (p.quantity as string) || null,
    barcode,
    kcal: Math.round(kcal),
    protein_g: Math.round((n['proteins_100g'] || 0) * 10) / 10,
    carbohydrate_g: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
    fat_g: Math.round((n['fat_100g'] || 0) * 10) / 10,
    saturated_fat_g: Math.round((n['saturated-fat_100g'] || 0) * 10) / 10,
    fiber_g: Math.round((n['fiber_100g'] || 0) * 10) / 10,
    sugar_g: Math.round((n['sugars_100g'] || 0) * 10) / 10,
    // Open Food Facts reports sodium in grams.
    sodium_mg: Math.round((n['sodium_100g'] || 0) * 1000),
    per_amount: 100,
    serving_description: (p.serving_size as string) || null,
    source: 'openfoodfacts',
  };
}
