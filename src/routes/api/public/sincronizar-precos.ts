// 🟢 FOP — sincronizar-precos v1.0
// Empurra para o SNCF (receber-precos) o espelho da tabela de preço:
// vigências (product_prices) + histórico (product_price_history).
// SÓ LEITURA no FOP, só envio para fora — não escreve nada em lugar nenhum.
// Espelho é espelho: preço invertido, zero, vigência órfã e autor nulo vão
// como estão. Apontar é papel do SNCF; corrigir é do dono do preço.
//
// Segurança: /api/public/* bypassa o auth do site, então este handler verifica
// o chamador — exige Bearer de usuário autenticado com papel admin ou master.

import { createFileRoute } from "@tanstack/react-router";

const SNCF_URL =
  "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/receber-precos";

const MAX_ERROS = 50;
const LOTE = 500;
const PAGINA = 1000;

export const Route = createFileRoute("/api/public/sincronizar-precos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Verificação do chamador (rota pública não tem auth do site).
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.replace(/^Bearer\s+/i, "").trim();
          if (!token) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
          if (userErr || !userData?.user) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const { data: roles } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id);
          const lista = (roles ?? []).map((r) => r.role as string);
          if (!(lista.includes("admin") || lista.includes("master"))) {
            return Response.json({ error: "Sem permissão" }, { status: 403 });
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: sncfToken } = await (supabaseAdmin as any).rpc("get_vault_secret", {
            p_name: "SNCF_OUTBOUND_TOKEN",
          });
          if (!sncfToken) {
            return Response.json({ error: "Secret SNCF_OUTBOUND_TOKEN não configurado" }, { status: 500 });
          }

          // deno-lint-ignore no-explicit-any
          const lerTudo = async (tabela: string, select: string): Promise<any[]> => {
            // O PostgREST corta em 1000 por query — paginar até vir página curta.
            const linhas: unknown[] = [];
            let desde = 0;
            for (;;) {
              const { data, error } = await supabaseAdmin
                .from(tabela)
                .select(select)
                .order("id")
                .range(desde, desde + PAGINA - 1);
              if (error) throw error;
              if (!data || data.length === 0) break;
              linhas.push(...data);
              if (data.length < PAGINA) break;
              desde += PAGINA;
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

          // Vigência cujo product_id não existe mais em products vai mesmo assim,
          // com cod_cadastro e sku nulos — é lixo conhecido e o SNCF precisa enxergar.
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
              `[sincronizar-precos] lote ${tipo}#${indiceLote} falhou: ${msg}${corpoCru ? ` | corpo: ${corpoCru.slice(0, 500)}` : ""}`
            );
            if (erros.length < MAX_ERROS) {
              erros.push({ tipo, indice_lote: indiceLote, erro: msg });
            } else {
              errosOmitidos += 1;
            }
          };

          const enviarBloco = async (body: Record<string, unknown>) => {
            const resp = await fetch(SNCF_URL, {
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
          for (let i = 0; i < vigencias.length; i += LOTE) {
            const fatia = vigencias.slice(i, i + LOTE);
            try {
              await enviarBloco({ tipo: "precos", vigencias: fatia });
              envVigencias += fatia.length;
            } catch (e) {
              registrarErro("vigencias", i / LOTE + 1, e instanceof Error ? e.message : String(e), (e as { cru?: string }).cru);
            }
          }

          for (let i = 0; i < historico.length; i += LOTE) {
            const fatia = historico.slice(i, i + LOTE);
            try {
              await enviarBloco({ tipo: "precos", historico: fatia });
              envHistorico += fatia.length;
            } catch (e) {
              registrarErro("historico", i / LOTE + 1, e instanceof Error ? e.message : String(e), (e as { cru?: string }).cru);
            }
          }

          console.log(
            `[sincronizar-precos v1.0] vigencias: ${envVigencias}/${vigencias.length}, historico: ${envHistorico}/${historico.length}, falhados: ${falhados}`
          );

          if (envVigencias === 0 && envHistorico === 0) {
            return Response.json(
              {
                ok: false,
                vigencias: 0,
                historico: 0,
                falhados,
                erros,
                ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
                error: "Nenhum item sincronizado",
              },
              { status: 500 }
            );
          }

          return Response.json({
            ok: falhados === 0,
            vigencias: envVigencias,
            historico: envHistorico,
            falhados,
            erros,
            ...(errosOmitidos > 0 ? { erros_omitidos: errosOmitidos } : {}),
            mensagem: `${envVigencias} vigências e ${envHistorico} registros de histórico sincronizados${falhados > 0 ? `, ${falhados} blocos com erro` : ""}`,
          });
        } catch (e) {
          console.error("[sincronizar-precos]", e);
          return Response.json({ error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
