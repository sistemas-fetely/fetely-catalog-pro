// 🟢 FOP — sincronizar-catalogo v3.2 (catálogo B2B expandido + CORS para chamada browser + cod_cadastro)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sncfToken } = await supabase.rpc("get_vault_secret", {
      p_name: "SNCF_OUTBOUND_TOKEN",
    });
    if (!sncfToken) {
      return jsonResponse(500, { error: "Secret SNCF_OUTBOUND_TOKEN não configurado" });
    }

    const sncfUrl =
      "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/recebe-pedido";

    const { data: produtos, error } = await supabase
      .from("products")
      .select("sku, cod_cadastro, ean, nome_comercial, nome_completo, marca, linha, grupo, tipo, colecao, cor_nome, cor, estampa, tamanho_numero, descricao_produto, tipo_embalagem, material, material_descritivo, ncm, cest, origem_fisc, origem_prod, preco_atacado, preco_varejo, peso_g, multiplos, ativo, altura_cm, largura_cm, profundidade_cm")
      .eq("ativo", true)
      .order("sku");

    if (error) throw error;
    if (!produtos || produtos.length === 0) {
      return jsonResponse(200, { ok: true, enviados: 0, mensagem: "Nenhum produto ativo" });
    }

    const LOTE = 500;
    let totalEnviados = 0;

    for (let i = 0; i < produtos.length; i += LOTE) {
      const lote = produtos.slice(i, i + LOTE).map((p) => ({
        sku:                  p.sku,
        cod_cadastro:         p.cod_cadastro ?? null, // chave canônica (mapa-donos-catalogo-v1); o SNCF só grava quando presente
        ean:                  p.ean                 ?? null,
        nome_comercial:       p.nome_comercial,
        nome_completo:        p.nome_completo        ?? null,
        marca:                p.marca               ?? null,
        linha:                p.linha               ?? null,
        grupo:                p.grupo               ?? null,
        tipo:                 p.tipo                ?? null,
        colecao:              p.colecao             ?? null,
        // cor e estampa sao os atributos DISCRIMINANTES: quando dois SKUs tem o mesmo
        // nome comercial, sao eles que separam (Petale = 6 cores; Fresh-Frutta e
        // Solar-Tropical = estampa). O SNCF usa esses campos em fn_gerar_nome_operacional()
        // para montar o nome usado na separacao e na NF. Nao remover.
        cor_nome:             p.cor_nome            ?? null,
        cor:                  p.cor                 ?? null,
        estampa:              p.estampa             ?? null,
        tamanho_numero:       p.tamanho_numero      ?? null,
        descricao_produto:    p.descricao_produto   ?? null,
        tipo_embalagem:       p.tipo_embalagem      ?? null,
        material:             p.material            ?? null,
        material_descritivo:  p.material_descritivo ?? null,
        ncm:                  p.ncm                 ?? null,
        cest:                 p.cest                ?? null,
        origem_fisc:          p.origem_fisc         ?? null,
        origem_prod:          p.origem_prod         ?? null,
        preco_atacado:        p.preco_atacado,
        preco_varejo:         p.preco_varejo,
        peso_g:               p.peso_g,
        multiplos:            p.multiplos,
        ativo:                p.ativo,
        altura_cm:            p.altura_cm           ?? null,
        largura_cm:           p.largura_cm          ?? null,
        profundidade_cm:      p.profundidade_cm     ?? null,
      }));

      const resp = await fetch(sncfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sncfToken}`,
        },
        body: JSON.stringify({ tipo: "catalogo", produtos: lote }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`SNCF respondeu ${resp.status}: ${JSON.stringify(err)}`);
      }

      totalEnviados += lote.length;
    }

    console.log(`[sincronizar-catalogo v3.1] ${totalEnviados} produtos enviados ao SNCF`);

    return jsonResponse(200, {
      ok: true,
      enviados: totalEnviados,
      mensagem: `${totalEnviados} produtos sincronizados`,
    });
  } catch (e) {
    console.error("[sincronizar-catalogo]", e);
    return jsonResponse(500, { error: String(e) });
  }
});