import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STATUS_FATURADOS = ["confirmado"];

async function assertPodeVer(context: { supabase: any; userId: string }) {
  const { data: adminMaster } = await context.supabase.rpc("is_admin_or_master", {
    _user_id: context.userId,
  });
  if (adminMaster) return { isAdmin: true };
  const { data: interno } = await context.supabase.rpc("is_vendedor_interno", {
    _user_id: context.userId,
  });
  if (!interno) throw new Error("Painel exclusivo do time interno de vendas");
  return { isAdmin: false };
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: adminMaster } = await context.supabase.rpc("is_admin_or_master", {
    _user_id: context.userId,
  });
  if (!adminMaster) throw new Error("Apenas administradores podem editar metas");
}

export interface VendedorMetaLinha {
  vendedorId: string | null;
  nome: string;
  login: string | null;
  meta: number;
  realizado: number;
  realizadoPorDia: Record<number, number>;
}

export interface MetasPaceDataResult {
  ano: number;
  mes: number;
  metaGlobal: number;
  temMetaGlobalCustomizada: boolean;
  vendedores: VendedorMetaLinha[];
  semVendedor: { realizado: number; realizadoPorDia: Record<number, number> };
  totalRealizado: number;
  realizadoPorDiaTime: Record<number, number>;
  podeEditar: boolean;
}

export const getMetasPaceData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ano: number; mes: number }) =>
    z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<MetasPaceDataResult> => {
    const { isAdmin } = await assertPodeVer(context as any);
    const { supabase } = context;
    const { ano, mes } = data;

    // Meta global
    const { data: metaMensal } = await supabase
      .from("meta_mensal")
      .select("meta_global")
      .eq("ano", ano)
      .eq("mes", mes)
      .maybeSingle();
    const metaGlobal = Number(metaMensal?.meta_global ?? 500000);

    // Vendedores internos ativos
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, nome_completo, email, login_amigavel, tipo_vendedor, ativo")
      .eq("ativo", true);
    type Perfil = {
      id: string;
      nome_completo: string | null;
      email: string;
      login_amigavel: string | null;
      tipo_vendedor: string | null;
    };
    const internosMap = new Map<string, Perfil>();
    for (const p of (perfis ?? []) as Perfil[]) {
      const tv = p.tipo_vendedor ?? "interno";
      if (tv === "interno") internosMap.set(p.id, p);
    }

    // Considera vendedores internos ativos (independente de role explícito),
    // pois admins/masters também operam como vendedores internos no painel.
    const vendedoresInternos = Array.from(internosMap.values());

    // Metas individuais
    const { data: metasInd } = await supabase
      .from("meta_vendedor")
      .select("vendedor_id, meta")
      .eq("ano", ano)
      .eq("mes", mes);
    const metaPorVendedor = new Map<string, number>();
    for (const r of (metasInd ?? []) as Array<{ vendedor_id: string; meta: number }>) {
      metaPorVendedor.set(r.vendedor_id, Number(r.meta));
    }

    // Pedidos faturados no mês (status confirmado, usando aprovado_em fallback created_at)
    const inicio = new Date(ano, mes - 1, 1).toISOString();
    const fim = new Date(ano, mes, 1).toISOString();

    const { data: pedidos } = await supabase
      .from("orders")
      .select("id, total, vendedor_id, vendedor_nome, aprovado_em, created_at, status_pedido, bonificado")
      .in("status_pedido", STATUS_FATURADOS)
      .gte("created_at", inicio)
      .lt("created_at", fim);

    type Pedido = {
      id: string;
      total: number;
      vendedor_id: string | null;
      vendedor_nome: string | null;
      aprovado_em: string | null;
      created_at: string;
      bonificado?: boolean | null;
    };

    const porVendedor = new Map<string, { realizado: number; porDia: Record<number, number> }>();
    let semRealizado = 0;
    const semPorDia: Record<number, number> = {};
    const timePorDia: Record<number, number> = {};

    for (const p of (pedidos ?? []) as Pedido[]) {
      // Pedidos bonificados não contam em meta/pace
      if (p.bonificado) continue;
      const dataRef = p.aprovado_em ?? p.created_at;
      const dt = new Date(dataRef);
      const dia = dt.getDate();
      const total = Number(p.total ?? 0);
      timePorDia[dia] = (timePorDia[dia] ?? 0) + total;

      const vid = p.vendedor_id;
      // Só conta na meta individual se o vendedor for interno
      if (vid && internosMap.has(vid)) {
        const acc = porVendedor.get(vid) ?? { realizado: 0, porDia: {} };
        acc.realizado += total;
        acc.porDia[dia] = (acc.porDia[dia] ?? 0) + total;
        porVendedor.set(vid, acc);
      } else {
        semRealizado += total;
        semPorDia[dia] = (semPorDia[dia] ?? 0) + total;
      }
    }

    const vendedores: VendedorMetaLinha[] = vendedoresInternos
      .map((p) => {
        const agg = porVendedor.get(p.id) ?? { realizado: 0, porDia: {} };
        return {
          vendedorId: p.id,
          nome: p.nome_completo ?? p.email,
          login: p.login_amigavel,
          meta: metaPorVendedor.get(p.id) ?? 0,
          realizado: agg.realizado,
          realizadoPorDia: agg.porDia,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const totalRealizado = Object.values(timePorDia).reduce((s, v) => s + v, 0);

    return {
      ano,
      mes,
      metaGlobal,
      temMetaGlobalCustomizada: !!metaMensal,
      vendedores,
      semVendedor: { realizado: semRealizado, realizadoPorDia: semPorDia },
      totalRealizado,
      realizadoPorDiaTime: timePorDia,
      podeEditar: isAdmin,
    };
  });

export const upsertMetaMensal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ano: number; mes: number; metaGlobal: number }) =>
    z
      .object({
        ano: z.number().int(),
        mes: z.number().int().min(1).max(12),
        metaGlobal: z.number().nonnegative(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase.from("meta_mensal").upsert(
      {
        ano: data.ano,
        mes: data.mes,
        meta_global: data.metaGlobal,
        atualizado_por: context.userId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "ano,mes" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertMetaVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { ano: number; mes: number; vendedorId: string; meta: number }) =>
      z
        .object({
          ano: z.number().int(),
          mes: z.number().int().min(1).max(12),
          vendedorId: z.string().uuid(),
          meta: z.number().nonnegative(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase.from("meta_vendedor").upsert(
      {
        ano: data.ano,
        mes: data.mes,
        vendedor_id: data.vendedorId,
        meta: data.meta,
        atualizado_por: context.userId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "ano,mes,vendedor_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
