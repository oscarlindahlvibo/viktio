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

async function searchByName(query: string) {
  if (query.length < 2) {
    return json({ results: [] });
  }

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=30&fields=product_name,brands,image_url,image_front_small_url,quantity,code,nutriments,serving_size,serving_quantity`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Viktio/1.0 (web app)' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return json({ results: [] });
  }

  const data = await response.json();
  const products = (data.products || []).filter((p: { product_name?: string }) => p.product_name);

  const results = products
    .map((p: Record<string, unknown>) => mapOFFProduct(p, String(p.code || '')))
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
  const img = (p.image_front_small_url as string) || (p.image_url as string) || null;
  const imageUrl = img ? (img.startsWith('http') ? img : `https://images.openfoodfacts.org/images/products${img}`) : null;

  return {
    name,
    brand: (p.brands as string) || null,
    image_url: imageUrl,
    package_size: (p.quantity as string) || null,
    barcode,
    kcal: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
    protein_g: Math.round((n['proteins_100g'] || 0) * 10) / 10,
    carbohydrate_g: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
    fat_g: Math.round((n['fat_100g'] || 0) * 10) / 10,
    saturated_fat_g: Math.round((n['saturated-fat_100g'] || 0) * 10) / 10,
    fiber_g: Math.round((n['fiber_100g'] || 0) * 10) / 10,
    sugar_g: Math.round((n['sugars_100g'] || 0) * 10) / 10,
    sodium_mg: Math.round((n['sodium_100g'] || 0) * 10) / 10,
    per_amount: 100,
    serving_description: (p.serving_size as string) || null,
    source: 'openfoodfacts',
  };
}
