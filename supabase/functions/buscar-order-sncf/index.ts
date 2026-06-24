import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
  }

  // Autenticação via token compartilhado
  const token = req.headers.get("x-sncf-token");
  const esperado = Deno.env.get("FSNC_INBOUND_TOKEN");
  if (!token || token !== esperado) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parsear body: { sncf_pedido_ids: string[] }
  let body: any = {};
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 });
  }

  const sncfPedidoIds: string[] = body?.sncf_pedido_ids ?? [];
  if (!sncfPedidoIds.length) {
    return new Response(JSON.stringify({ error: "sncf_pedido_ids obrigatório" }), { status: 400 });
  }

  // Conectar ao FOP internamente com service_role
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resultados: any[] = [];

  for (const sncfId of sncfPedidoIds) {
    // Buscar order pelo sncf_pedido_id
    const { data: orders, error: orderErr } = await supabase
      .from("orders")
      .select("id, valor_bruto, valor_liquido, commercial")
      .eq("sncf_pedido_id", sncfId)
      .limit(1);

    if (orderErr || !orders?.length) {
      resultados.push({ sncf_pedido_id: sncfId, erro: orderErr ? `DB erro: ${orderErr.message} (code: ${orderErr.code})` : "Order não encontrada" });
      continue;
    }

    const order = orders[0];

    // Buscar itens
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("sku, quantity, preco_unit_atacado, subtotal_bruto, product_snapshot")
      .eq("order_id", order.id)
      .order("posicao", { ascending: true });

    if (itemsErr) {
      resultados.push({ sncf_pedido_id: sncfId, erro: itemsErr.message });
      continue;
    }

    resultados.push({
      sncf_pedido_id: sncfId,
      order_id: order.id,
      valor_bruto: order.valor_bruto,
      valor_liquido: order.valor_liquido,
      commercial: order.commercial,
      items: items ?? [],
    });
  }

  return new Response(JSON.stringify({ ok: true, resultados }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
