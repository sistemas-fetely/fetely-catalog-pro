// F1 — canal de leitura do espelho SNCF para o mapa-farol-espelho-catalogo-v1 v2.
// O FOP é o mestre do cadastro; o SNCF mantém `sncf_produtos` como espelho.
// Esta server function SÓ PERGUNTA ao espelho o que ele tem. Não compara,
// não classifica, não corrige e não grava no FOP. A derivação do farol fica
// para a camada de UI (F2).
//
// Modos de chamada (quem chama decide qual usar):
// - com `cods` preenchido → SNCF devolve `{ ok, modo: "por_cods", produtos: [...] }`
//   com `cod_cadastro, sku, fase, nome_comercial, preco_atacado, ean, dun, atualizado_em`
//   de cada produto solicitado.
// - sem `cods` → SNCF devolve `{ ok, modo: "inventario", total_banco, total_linhas, cods: [...] }`,
//   o inventário completo do espelho, usado para detectar órfãos (existe no SNCF
//   e não existe no FOP).
// FAIL-LOUD: qualquer falha sobe como erro, nunca "ok" silencioso.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SNCF_URL = "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/recebe-pedido";

export const catalogoEspelho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cods?: string[] }) =>
    z.object({ cods: z.array(z.string()).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const list = (roles ?? []).map((r) => r.role as string);
    if (!(list.includes("admin") || list.includes("master"))) {
      throw new Error("Sem permissão");
    }

    const { data: sncfToken, error: secretErr } = await supabaseAdmin.rpc("get_vault_secret", {
      p_name: "SNCF_OUTBOUND_TOKEN",
    });
    if (secretErr) throw new Error(`Vault: ${secretErr.message}`);
    if (!sncfToken) throw new Error("Secret SNCF_OUTBOUND_TOKEN não configurado");

    const resp = await fetch(SNCF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sncfToken}`,
      },
      body: JSON.stringify({ tipo: "catalogo_espelho", cods: data.cods ?? [] }),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      throw new Error(`SNCF respondeu ${resp.status}: ${raw.slice(0, 500)}`);
    }
    try {
      JSON.parse(raw);
    } catch {
      throw new Error(`SNCF devolveu resposta não-JSON: ${raw.slice(0, 300)}`);
    }
    // resposta crua do SNCF (JSON serializado, sem reinterpretação)
    return { json: raw };
  });
