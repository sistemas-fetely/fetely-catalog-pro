// Portão de publicação — proxy para o SNCF.
// Mesmo padrão de token do sincronizar-catalogo: o secret SNCF_OUTBOUND_TOKEN
// vem do vault (rpc get_vault_secret) e vai como Authorization Bearer.
// FAIL-LOUD: qualquer falha sobe como erro, nunca "ok" silencioso.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SNCF_URL = "https://vaxzorhqzvsnkutrlvfr.supabase.co/functions/v1/recebe-pedido";

export const fichaPendencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { skus?: string[] }) =>
    z.object({ skus: z.array(z.string()).optional() }).parse(input),
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
      body: JSON.stringify({ tipo: "ficha_pendencias", skus: data.skus ?? [] }),
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
