import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
  }

  const token = req.headers.get("x-sncf-token");
  const esperado = Deno.env.get("FSNC_INBOUND_TOKEN");
  if (!token || token !== esperado) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 });
  }

  const sncfPedidoIds: string[] = body?.sncf_pedido_ids ?? [];
  if (!sncfPedidoIds.length) {
    return new Response(JSON.stringify({ error: "sncf_pedido_ids obrigatório" }), { status: 400 });
  }

  // Usar anon key — a RPC get_order_by_sncf_id é SECURITY DEFINER, bypassa RLS
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resultados: any[] = [];

  for (const sncfId of sncfPedidoIds) {
    const { data, error } = await supabase.rpc("get_order_by_sncf_id", {
      p_sncf_pedido_id: sncfId,
    });

    if (error) {
      resultados.push({ sncf_pedido_id: sncfId, erro: error.message });
      continue;
    }

    if (data?.erro) {
      resultados.push({ sncf_pedido_id: sncfId, erro: data.erro });
      continue;
    }

    resultados.push({
      sncf_pedido_id: sncfId,
      order_id:       data.id,
      valor_bruto:    data.valor_bruto,
      valor_liquido:  data.valor_liquido,
      commercial:     data.commercial,
      items:          data.items ?? [],
    });
  }

  return new Response(JSON.stringify({ ok: true, resultados }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
