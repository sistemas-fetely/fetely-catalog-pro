// 🟢 FOP — sincronizar-catalogo
// Lê todos os produtos ativos e envia ao SNCF para upsert em sncf_produtos

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lê token e URL do SNCF do cofre
    const { data: sncfToken } = await supabase.rpc("get_vault_secret", { p_name: "SNCF_CATALOGO_TOKEN" });
    const { data: sncfUrl }   = await supabase.rpc("get_vault_secret", { p_name: "SNCF_CATALOGO_URL" });

    if (!sncfToken || !sncfUrl) {
      return jsonResponse(500, { error: "Secrets SNCF_CATALOGO_TOKEN ou SNCF_CATALOGO_URL não configurados" });
    }

    // Busca produtos ativos
    const { data: produtos, error } = await supabase
      .from("products")
      .select("sku, nome_comercial, preco_atacado, peso_g, multiplos, ativo")
      .eq("ativo", true)
      .order("sku");

    if (error) throw error;

    if (!produtos || produtos.length === 0) {
      return jsonResponse(200, { ok: true, enviados: 0, mensagem: "Nenhum produto ativo" });
    }

    // Envia ao SNCF em lotes de 500
    const LOTE = 500;
    let totalEnviados = 0;

    for (let i = 0; i < produtos.length; i += LOTE) {
      const lote = produtos.slice(i, i + LOTE);

      const resp = await fetch(sncfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sncfToken}`,
        },
        body: JSON.stringify({ produtos: lote }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`SNCF respondeu ${resp.status}: ${JSON.stringify(err)}`);
      }

      totalEnviados += lote.length;
    }

    console.log(`[sincronizar-catalogo] ${totalEnviados} produtos enviados ao SNCF`);

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
