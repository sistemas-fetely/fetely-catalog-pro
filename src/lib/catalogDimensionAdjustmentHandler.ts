import { timingSafeEqual } from 'node:crypto';
import type { CatalogClient } from './catalogProductPersistence';
import { catalogDimensionAdjustmentBodySchema } from './catalogDimensionAdjustment';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function loadAdminClient(): Promise<CatalogClient> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}
export async function handleCatalogDimensionAdjustment(request: Request, loadClient: () => Promise<CatalogClient> = loadAdminClient): Promise<Response> {
  const auth = request.headers.get('authorization');
  if (!auth || !/^Bearer\s+\S+$/i.test(auth)) return json({ ok: false, erro: 'Token inválido' }, 401);
  try {
    const client = await loadClient();
    const { data: expected, error } = await client.rpc('get_vault_secret', { p_name: 'FSNC_INBOUND_TOKEN' });
    if (error || !expected) return json({ ok: false, erro: 'Credencial de integração indisponível' }, 500);
    const actualBytes = new TextEncoder().encode(auth.replace(/^Bearer\s+/i, ''));
    const expectedBytes = new TextEncoder().encode(expected);
    if (actualBytes.byteLength !== expectedBytes.byteLength || !timingSafeEqual(actualBytes, expectedBytes)) {
      return json({ ok: false, erro: 'Token inválido' }, 401);
    }
    const parsed = catalogDimensionAdjustmentBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, erro: 'Corpo inválido', detalhes: parsed.error.issues }, 400);
    const { adjustCatalogDimension } = await import('./catalogDimensionAdjustment');
    return json(await adjustCatalogDimension(client, parsed.data));
  } catch {
    return json({ ok: false, erro: 'Não foi possível ajustar a dimensão' }, 500);
  }
}