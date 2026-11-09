import { timingSafeEqual } from 'node:crypto';
import { catalogDimensionBodySchema } from './catalogDimension';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handleCatalogDimension(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization');
  if (!auth || !/^Bearer\s+\S+$/i.test(auth)) return json({ erro: 'Token inválido' }, 401);
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: expected, error } = await supabaseAdmin.rpc('get_vault_secret', { p_name: 'FSNC_INBOUND_TOKEN' });
    if (error || !expected) return json({ erro: 'Credencial de integração indisponível' }, 500);
    const actualBytes = new TextEncoder().encode(auth.replace(/^Bearer\s+/i, ''));
    const expectedBytes = new TextEncoder().encode(expected);
    if (actualBytes.byteLength !== expectedBytes.byteLength || !timingSafeEqual(actualBytes, expectedBytes)) return json({ erro: 'Token inválido' }, 401);

    const parsed = catalogDimensionBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ erro: 'Corpo inválido', detalhes: parsed.error.issues }, 400);
    const { createCatalogDimension } = await import('./catalogDimension');
    return json(await createCatalogDimension(supabaseAdmin, parsed.data));
  } catch {
    return json({ erro: 'Não foi possível processar o cadastro da dimensão' }, 500);
  }
}
