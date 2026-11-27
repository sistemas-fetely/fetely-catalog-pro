import { createServerFn } from "@tanstack/react-start";

export const carregarDadosSugestao = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Não foi possível carregar o histórico de vendas.");
  const client = createClient<import("@/integrations/supabase/types").Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const [ranking, afinidade, catalogo, faixas] = await Promise.all([
    client.rpc("public_ranking_vendas").range(0, 4999),
    client.rpc("public_afinidade_colecoes"),
    client.rpc("public_catalogo_sugestao"),
    client.rpc("public_faixas_sugestao"),
  ]);
  for (const r of [ranking, afinidade, catalogo, faixas])
    if (r.error) throw new Error("Não foi possível carregar a sugestão. Tente novamente.");
  return {
    ranking: ranking.data ?? [],
    afinidades: afinidade.data ?? [],
    produtos: catalogo.data,
    faixas: faixas.data ?? [],
  };
});
