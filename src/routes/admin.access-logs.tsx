import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, ShieldCheck, RefreshCw, ChevronRight, History } from "lucide-react";
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

const TIPO_COLOR: Record<string, string> = {
  master: "bg-gold/15 text-gold border-gold/30",
  admin: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  vendedor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  cliente: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

type UserRow = {
  user_id: string;
  nome: string;
  email: string;
  tipo: string | null;
  ultimo_acesso: string | null;
  total_logins: number;
  total_eventos: number;
  logs: AccessLog[];
};

function AccessLogsPage() {
  const init = useAuth((s) => s.init);
  const session = useAuth((s) => s.session);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

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
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as AccessLog[];
    },
  });

  const users: UserRow[] = useMemo(() => {
    const map = new Map<string, UserRow>();
    for (const log of data ?? []) {
      const key = log.user_id ?? log.email ?? "—";
      if (!key) continue;
      let row = map.get(key);
      if (!row) {
        row = {
          user_id: key,
          nome: log.nome ?? "—",
          email: log.email ?? "—",
          tipo: log.tipo_usuario,
          ultimo_acesso: null,
          total_logins: 0,
          total_eventos: 0,
          logs: [],
        };
        map.set(key, row);
      }
      row.logs.push(log);
      row.total_eventos += 1;
      if (log.evento === "login") {
        row.total_logins += 1;
        if (!row.ultimo_acesso || log.created_at > row.ultimo_acesso) {
          row.ultimo_acesso = log.created_at;
        }
      }
      if (log.nome && row.nome === "—") row.nome = log.nome;
      if (log.email && row.email === "—") row.email = log.email;
      if (log.tipo_usuario && !row.tipo) row.tipo = log.tipo_usuario;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.ultimo_acesso && b.ultimo_acesso) return b.ultimo_acesso.localeCompare(a.ultimo_acesso);
      if (a.ultimo_acesso) return -1;
      if (b.ultimo_acesso) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [data]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (tipoFilter !== "todos" && u.tipo !== tipoFilter) return false;
      if (!q) return true;
      return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, search, tipoFilter]);

  if (session && !isAdminOrMaster()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-text-secondary">
        Você não tem permissão para visualizar os logs de acesso.
      </div>
    );
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR") : "Nunca acessou";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
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
                Usuários do sistema e seu histórico de acesso
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

        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
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
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Último acesso</th>
                  <th className="px-4 py-3 text-center font-medium">Logins</th>
                  <th className="px-4 py-3 text-center font-medium">Eventos</th>
                  <th className="px-4 py-3 text-right font-medium">Histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      Carregando...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.user_id} className="hover:bg-background/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{u.nome}</div>
                        <div className="text-xs text-text-secondary">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.tipo ? (
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                              TIPO_COLOR[u.tipo] ?? "bg-surface text-text-secondary border-border"
                            }`}
                          >
                            {TIPO_LABELS[u.tipo] ?? u.tipo}
                          </span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {formatDate(u.ultimo_acesso)}
                      </td>
                      <td className="px-4 py-3 text-center text-text-primary">{u.total_logins}</td>
                      <td className="px-4 py-3 text-center text-text-secondary">
                        {u.total_eventos}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/40 px-2 py-1 text-xs hover:bg-surface-hover"
                        >
                          <History className="h-3.5 w-3.5" />
                          Ver
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-3 text-xs text-text-secondary">
          {filteredUsers.length} usuário(s) · {data?.length ?? 0} eventos registrados
        </p>
      </div>

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border p-5">
              <div>
                <h2 className="font-display text-xl text-text-primary">{selectedUser.nome}</h2>
                <p className="text-sm text-text-secondary">{selectedUser.email}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Último acesso: {formatDate(selectedUser.ultimo_acesso)} ·{" "}
                  {selectedUser.total_logins} login(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-hover"
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <ul className="space-y-3">
                {selectedUser.logs.map((log) => {
                  const ev = EVENT_LABELS[log.evento] ?? {
                    label: log.evento,
                    color: "bg-surface text-text-secondary border-border",
                  };
                  return (
                    <li
                      key={log.id}
                      className="rounded-lg border border-border bg-background/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${ev.color}`}
                        >
                          {ev.label}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {log.descricao && (
                        <p className="mt-2 text-sm text-text-secondary">{log.descricao}</p>
                      )}
                      {log.ator_email && (
                        <p className="mt-1 text-xs text-text-secondary">
                          Por: {log.ator_email}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
