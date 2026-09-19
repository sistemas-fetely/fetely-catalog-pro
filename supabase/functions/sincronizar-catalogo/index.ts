// 🟢 FOP — sincronizar-catalogo v4.0
// v4.0: (1) lote que falha não aborta mais a sincronização — reenvio item a item com
//       coleta de erros e resumo final; (2) removido o filtro .eq("ativo", true) para o
//       SNCF receber também descontinuados (quem decide é o SNCF, não este filtro);
//       (3) payload passa a incluir `familia` e `qtd_kit` (obrigatórios na matriz
//       produto_fase_ficha na fase pre_venda).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ERROS = 50;

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

    // Sem filtro de `ativo`: inativos/descontinuados TAMBÉM precisam descer, senão o
    // espelho do SNCF congela no último estado conhecido. `ativo` e `fase` vão no payload.
    const { data: produtos, error } = await supabase
      .from("products")
      .select("sku, cod_cadastro, fase, departamento, categoria, ean, dun, nome_comercial, nome_completo, marca, linha, grupo, tipo, familia, qtd_kit, colecao, cor_nome, cor, estampa, tamanho_numero, descricao_produto, tipo_embalagem, material, material_descritivo, ncm, cest, origem_fisc, origem_prod, preco_atacado, preco_varejo, peso_g, multiplos, ativo, altura_cm, largura_cm, profundidade_cm")
      .order("sku");

    if (error) throw error;
    if (!produtos || produtos.length === 0) {
      return jsonResponse(200, { ok: true, enviados: 0, falhados: 0, mensagem: "Nenhum produto" });
    }

    // Matriz campo x fase e dimensao de fase: mestre aqui, espelho no SNCF.
    // Vai antes dos produtos porque `products.fase` referencia essas fases.
    // Esta etapa PROPOSITALMENTE aborta em caso de erro: sem a matriz, sincronizar produto
    // não faz sentido.
    const { data: fases, error: errFases } = await supabase
      .from("produto_fase_dim")
      .select("slug, nome, ordem, visivel_catalogo, descricao")
      .order("ordem");
    if (errFases) throw errFases;

    const { data: ficha, error: errFicha } = await supabase
      .from("produto_fase_ficha")
      .select("campo, bloco, dono, fase_exigida, obrigatorio, ordem, descricao")
      .order("ordem");
    if (errFicha) throw errFicha;

    const respDim = await fetch(sncfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sncfToken}`,
      },
      body: JSON.stringify({
        tipo: "dimensoes_produto",
        fases: fases ?? [],
        ficha: ficha ?? [],
      }),
    });

    if (!respDim.ok) {
      const err = await respDim.json().catch(() => ({}));
      throw new Error(`SNCF respondeu ${respDim.status} na sincronização das dimensões: ${JSON.stringify(err)}`);
    }

    // deno-lint-ignore no-explicit-any
    const toPayload = (p: any) => ({
      sku:                  p.sku,
      cod_cadastro:         p.cod_cadastro ?? null, // chave canônica (mapa-donos-catalogo-v1); o SNCF só grava quando presente
      departamento:         p.departamento        ?? null, // evita grupos homônimos parecerem duplicatas no espelho SNCF
      categoria:            p.categoria           ?? null,
      ean:                  p.ean                 ?? null,
      dun:                  p.dun                 ?? null, // DUN-14 da caixa inner; só exigido na promoção para Ativo
      nome_comercial:       p.nome_comercial,
      nome_completo:        p.nome_completo        ?? null,
      marca:                p.marca               ?? null,
      linha:                p.linha               ?? null,
      grupo:                p.grupo               ?? null,
      tipo:                 p.tipo                ?? null,
      familia:              p.familia             ?? null, // obrigatório na matriz produto_fase_ficha (pre_venda)
      qtd_kit:              p.qtd_kit             ?? null, // obrigatório na matriz produto_fase_ficha (pre_venda)
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
      fase:                 p.fase                ?? null, // fase do ciclo de vida (mapa-donos-catalogo-v1 v4): registrado / pre_venda / ativo / inativo
      altura_cm:            p.altura_cm           ?? null,
      largura_cm:           p.largura_cm          ?? null,
      profundidade_cm:      p.profundidade_cm     ?? null,
    });

    const enviarProdutos = async (lista: unknown[]) => {
      const resp = await fetch(sncfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sncfToken}`,
        },
        body: JSON.stringify({ tipo: "catalogo", produtos: lista }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg =
          (err as { error?: string; message?: string }).error ??
          (err as { message?: string }).message ??
          JSON.stringify(err);
        throw new Error(`SNCF respondeu ${resp.status}: ${msg}`);
      }
    };

    const LOTE = 500;
    let totalEnviados = 0;
    let totalFalhados = 0;
    const erros: Array<{ cod_cadastro: string | null; sku: string | null; erro: string }> = [];
    let errosOmitidos = 0;

    const registrarErro = (p: { cod_cadastro?: string | null; sku?: string | null }, e: unknown) => {
      totalFalhados += 1;
      if (erros.length < MAX_ERROS) {
        erros.push({
          cod_cadastro: p.cod_cadastro ?? null,
          sku: p.sku ?? null,
          erro: e instanceof Error ? e.message : String(e),
        });
      } else {
        errosOmitidos += 1;
      }
    };

    for (let i = 0; i < produtos.length; i += LOTE) {
      const fatia = produtos.slice(i, i + LOTE);
      const lote = fatia.map(toPayload);

      try {
        await enviarProdutos(lote);
        totalEnviados += lote.length;
      } catch (loteErr) {
        // Uma linha ruim não pode derrubar o lote inteiro: reenvia item a item,
        // isola o(s) culpado(s) e segue para os lotes seguintes.
        console.warn(
          `[sincronizar-catalogo v4.0] lote ${i / LOTE + 1} falhou (${String(loteErr)}); reenviando item a item`
        );
        for (const p of lote) {
          try {
            await enviarProdutos([p]);
            totalEnviados += 1;
          } catch (itemErr) {
            registrarErro(p, itemErr);
          }
        }
      }
    }

    console.log(
      `[sincronizar-catalogo v4.0] dimensoes: { fases: ${(fases ?? []).length}, ficha: ${(ficha ?? []).length} }, enviados: ${totalEnviados}, falhados: ${totalFalhados}`
    );

    if (totalEnviados === 0) {
      return jsonResponse(500, {
        ok: false,
        enviados: 0,
        falhados: totalFalhados,
        dimensoes: { fases: (fases ?? []).length, ficha: (ficha ?? []).length },
        erros,
        ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
        error: "Nenhum produto sincronizado",
      });
    }

    return jsonResponse(200, {
      ok: totalFalhados === 0,
      enviados: totalEnviados,
      falhados: totalFalhados,
      dimensoes: { fases: (fases ?? []).length, ficha: (ficha ?? []).length },
      erros,
      ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
      mensagem: `${totalEnviados} produtos sincronizados${totalFalhados > 0 ? `, ${totalFalhados} com erro` : ""}`,
    });
  } catch (e) {
    console.error("[sincronizar-catalogo]", e);
    return jsonResponse(500, { error: String(e) });
  }
});
