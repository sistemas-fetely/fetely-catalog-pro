import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SNCF_URL = "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/recebe-pedido";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizarForma(s: string | null | undefined): string | null {
  if (!s) return null;
  const lower = s.toLowerCase().trim();
  if (lower.includes("pix")) return "pix";
  if (lower.includes("cartao") || lower.includes("cartão")) return "cartao";
  if (lower.includes("boleto")) return "boleto";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Método não permitido. Use POST." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let orderId: string | undefined;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "Body JSON malformado" });
    }
    orderId = body?.order_id;
    if (!orderId) return jsonResponse(400, { error: "order_id obrigatório" });

    const { data: pedido, error: errPedido } = await supabase
      .from("orders")
      .select(`
        id, created_at, cliente_snapshot, commercial, forma_pagamento,
        valor_bruto, valor_liquido, total,
        vendedor_nome,
        sncf_enviado_em, sncf_tentativas,
        order_items (sku, quantity, preco_unit_atacado, subtotal_bruto, product_snapshot)
      `)
      .eq("id", orderId)
      .single();

    if (errPedido || !pedido) {
      return jsonResponse(404, { error: "Pedido não encontrado", details: errPedido?.message });
    }

    const clienteSnapshot = pedido.cliente_snapshot as any;
    const cnpj = clienteSnapshot?.cnpj;
    if (!cnpj) {
      return jsonResponse(400, { error: "Pedido sem CNPJ no snapshot do cliente" });
    }

    const formaNormalizada = normalizarForma(pedido.forma_pagamento);
    if (!formaNormalizada) {
      return jsonResponse(400, {
        error: `Forma de pagamento inválida ou ausente: '${pedido.forma_pagamento}'. Aceita: pix, cartão, boleto.`,
      });
    }

    // Marca pendente antes da chamada
    await supabase
      .from("orders")
      .update({ sncf_status_sync: "pendente", sncf_ultimo_erro: null })
      .eq("id", orderId);

    // Lê senha do cofre (Doutrina #77)
    const { data: senha, error: vaultError } = await supabase
      .rpc("get_vault_secret", { p_name: "SNCF_OUTBOUND_TOKEN" });

    const nowIso = new Date().toISOString();
    const novasTentativas = (pedido.sncf_tentativas ?? 0) + 1;

    if (vaultError || !senha) {
      console.error("[enviar-para-sncf] Falha ao ler senha do cofre", vaultError);
      await supabase.from("orders").update({
        sncf_status_sync: "erro_persistente",
        sncf_ultimo_erro: "Senha do SNCF não disponível no cofre",
        sncf_ultimo_sync_em: nowIso,
        sncf_tentativas: novasTentativas,
      }).eq("id", orderId);
      return jsonResponse(500, { error: "Erro de configuração interna" });
    }

    const commercial = pedido.commercial as any;
    const desconto_pct = commercial?.descontoMasterPct ?? 0;
    const condicao = commercial?.condicaoDescricao ?? "À vista";

    const itens = (pedido.order_items ?? []).map((it: any) => ({
      sku: it.sku,
      quantidade: it.quantity,
      preco_unitario: it.preco_unit_atacado,
      subtotal: it.subtotal_bruto,
      produto: it.product_snapshot,
    }));

    const payload = {
      cnpj,
      id_externo: pedido.id,
      data_pedido: pedido.created_at.split("T")[0],
      valor_bruto: pedido.valor_bruto ?? pedido.total,
      valor_liquido: pedido.valor_liquido ?? pedido.total,
      desconto_pct,
      condicao_solicitada: condicao,
      forma_solicitada: formaNormalizada,
      vendedor: pedido.vendedor_nome,
      origem: "vendedor",
      itens_json: itens,
    };

    // POST pro SNCF (FAIL-LOUD)
    const sncfResp = await fetch(SNCF_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${senha}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const sncfBody = await sncfResp.json().catch(() => ({ error: "Resposta sem JSON do SNCF" }));

    if (sncfResp.ok) {
      await supabase.from("orders").update({
        sncf_status_sync: "enviado",
        sncf_pedido_id: sncfBody.pedido_id,
        sncf_estagio: sncfBody.estagio_inicial,
        sncf_enviado_em: pedido.sncf_enviado_em ?? nowIso,
        sncf_ultimo_sync_em: nowIso,
        sncf_ultimo_erro: null,
        sncf_tentativas: novasTentativas,
      }).eq("id", orderId);
      return jsonResponse(200, { ok: true, ...sncfBody });
    }

    const isClientError = sncfResp.status >= 400 && sncfResp.status < 500;
    const novoStatus = isClientError ? "rejeitado" : "erro_persistente";
    const mensagemErro = sncfBody?.error ?? `HTTP ${sncfResp.status}`;

    await supabase.from("orders").update({
      sncf_status_sync: novoStatus,
      sncf_ultimo_erro: mensagemErro,
      sncf_ultimo_sync_em: nowIso,
      sncf_tentativas: novasTentativas,
    }).eq("id", orderId);

    return jsonResponse(sncfResp.status, {
      ok: false,
      error: mensagemErro,
      sncf_status: sncfResp.status,
      sncf_response: sncfBody,
    });

  } catch (e) {
    const err = e as Error;
    console.error("[enviar-para-sncf] Exceção", err);
    if (orderId) {
      try {
        await supabase.from("orders").update({
          sncf_status_sync: "erro_persistente",
          sncf_ultimo_erro: `Exceção: ${err.message}`,
          sncf_ultimo_sync_em: new Date().toISOString(),
        }).eq("id", orderId);
      } catch {}
    }
    return jsonResponse(500, { error: "Erro interno: " + err.message });
  }
});
