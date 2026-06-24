import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/admin/access-logs")({
  component: AccessLogsPage,
});

type AccessLog = {
  id: string;
  user_id: string | null;
  email: string | null;
  nome: string | null;
  tipo_usuario: string | null;
  evento: string;
  descricao: string | null;
  cliente_id: string | null;
  ator_id: string | null;
  ator_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  portal_criado: { label: "Portal criado", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  portal_reativado: { label: "Portal reativado", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  portal_senha_resetada: { label: "Senha redefinida", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  portal_email_atualizado: { label: "E-mail alterado", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  portal_desativado: { label: "Portal desativado", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  usuario_criado: { label: "Usuário criado", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  usuario_ativado: { label: "Usuário ativado", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  usuario_desativado: { label: "Usuário desativado", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  usuario_excluido: { label: "Usuário excluído", color: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const TIPO_LABELS: Record<string, string> = {
  master: "Master",
  admin: "Admin",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

function AccessLogsPage() {
  const init = useAuth((s) => s.init);
  const session = useAuth((s) => s.session);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [eventoFilter, setEventoFilter] = useState<string>("todos");

  useEffect(() => {
    init();
  }, [init]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["access-logs"],
    enabled: !!session && isAdminOrMaster(),
    queryFn: async (): Promise<AccessLog[]> => {
      const { data, error } = await supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AccessLog[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((log) => {
      if (tipoFilter !== "todos" && log.tipo_usuario !== tipoFilter) return false;
      if (eventoFilter !== "todos" && log.evento !== eventoFilter) return false;
      if (!q) return true;
      return (
        (log.email ?? "").toLowerCase().includes(q) ||
        (log.nome ?? "").toLowerCase().includes(q) ||
        (log.descricao ?? "").toLowerCase().includes(q) ||
        (log.ator_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, tipoFilter, eventoFilter]);

  if (session && !isAdminOrMaster()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-text-secondary">
        Você não tem permissão para visualizar os logs de acesso.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-surface"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <ShieldCheck className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-text-primary">Gestão de Acessos</h1>
              <p className="text-sm text-text-secondary">
                Histórico de logins e eventos de criação/alteração de acessos
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por e-mail, nome ou descrição..."
              className="w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-3 text-sm outline-none focus:border-gold/50"
            />
          </div>
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold/50"
          >
            <option value="todos">Todos os tipos</option>
            <option value="master">Master</option>
            <option value="admin">Admin</option>
            <option value="vendedor">Vendedor</option>
            <option value="cliente">Cliente</option>
          </select>
          <select
            value={eventoFilter}
            onChange={(e) => setEventoFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold/50"
          >
            <option value="todos">Todos os eventos</option>
            {Object.entries(EVENT_LABELS).map(([key, v]) => (
              <option key={key} value={key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Quando</th>
                  <th className="px-4 py-3 text-left font-medium">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Evento</th>
                  <th className="px-4 py-3 text-left font-medium">Descrição</th>
                  <th className="px-4 py-3 text-left font-medium">Executado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      Carregando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => {
                    const ev = EVENT_LABELS[log.evento] ?? {
                      label: log.evento,
                      color: "bg-surface text-text-secondary border-border",
                    };
                    return (
                      <tr key={log.id} className="hover:bg-background/30">
                        <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-text-primary">
                            {log.nome ?? "—"}
                          </div>
                          <div className="text-xs text-text-secondary">{log.email ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {log.tipo_usuario ? TIPO_LABELS[log.tipo_usuario] ?? log.tipo_usuario : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${ev.color}`}
                          >
                            {ev.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {log.descricao ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {log.ator_email ?? (log.ator_id ? log.ator_id.slice(0, 8) : "Sistema")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-3 text-xs text-text-secondary">
          Exibindo os últimos {filtered.length} de {data?.length ?? 0} registros (limite de 500).
        </p>
      </div>
    </div>
  );
}
