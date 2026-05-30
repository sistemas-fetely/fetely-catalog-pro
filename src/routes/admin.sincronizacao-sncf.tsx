import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/store/authStore";
import { supabase } from "@/integrations/supabase/client";
import { SyncKpiCards } from "@/components/sync/SyncKpiCards";
import { SyncFiltersBar, type SyncFilters } from "@/components/sync/SyncFilters";
import { SyncTable } from "@/components/sync/SyncTable";
import { RetryBatchButton } from "@/components/sync/RetryBatchButton";
import { useSyncManagement } from "@/hooks/useSyncManagement";

export const Route = createFileRoute("/admin/sincronizacao-sncf")({
  head: () => ({
    meta: [{ title: "Sincronização SNCF — Fetély B2B" }],
  }),
  component: AdminSincronizacaoSncfPage,
});

function AdminSincronizacaoSncfPage() {
  const navigate = useNavigate();
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!isAdminOrMaster()) navigate({ to: "/catalog" });
  }, [loading, session, isAdminOrMaster, navigate]);

  const [filters, setFilters] = useState<SyncFilters>({
    statuses: ["nao_enviado", "pendente", "rejeitado", "erro_persistente"],
    vendedorId: null,
    periodo: "7d",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows, kpis, isLoading, refetch } = useSyncManagement(filters);

  // Vendedores: pega quem tem role vendedor/admin/master via user_roles
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-list-sync"],
    queryFn: async () => {
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["vendedor", "admin", "master"]);
      if (rErr) throw rErr;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, nome_completo, email, ativo")
        .in("id", ids)
        .eq("ativo", true)
        .order("nome_completo");
      if (pErr) throw pErr;
      return (profs ?? []).map((p) => ({
        id: p.id,
        nome: p.nome_completo ?? p.email ?? p.id,
      }));
    },
    enabled: !!session && isAdminOrMaster(),
    staleTime: 60_000,
  });

  if (loading || !session || !isAdminOrMaster()) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-text-secondary text-sm">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-12 space-y-6">
      <header className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold">
          Saúde da integração FOP → SNCF
        </p>
        <h1 className="font-display text-3xl text-text-primary">
          Sincronização SNCF · Gestão SOps
        </h1>
        <p className="text-xs text-text-secondary">
          Polling automático a cada 60s · {rows.length} pedido{rows.length === 1 ? "" : "s"} no resultset
        </p>
      </header>

      <SyncKpiCards kpis={kpis} />

      <div className="flex flex-col gap-3">
        <SyncFiltersBar
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setSelected(new Set());
          }}
          vendedores={vendedores}
          onRefresh={() => refetch()}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-text-secondary">
            {isLoading ? "Carregando…" : `${selected.size} selecionado${selected.size === 1 ? "" : "s"}`}
          </p>
          <RetryBatchButton
            selectedIds={selected}
            onComplete={() => setSelected(new Set())}
          />
        </div>
      </div>

      <SyncTable
        rows={rows}
        selected={selected}
        onSelectedChange={setSelected}
      />
    </main>
  );
}
