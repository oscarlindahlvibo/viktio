// Permanently deletes the calling user's account and personal data (GDPR art. 17).
// Per-user tables cascade from auth.users; shared foods and recipes the user created
// stay in the database without the link to the user, since other users may have logged them.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: 'Inte inloggad' }, { status: 401 });

  await admin.from('foods').update({ created_by: null }).eq('created_by', user.id);
  await admin.from('recipes').update({ created_by: null }).eq('created_by', user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: 'Kunde inte radera kontot' }, { status: 500 });
  return json({ deleted: true });
});
