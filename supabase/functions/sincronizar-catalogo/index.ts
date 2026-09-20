// 🟢 FOP — sincronizar-catalogo v8.1
// v8.1: modo `catalogo` passa a incluir `canal_venda` (b2b/b2c/ambos) no payload.
//       Nulo vai como nulo — 364 produtos sem canal decidido; o SNCF precisa enxergar
//       a pendência, não recebê-la preenchida por engano. Nenhum outro modo alterado.
// v8.0: novo modo de saída {"modo":"fotos"} — empurra o espelho da tabela `photos`
//       para o SNCF (receber-fotos), sem filtro nenhum, blocos de 500, sem autenticação
//       (igual a catalogo/precos: é saída de dado, não entrada de comando). Os cinco
//       modos anteriores não mudaram uma linha.
// v7.0: mais dois modos vindos da promover-fase-produto do SNCF (morta por credencial
//       de serviço nunca preenchida): {"modo":"promover_fase", sku, fase, motivo} e
//       {"modo":"registrar_pi", itens, dry_run}. Mesma autenticação do gravar_produto
//       (Bearer contra FSNC_INBOUND_TOKEN). Regras de degrau/ficha/saldo NÃO moram aqui:
//       são do SNCF. A trigger gate_fase do FOP segue como rede de proteção — sua recusa
//       volta 502 com a mensagem crua do Postgres.
// v6.0: terceiro modo de operação. Corpo {"modo":"gravar_produto", cod_cadastro, campos, motivo}
//       aplica UPDATE em products a pedido do SNCF (braço de escrita do bloco técnico).
//       Autentica por Bearer contra FSNC_INBOUND_TOKEN do cofre — token de ENTRADA,
//       distinto do SNCF_OUTBOUND_TOKEN (saída). Só este modo exige o header.
//       Campos de identidade (cod_cadastro, sku, ean, dun, fase, ativo) são recusados
//       com 403; recusa de trigger do banco volta 502 com a mensagem crua do Postgres.
//       Não valida dono de campo: a autorização já foi decidida pelo SNCF.
// v5.0: segundo modo de operação. Corpo {"modo":"precos"} NÃO sincroniza catálogo:
//       empurra para o SNCF (receber-precos) o espelho da tabela de preço
//       (product_prices + product_price_history), só leitura no FOP, só envio.
//       Sem `modo` (ou "catalogo"), o comportamento abaixo é EXATAMENTE o de sempre.
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

