import { timingSafeEqual } from 'node:crypto';
import type { CatalogClient } from './catalogProductPersistence';
import { catalogDimensionRegistrationBodySchema } from './catalogDimensionRegistration';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
type ClientLoader = () => Promise<CatalogClient>;

async function loadAdminClient(): Promise<CatalogClient> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

export async function handleCatalogDimensionRegistration(request: Request, loadClient: ClientLoader = loadAdminClient): Promise<Response> {
  const auth = request.headers.get('authorization');
  if (!auth || !/^Bearer\s+\S+$/i.test(auth)) return json({ ok: false, erro: 'Token inválido' }, 401);
  try {
    const supabaseAdmin = await loadClient();
    const { data: expected, error } = await supabaseAdmin.rpc('get_vault_secret', { p_name: 'FSNC_INBOUND_TOKEN' });
    if (error || !expected) return json({ ok: false, erro: 'Credencial de integração indisponível' }, 500);
    const actualBytes = new TextEncoder().encode(auth.replace(/^Bearer\s+/i, ''));
    const expectedBytes = new TextEncoder().encode(expected);
    if (actualBytes.byteLength !== expectedBytes.byteLength || !timingSafeEqual(actualBytes, expectedBytes)) {
      return json({ ok: false, erro: 'Token inválido' }, 401);
    }

    const parsed = catalogDimensionRegistrationBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, erro: 'Corpo inválido', detalhes: parsed.error.issues }, 400);
    const { registerCatalogDimension } = await import('./catalogDimensionRegistration');
    return json(await registerCatalogDimension(supabaseAdmin, parsed.data));
  } catch {
    return json({ ok: false, erro: 'Não foi possível cadastrar o valor da dimensão' }, 500);
  }
}
