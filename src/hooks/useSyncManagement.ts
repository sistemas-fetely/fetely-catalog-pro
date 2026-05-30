import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SncfStatus =
  | "nao_enviado"
  | "pendente"
  | "enviado"
  | "rejeitado"
  | "erro_persistente";

export interface SyncOrderRow {
  id: string;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  cliente_nome: string | null;
  total: number;
  forma_pagamento: string | null;
  created_at: string;
  sncf_status_sync: SncfStatus;
  sncf_pedido_id: string | null;
  sncf_estagio: string | null;
  sncf_ultimo_erro: string | null;
  sncf_enviado_em: string | null;
  sncf_ultimo_sync_em: string | null;
  sncf_tentativas: number | null;
}

export interface SyncFiltersInput {
  statuses: SncfStatus[];
  vendedorId: string | null;
  periodo: "hoje" | "7d" | "30d" | "tudo";
}

export interface SyncKpis {
  naoEnviados: number;
  errosPersistentes: number;
  rejeitados: number;
  taxaSucesso7d: number;
}

function pickClienteNome(cs: unknown, meta: unknown): string | null {
  const tryFields = (o: unknown): string | null => {
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    for (const k of ["nome_fantasia", "razao_social", "cliente", "nome", "fantasia"]) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  };
  return tryFields(cs) ?? tryFields(meta);
}

export function useSyncManagement(filters: SyncFiltersInput) {
  const query = useQuery({
    queryKey: ["sync-management", filters],
    queryFn: async () => {
      const cutoff = ((): string | null => {
        const now = new Date();
        if (filters.periodo === "hoje") {
          now.setHours(0, 0, 0, 0);
          return now.toISOString();
        }
        if (filters.periodo === "7d") {
          now.setDate(now.getDate() - 7);
          return now.toISOString();
        }
        if (filters.periodo === "30d") {
          now.setDate(now.getDate() - 30);
          return now.toISOString();
        }
        return null;
      })();

      let q = supabase
        .from("orders")
        .select(
          `id, vendedor_id, vendedor_nome, cliente_snapshot, meta, total,
           forma_pagamento, created_at, sncf_status_sync, sncf_pedido_id,
           sncf_estagio, sncf_ultimo_erro, sncf_enviado_em, sncf_ultimo_sync_em,
           sncf_tentativas`,
        )
        .order("created_at", { ascending: false });

      if (cutoff) q = q.gte("created_at", cutoff);
      if (filters.vendedorId) q = q.eq("vendedor_id", filters.vendedorId);

      if (filters.statuses.length > 0 && filters.statuses.length < 5) {
        const includesNaoEnviado = filters.statuses.includes("nao_enviado");
        const nonNull = filters.statuses.filter((s) => s !== "nao_enviado");
        if (includesNaoEnviado && nonNull.length > 0) {
          q = q.or(
            `sncf_status_sync.is.null,sncf_status_sync.eq.nao_enviado,sncf_status_sync.in.(${nonNull.join(",")})`,
          );
        } else if (includesNaoEnviado) {
          q = q.or("sncf_status_sync.is.null,sncf_status_sync.eq.nao_enviado");
        } else if (nonNull.length > 0) {
          q = q.in("sncf_status_sync", nonNull);
        }
      }

      const { data, error } = await q.limit(500);
      if (error) throw error;

      const rows: SyncOrderRow[] = (data ?? []).map((r) => ({
        id: r.id,
        vendedor_id: r.vendedor_id,
        vendedor_nome: r.vendedor_nome ?? null,
        cliente_nome: pickClienteNome(r.cliente_snapshot, r.meta),
        total: Number(r.total ?? 0),
        forma_pagamento: r.forma_pagamento,
        created_at: r.created_at,
        sncf_status_sync: (r.sncf_status_sync as SncfStatus | null) ?? "nao_enviado",
        sncf_pedido_id: r.sncf_pedido_id,
        sncf_estagio: r.sncf_estagio,
        sncf_ultimo_erro: r.sncf_ultimo_erro,
        sncf_enviado_em: r.sncf_enviado_em,
        sncf_ultimo_sync_em: r.sncf_ultimo_sync_em,
        sncf_tentativas: r.sncf_tentativas,
      }));

      const order: Record<SncfStatus, number> = {
        erro_persistente: 0,
        rejeitado: 1,
        nao_enviado: 2,
        pendente: 3,
        enviado: 4,
      };
      rows.sort((a, b) => {
        const d = order[a.sncf_status_sync] - order[b.sncf_status_sync];
        if (d !== 0) return d;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return rows;
    },
    refetchInterval: 60_000,
  });

  const kpis = useMemo<SyncKpis>(() => {
    const rows = query.data ?? [];
    let naoEnviados = 0;
    let errosPersistentes = 0;
    let rejeitados = 0;
    let enviados = 0;
    for (const r of rows) {
      if (r.sncf_status_sync === "erro_persistente") errosPersistentes++;
      else if (r.sncf_status_sync === "rejeitado") rejeitados++;
      else if (r.sncf_status_sync === "nao_enviado") naoEnviados++;
      else if (r.sncf_status_sync === "enviado") enviados++;
    }
    const total = rows.length;
    const taxa = total > 0 ? Math.round((enviados / total) * 100) : 100;
    return {
      naoEnviados,
      errosPersistentes,
      rejeitados,
      taxaSucesso7d: taxa,
    };
  }, [query.data]);

  return {
    data: query.data ?? [],
    kpis,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
