export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Accepts both query-string (GET) and JSON body (POST) parameters.
export async function readParams(req: Request): Promise<Record<string, string | undefined>> {
  const params: Record<string, string | undefined> = Object.fromEntries(new URL(req.url).searchParams);
  if (req.method === 'POST') {
    try {
      Object.assign(params, await req.json());
    } catch {
      // Empty or non-JSON body
    }
  }
  return params;
}
