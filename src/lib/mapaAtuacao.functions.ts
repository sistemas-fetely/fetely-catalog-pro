import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Integração com o Fetély Connect (FETÉLY REDE): o mapa de atuação dos
// representantes mora lá; aqui só lemos e vinculamos usuários do Order Pro.
const CONNECT_BASE = "https://fetely-rep-connect.lovable.app";

export type MapaRep = {
  id: string;
  nome: string;
  whatsapp: string | null;
  ufs: string[];
  nacional: boolean;
  linhas: string[];
  orderProUserId: string | null;
};

export type MapaAtuacao = {
  geradoEm: string;
  representantes: MapaRep[];
  ufPrioritaria: string | null;
  ufsCandidatos: string[];
};

type MapaAtuacaoRaw = {
  gerado_em: string;
  representantes: Array<{
    id: string;
    nome: string;
    whatsapp: string | null;
    ufs: string[];
    nacional: boolean;
    linhas: string[];
    order_pro_user_id: string | null;
  }>;
  uf_prioritaria: string | null;
  ufs_candidatos: string[];
};

async function assertCrmAccess(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ gestao: boolean }> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const lista = ((roles ?? []) as Array<{ role: string }>).map((r) => r.role);
  const gestao =
    lista.includes("admin") ||
    lista.includes("master") ||
    lista.includes("gestao_representantes");
  if (gestao) return { gestao: true };
  const { data: profile } = await supabase
    .from("profiles")
    .select("tipo_vendedor")
    .eq("id", userId)
    .maybeSingle();
  if ((profile as { tipo_vendedor?: string } | null)?.tipo_vendedor === "representante") {
    return { gestao: false };
  }
  throw new Error("Acesso restrito a representantes e à gestão comercial.");
}

async function fetchConnect(path: string, init?: RequestInit): Promise<Response> {
  const token = process.env.MAPA_ATUACAO_TOKEN;
  if (!token) throw new Error("Integração com o mapa de atuação não configurada.");
  const res = await fetch(`${CONNECT_BASE}${path}`, {
    ...init,
    headers: { "X-Mapa-Token": token, ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new Error("Senha da integração recusada pelo Fetély Connect.");
  if (!res.ok) throw new Error(`Fetély Connect respondeu com erro ${res.status}.`);
  return res;
}

export const carregarMapaAtuacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const res = await fetchConnect("/api/public/mapa-atuacao");
    const json = (await res.json()) as MapaAtuacaoRaw;
    return {
      geradoEm: json.gerado_em,
      representantes: (json.representantes ?? []).map((r) => ({
        id: r.id,
        nome: (r.nome ?? "").trim(),
        whatsapp: r.whatsapp ?? null,
        ufs: r.ufs ?? [],
        nacional: !!r.nacional,
        linhas: r.linhas ?? [],
        orderProUserId: r.order_pro_user_id ?? null,
      })),
      ufPrioritaria: json.uf_prioritaria ?? null,
      ufsCandidatos: json.ufs_candidatos ?? [],
    };
  });

export const vincularRepresentanteMapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        representanteId: z.string().uuid(),
        orderProUserId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { gestao } = await assertCrmAccess(supabase, userId);
    if (!gestao) throw new Error("Só a gestão pode vincular representantes ao mapa.");
    const res = await fetchConnect("/api/public/vincular-representante", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        representante_id: data.representanteId,
        order_pro_user_id: data.orderProUserId,
      }),
    });
    await res.json().catch(() => null);
    return { ok: true };
  });
