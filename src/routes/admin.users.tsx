import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Power } from "lucide-react";
import { useAuth, type AppRole } from "@/store/authStore";
import {
  createAppUser,
  listAppUsers,
  setUserAtivo,
  deleteAppUser,
} from "@/lib/users.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const navigate = useNavigate();
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);
  const isMaster = useAuth((s) => s.isMaster);

  const listFn = useServerFn(listAppUsers);
  const createFn = useServerFn(createAppUser);
  const toggleFn = useServerFn(setUserAtivo);
  const deleteFn = useServerFn(deleteAppUser);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!isAdminOrMaster()) navigate({ to: "/catalog" });
  }, [loading, session, isAdminOrMaster, navigate]);

  const qc = useQueryClient();
  const usersQ = useQuery({
    queryKey: ["app-users"],
    queryFn: () => listFn(),
    enabled: !!session && isAdminOrMaster(),
  });

  const createMut = useMutation({
    mutationFn: (input: Parameters<typeof createFn>[0]["data"]) =>
      createFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-users"] }),
  });

  const toggleMut = useMutation({
    mutationFn: (input: { user_id: string; ativo: boolean }) =>
      toggleFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-users"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-users"] }),
  });

  const [form, setForm] = useState({
    email: "",
    password: "",
    nome_completo: "",
    telefone: "",
    codigo_vendedor: "",
    role: "vendedor" as AppRole,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await createMut.mutateAsync({
        email: form.email.trim(),
        password: form.password,
        nome_completo: form.nome_completo.trim(),
        telefone: form.telefone.trim() || null,
        codigo_vendedor: form.codigo_vendedor.trim() || null,
        role: form.role,
      });
      setForm({
        email: "",
        password: "",
        nome_completo: "",
        telefone: "",
        codigo_vendedor: "",
        role: "vendedor",
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar usuário");
    }
  };

  if (loading || !session || !isAdminOrMaster()) {
    return (
      <div className="px-6 py-10 text-text-secondary text-sm">Carregando...</div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl text-text-primary">
          Gestão de usuários
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Cadastre vendedores e administradores do sistema.
        </p>
      </div>

      {/* Create form */}
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-surface p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-gold" />
          <h2 className="font-display text-lg">Novo usuário</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Nome completo"
            value={form.nome_completo}
            onChange={(v) => setForm({ ...form, nome_completo: v })}
            required
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            required
          />
          <Field
            label="Telefone / WhatsApp"
            value={form.telefone}
            onChange={(v) => setForm({ ...form, telefone: v })}
          />
          <Field
            label="Código do vendedor"
            value={form.codigo_vendedor}
            onChange={(v) => setForm({ ...form, codigo_vendedor: v })}
          />
          <Field
            label="Senha (mín. 8)"
            type="password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            required
          />
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
              Papel
            </label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as AppRole })
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
            >
              <option value="vendedor">Vendedor</option>
              {isMaster() && <option value="admin">Administrador</option>}
              {isMaster() && <option value="master">Master</option>}
            </select>
          </div>
        </div>

        {formError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={createMut.isPending}
          className="rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light disabled:opacity-60"
        >
          {createMut.isPending ? "Criando..." : "Criar usuário"}
        </button>
      </form>

      {/* List */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-text-secondary text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Telefone</th>
              <th className="text-left px-4 py-3">Papel</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usersQ.data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3">{u.nome_completo ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                <td className="px-4 py-3">{u.codigo_vendedor ?? "—"}</td>
                <td className="px-4 py-3">{u.telefone ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] uppercase tracking-wider ${u.ativo ? "text-stock-in" : "text-text-secondary"}`}
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        toggleMut.mutate({ user_id: u.id, ativo: !u.ativo })
                      }
                      className="text-text-secondary hover:text-gold p-1"
                      title={u.ativo ? "Desativar" : "Ativar"}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir ${u.email}?`)) deleteMut.mutate(u.id);
                      }}
                      className="text-text-secondary hover:text-destructive p-1"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {usersQ.data?.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-text-secondary"
                >
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
      />
    </div>
  );
}