// ---------- MODO precos: espelho da tabela de preço para o SNCF ----------
// Só leitura no FOP, só envio para fora. Espelho é espelho: preço invertido,
// zero, vigência órfã e autor nulo vão como estão — apontar é papel do SNCF.
// deno-lint-ignore no-explicit-any
async function sincronizarPrecos(supabase: any, sncfToken: string) {
  const sncfUrl =
    "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/receber-precos";

  // deno-lint-ignore no-explicit-any
  const lerTudo = async (tabela: string, select: string): Promise<any[]> => {
    // O PostgREST corta em 1000 por query — paginar até vir página curta.
    const linhas: unknown[] = [];
    let desde = 0;
    for (;;) {
      const { data, error } = await supabase
        .from(tabela)
        .select(select)
        .order("id")
        .range(desde, desde + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      linhas.push(...data);
      if (data.length < 1000) break;
      desde += 1000;
    }
    return linhas;
  };

  // Join manual: product_id -> products(cod_cadastro, sku).
  const produtos = await lerTudo("products", "id, cod_cadastro, sku");
  const mapaProd = new Map(
    // deno-lint-ignore no-explicit-any
    produtos.map((p: any) => [
      p.id as string,
      { cod_cadastro: (p.cod_cadastro as string | null) ?? null, sku: (p.sku as string | null) ?? null },
    ])
  );

  // Sem filtro de ativo e sem filtro de fase: é espelho, manda tudo.
  const vigenciasRaw = await lerTudo(
    "product_prices",
    "id, product_id, preco_atacado, preco_varejo, vigencia_inicio, vigencia_fim, ativo, observacao, criado_por_nome, created_at, updated_at"
  );
  const historicoRaw = await lerTudo(
    "product_price_history",
    "id, product_id, sku, nome_comercial, preco_atacado_anterior, preco_varejo_anterior, preco_atacado_novo, preco_varejo_novo, variacao_atacado_percent, variacao_varejo_percent, acao, alterado_por_nome, observacao, criado_em"
  );

  // Vigência cujo product_id não existe mais em products vai mesmo assim, com
  // cod_cadastro e sku nulos — é lixo conhecido e o SNCF precisa enxergar.
  // deno-lint-ignore no-explicit-any
  const vigencias = vigenciasRaw.map((v: any) => {
    const prod = mapaProd.get(v.product_id);
    return {
      id: v.id,
      product_id: v.product_id,
      cod_cadastro: prod?.cod_cadastro ?? null,
      sku: prod?.sku ?? null,
      preco_atacado: v.preco_atacado,
      preco_varejo: v.preco_varejo,
      vigencia_inicio: v.vigencia_inicio,
      vigencia_fim: v.vigencia_fim,
      ativo: v.ativo,
      observacao: v.observacao ?? null,
      criado_por_nome: v.criado_por_nome ?? null, // vai como está — não inventar autor
      created_at: v.created_at,
      updated_at: v.updated_at,
    };
  });

  // deno-lint-ignore no-explicit-any
  const historico = historicoRaw.map((h: any) => {
    const prod = mapaProd.get(h.product_id);
    return {
      id: h.id,
      product_id: h.product_id,
      cod_cadastro: prod?.cod_cadastro ?? null,
      sku: h.sku ?? prod?.sku ?? null,
      nome_comercial: h.nome_comercial ?? null,
      preco_atacado_anterior: h.preco_atacado_anterior,
      preco_varejo_anterior: h.preco_varejo_anterior,
      preco_atacado_novo: h.preco_atacado_novo,
      preco_varejo_novo: h.preco_varejo_novo,
      variacao_atacado_percent: h.variacao_atacado_percent,
      variacao_varejo_percent: h.variacao_varejo_percent,
      acao: h.acao,
      alterado_por_nome: h.alterado_por_nome ?? null, // vai como está — a perda de autoria fica à vista
      observacao: h.observacao ?? null,
      criado_em: h.criado_em,
    };
  });

  let envVigencias = 0;
  let envHistorico = 0;
  let falhados = 0;
  const erros: Array<{ tipo: string; indice_lote: number; erro: string }> = [];
  let errosOmitidos = 0;

  const registrarErro = (tipo: string, indiceLote: number, msg: string, corpoCru?: string) => {
    falhados += 1;
    console.error(
      `[sincronizar-catalogo v5.0 modo=precos] lote ${tipo}#${indiceLote} falhou: ${msg}${corpoCru ? ` | corpo: ${corpoCru.slice(0, 500)}` : ""}`
    );
    if (erros.length < MAX_ERROS) {
      erros.push({ tipo, indice_lote: indiceLote, erro: msg });
    } else {
      errosOmitidos += 1;
    }
  };

  const enviarBloco = async (body: Record<string, unknown>) => {
    const resp = await fetch(sncfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sncfToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const cru = await resp.text().catch(() => "");
      const err = new Error(`SNCF respondeu ${resp.status}`) as Error & { cru?: string };
      err.cru = cru;
      throw err;
    }
  };

  // Bloco que falhar não aborta o resto: segue e acumula os erros.
  const LOTE_PRECOS = 500;
  for (let i = 0; i < vigencias.length; i += LOTE_PRECOS) {
    const fatia = vigencias.slice(i, i + LOTE_PRECOS);
    try {
      await enviarBloco({ vigencias: fatia });
      envVigencias += fatia.length;
    } catch (e) {
      registrarErro("vigencias", i / LOTE_PRECOS + 1, e instanceof Error ? e.message : String(e), (e as { cru?: string }).cru);
    }
  }

  for (let i = 0; i < historico.length; i += LOTE_PRECOS) {
    const fatia = historico.slice(i, i + LOTE_PRECOS);
    try {
      await enviarBloco({ historico: fatia });
      envHistorico += fatia.length;
    } catch (e) {
      registrarErro("historico", i / LOTE_PRECOS + 1, e instanceof Error ? e.message : String(e), (e as { cru?: string }).cru);
    }
  }

  console.log(
    `[sincronizar-catalogo v5.0 modo=precos] vigencias: ${envVigencias}/${vigencias.length}, historico: ${envHistorico}/${historico.length}, falhados: ${falhados}`
  );

  if (envVigencias === 0 && envHistorico === 0) {
    return jsonResponse(500, {
      ok: false,
      modo: "precos",
      vigencias: 0,
      historico: 0,
      falhados,
      erros,
      ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
      error: "Nenhum item sincronizado",
    });
  }

  return jsonResponse(200, {
    ok: falhados === 0,
    modo: "precos",
    vigencias: envVigencias,
    historico: envHistorico,
    falhados,
    erros,
    ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
    mensagem: `${envVigencias} vigências e ${envHistorico} registros de histórico sincronizados${falhados > 0 ? `, ${falhados} blocos com erro` : ""}`,
  });
}

// ---------- MODO fotos: espelho da tabela photos para o SNCF ----------
// Só leitura no FOP, só envio para fora. Sem filtro nenhum — colecao/cor nulos e
// foto órfã vão como estão: enxergar é papel do SNCF, não deste espelho.
// deno-lint-ignore no-explicit-any
async function sincronizarFotos(supabase: any, sncfToken: string) {
  const sncfUrl =
    "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/receber-fotos";

  // O PostgREST corta em 1000 por query — paginar até vir página curta.
  const fotos: unknown[] = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("photos")
      .select("id, kind, colecao, cor, categoria, url, path, created_at, updated_at")
      .order("id")
      .range(desde, desde + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    fotos.push(...data);
    if (data.length < 1000) break;
    desde += 1000;
  }

  let enviados = 0;
  let falhados = 0;
  const erros: Array<{ indice_lote: number; erro: string }> = [];
  let errosOmitidos = 0;

  const registrarErro = (indiceLote: number, msg: string, corpoCru?: string) => {
    falhados += 1;
    console.error(
      `[sincronizar-catalogo v8.0 modo=fotos] lote #${indiceLote} falhou: ${msg}${corpoCru ? ` | corpo: ${corpoCru.slice(0, 500)}` : ""}`
    );
    if (erros.length < MAX_ERROS) {
      erros.push({ indice_lote: indiceLote, erro: msg });
    } else {
      errosOmitidos += 1;
    }
  };

  // Bloco que falhar não aborta o resto: segue e acumula os erros.
  const LOTE_FOTOS = 500;
  for (let i = 0; i < fotos.length; i += LOTE_FOTOS) {
    const fatia = fotos.slice(i, i + LOTE_FOTOS);
    try {
      const resp = await fetch(sncfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sncfToken}`,
        },
        body: JSON.stringify({ fotos: fatia }),
      });
      if (!resp.ok) {
        const cru = await resp.text().catch(() => "");
        throw new Error(`SNCF respondeu ${resp.status}${cru ? `: ${cru}` : ""}`);
      }
      enviados += fatia.length;
    } catch (e) {
      const cru = (e as { cru?: string }).cru;
      registrarErro(i / LOTE_FOTOS + 1, e instanceof Error ? e.message : String(e), cru);
    }
  }

  console.log(
    `[sincronizar-catalogo v8.0 modo=fotos] fotos: ${enviados}/${fotos.length}, falhados: ${falhados}`
  );

  if (enviados === 0) {
    return jsonResponse(500, {
      ok: false,
      modo: "fotos",
      fotos: 0,
      falhados,
      erros,
      ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
      error: "Nenhuma foto sincronizada",
    });
  }

  return jsonResponse(200, {
    ok: falhados === 0,
    modo: "fotos",
    fotos: enviados,
    falhados,
    erros,
    ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
    mensagem: `${enviados} fotos sincronizadas${falhados > 0 ? `, ${falhados} blocos com erro` : ""}`,
  });
}

// ---------- MODO gravar_produto: braço de escrita do SNCF em products ----------
// Campos de identidade e ciclo de vida: identidade é do cartório e fase tem função
// própria — recusados com 403 sempre, nunca ignorados em silêncio.
const CAMPOS_PROIBIDOS = new Set(["cod_cadastro", "sku", "ean", "dun", "fase", "ativo"]);

// deno-lint-ignore no-explicit-any
async function gravarProduto(req: Request, supabase: any, corpo: any) {
  // Autenticação DESTE modo: token de entrada, conferido contra o cofre.
  // catalogo/precos não passam por aqui e seguem sem exigir header.
  const auth = req.headers.get("Authorization") ?? "";
  const tokenRecebido = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const { data: tokenEsperado } = await supabase.rpc("get_vault_secret", {
    p_name: "FSNC_INBOUND_TOKEN",
  });
  if (!tokenEsperado || !tokenRecebido || tokenRecebido !== tokenEsperado) {
    console.error("[sincronizar-catalogo v6.0 modo=gravar_produto] 401: token ausente ou inválido");
    return jsonResponse(401, { ok: false, modo: "gravar_produto", error: "Não autorizado" });
  }

  const codCadastro = typeof corpo?.cod_cadastro === "string" ? corpo.cod_cadastro.trim() : "";
  const motivo = typeof corpo?.motivo === "string" ? corpo.motivo.trim() : "";
  const campos = corpo?.campos;

  if (
    !codCadastro ||
    !motivo ||
    !campos ||
    typeof campos !== "object" ||
    Array.isArray(campos) ||
    Object.keys(campos).length === 0
  ) {
    console.error(
      `[sincronizar-catalogo v6.0 modo=gravar_produto] 400: corpo inválido: ${JSON.stringify(corpo).slice(0, 500)}`
    );
    return jsonResponse(400, {
      ok: false,
      modo: "gravar_produto",
      error: "cod_cadastro, motivo e campos (objeto não vazio) são obrigatórios",
    });
  }

  const proibidos = Object.keys(campos).filter((c) => CAMPOS_PROIBIDOS.has(c));
  if (proibidos.length > 0) {
    console.error(
      `[sincronizar-catalogo v6.0 modo=gravar_produto] 403: campos proibidos em ${codCadastro}: ${proibidos.join(", ")} | motivo: ${motivo}`
    );
    return jsonResponse(403, {
      ok: false,
      modo: "gravar_produto",
      cod_cadastro: codCadastro,
      error: `Campos não permitidos neste modo: ${proibidos.join(", ")}`,
      campos_recusados: proibidos,
    });
  }

  // Valores atuais para o de_para da resposta.
  const camposPedidos = Object.keys(campos);
  const { data: produto, error: errBusca } = await supabase
    .from("products")
    .select(`id, ${camposPedidos.join(", ")}`)
    .eq("cod_cadastro", codCadastro)
    .maybeSingle();
  if (errBusca) {
    console.error(
      `[sincronizar-catalogo v6.0 modo=gravar_produto] 502 na leitura de ${codCadastro}: ${errBusca.message}`
    );
    return jsonResponse(502, {
      ok: false,
      modo: "gravar_produto",
      cod_cadastro: codCadastro,
      error: "Banco recusou a leitura do produto",
      erro_banco: errBusca.message,
    });
  }
  if (!produto) {
    console.error(
      `[sincronizar-catalogo v6.0 modo=gravar_produto] 404: produto não encontrado: ${codCadastro} | motivo: ${motivo}`
    );
    return jsonResponse(404, {
      ok: false,
      modo: "gravar_produto",
      cod_cadastro: codCadastro,
      error: "Produto não encontrado",
    });
  }

  console.log(
    `[sincronizar-catalogo v6.0 modo=gravar_produto] ${codCadastro} | campos: ${camposPedidos.join(", ")} | motivo: ${motivo}`
  );

  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = {};
  // deno-lint-ignore no-explicit-any
  const dePara: Record<string, { de: any; para: any }> = {};
  for (const campo of camposPedidos) {
    patch[campo] = campos[campo];
    // deno-lint-ignore no-explicit-any
    dePara[campo] = { de: (produto as any)[campo] ?? null, para: campos[campo] };
  }

  const { error: errUpdate } = await supabase
    .from("products")
    .update(patch)
    .eq("cod_cadastro", codCadastro);
  if (errUpdate) {
    // A recusa das triggers (gate_fase, gate_dimensoes, derivar_sku) traz mensagem
    // útil do Postgres — vai crua, sem resumo.
    console.error(
      `[sincronizar-catalogo v6.0 modo=gravar_produto] 502 em ${codCadastro}: ${errUpdate.message}`
    );
    return jsonResponse(502, {
      ok: false,
      modo: "gravar_produto",
      cod_cadastro: codCadastro,
      error: "Banco recusou a gravação",
      erro_banco: errUpdate.message,
    });
  }

  return jsonResponse(200, {
    ok: true,
    modo: "gravar_produto",
    cod_cadastro: codCadastro,
    gravados: camposPedidos,
    de_para: dePara,
  });
}

// ---------- Autenticação de entrada (modos promover_fase / registrar_pi) ----------
// Mesmo Bearer contra FSNC_INBOUND_TOKEN do gravar_produto. catalogo/precos não passam
// por aqui e seguem sem exigir header.
// deno-lint-ignore no-explicit-any
async function autenticarEntrada(req: Request, supabase: any, modo: string): Promise<Response | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const tokenRecebido = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const { data: tokenEsperado } = await supabase.rpc("get_vault_secret", {
    p_name: "FSNC_INBOUND_TOKEN",
  });
  if (!tokenEsperado || !tokenRecebido || tokenRecebido !== tokenEsperado) {
    console.error(`[sincronizar-catalogo v7.0 modo=${modo}] 401: token ausente ou inválido`);
    return jsonResponse(401, { ok: false, modo, error: "Não autorizado" });
  }
  return null;
}

// ---------- MODO promover_fase: braço de escrita da promoção decidida no SNCF ----------
// Não replica regra de degrau/ficha/saldo — decisão já tomada do outro lado. A trigger
// gate_fase do FOP segue como rede de proteção; sua recusa volta crua.
// deno-lint-ignore no-explicit-any
async function promoverFase(req: Request, supabase: any, corpo: any) {
  const modo = "promover_fase";
  const negado = await autenticarEntrada(req, supabase, modo);
  if (negado) return negado;

  const sku = typeof corpo?.sku === "string" ? corpo.sku.trim() : "";
  const fase = typeof corpo?.fase === "string" ? corpo.fase.trim() : "";
  const motivo = typeof corpo?.motivo === "string" ? corpo.motivo.trim() : "";
  if (!sku || !fase || !motivo) {
    console.error(
      `[sincronizar-catalogo v7.0 modo=promover_fase] 400: corpo inválido: ${JSON.stringify(corpo).slice(0, 500)}`
    );
    return jsonResponse(400, {
      ok: false,
      modo,
      error: "sku, fase e motivo são obrigatórios e não vazios",
    });
  }

  const { data: produto, error: errBusca } = await supabase
    .from("products")
    .select("id, fase")
    .eq("sku", sku)
    .maybeSingle();
  if (errBusca) {
    console.error(
      `[sincronizar-catalogo v7.0 modo=promover_fase] 502 na leitura de ${sku}: ${errBusca.message}`
    );
    return jsonResponse(502, {
      ok: false,
      modo,
      sku,
      error: "Banco recusou a leitura do produto",
      erro_banco: errBusca.message,
    });
  }
  if (!produto) {
    console.error(
      `[sincronizar-catalogo v7.0 modo=promover_fase] 404: produto não encontrado: ${sku} | motivo: ${motivo}`
    );
    return jsonResponse(404, { ok: false, modo, sku, error: "Produto não encontrado" });
  }

  console.log(
    `[sincronizar-catalogo v7.0 modo=promover_fase] ${sku}: ${produto.fase} -> ${fase} | motivo: ${motivo}`
  );

  const { error: errUpdate } = await supabase
    .from("products")
    .update({ fase })
    .eq("sku", sku);
  if (errUpdate) {
    // A gate_fase recusa promoção com ficha incompleta listando os campos — vai crua.
    console.error(
      `[sincronizar-catalogo v7.0 modo=promover_fase] 502 em ${sku}: ${errUpdate.message}`
    );
    return jsonResponse(502, {
      ok: false,
      modo,
      sku,
      error: "Banco recusou a gravação",
      erro_banco: errUpdate.message,
    });
  }

  return jsonResponse(200, { ok: true, modo, sku, de: produto.fase, para: fase });
}

// ---------- MODO registrar_pi: cartório de produtos novos vindos da PI ----------
// Chama a RPC fn_registrar_produtos_cartorio e devolve o resultado inteiro, sem
// reinterpretar nada.
// deno-lint-ignore no-explicit-any
async function registrarPi(req: Request, supabase: any, corpo: any) {
  const modo = "registrar_pi";
  const negado = await autenticarEntrada(req, supabase, modo);
  if (negado) return negado;

  const itens = corpo?.itens;
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 200) {
    console.error(
      `[sincronizar-catalogo v7.0 modo=registrar_pi] 400: itens inválido: ${JSON.stringify(corpo).slice(0, 500)}`
    );
    return jsonResponse(400, {
      ok: false,
      modo,
      error: "itens deve ser um array não vazio com no máximo 200 itens",
    });
  }
  // dry_run default true: comportamento atual do SNCF, mantido.
  const dryRun = corpo?.dry_run !== false;

  console.log(
    `[sincronizar-catalogo v7.0 modo=registrar_pi] ${itens.length} itens | dry_run: ${dryRun}`
  );

  const { data: resultado, error: errRpc } = await supabase.rpc(
    "fn_registrar_produtos_cartorio",
    { p_itens: itens, p_dry_run: dryRun }
  );
  if (errRpc) {
    console.error(
      `[sincronizar-catalogo v7.0 modo=registrar_pi] 502 na RPC: ${errRpc.message}`
    );
    return jsonResponse(502, {
      ok: false,
      modo,
      error: "Banco recusou o registro",
      erro_banco: errRpc.message,
    });
  }

  return jsonResponse(200, { ok: true, modo, resultado });
}

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

    // Desvio do modo: {"modo":"precos"} empurra o espelho de preço e retorna.
    // {"modo":"fotos"} empurra o espelho de fotos e retorna.
    // {"modo":"gravar_produto"} grava campos em products a pedido do SNCF e retorna.
    // Sem `modo`, o caminho do catálogo abaixo segue intacto.
    const corpo = await req.json().catch(() => ({}));
    const modo = (corpo as { modo?: string })?.modo;
    if (modo === "precos") {
      return await sincronizarPrecos(supabase, sncfToken);
    }
    if (modo === "fotos") {
      return await sincronizarFotos(supabase, sncfToken);
    }
    if (modo === "gravar_produto") {
      return await gravarProduto(req, supabase, corpo);
    }
    if (modo === "promover_fase") {
      return await promoverFase(req, supabase, corpo);
    }
    if (modo === "registrar_pi") {
      return await registrarPi(req, supabase, corpo);
    }

    const sncfUrl =
      "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/recebe-pedido";

    // Sem filtro de `ativo`: inativos/descontinuados TAMBÉM precisam descer, senão o
    // espelho do SNCF congela no último estado conhecido. `ativo` e `fase` vão no payload.
    const { data: produtos, error } = await supabase
      .from("products")
      .select("sku, cod_cadastro, fase, departamento, categoria, ean, dun, nome_comercial, nome_completo, marca, linha, grupo, tipo, familia, qtd_kit, colecao, cor_nome, cor, estampa, tamanho_numero, descricao_produto, tipo_embalagem, material, material_descritivo, ncm, cest, origem_fisc, origem_prod, preco_atacado, preco_varejo, peso_g, multiplos, ativo, altura_cm, largura_cm, profundidade_cm, canal_venda")
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
      canal_venda:          p.canal_venda         ?? null, // b2b/b2c/ambos — nulo = pendente de decisão; SNCF precisa enxergar a pendência
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
