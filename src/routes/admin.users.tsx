import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2, UserPlus, Power, Search } from "lucide-react";
import { useAuth, type AppRole, type TipoVendedor } from "@/store/authStore";
import {
  createAppUser,
  listAppUsers,
  setUserAtivo,
  deleteAppUser,
} from "@/lib/users.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const REGIOES = [
  "SP Capital",
  "SP Interior",
  "Sul",
  "Nordeste",
  "Centro-Oeste",
  "Norte",
  "RJ",
  "MG",
  "Outro",
];

function slugifyPreview(nome: string, tipo: TipoVendedor): string {
  const partes = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "";
  const primeiro = partes[0];
  const ultimaInicial = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return `${tipo === "representante" ? "rep" : "int"}.${primeiro}${ultimaInicial}`;
}

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
    password: "Fetely@2025",
    nome_completo: "",
    telefone: "",
    codigo_vendedor: "",
    role: "vendedor" as AppRole,
    tipo_vendedor: "interno" as TipoVendedor,
    regiao: "SP Capital",
    comissao_percent: "",
    cargo: "",
    supervisor: "",
    cnpj_cpf: "",
    empresa: "",
    observacoes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [credModal, setCredModal] = useState<{
    login: string | null;
    email: string;
    senha: string;
  } | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoVendedor | "inativos">(
    "todos",
  );

  const loginPreview = useMemo(
    () => slugifyPreview(form.nome_completo, form.tipo_vendedor),
    [form.nome_completo, form.tipo_vendedor],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const isVendedor = form.role === "vendedor";
      const isRep = isVendedor && form.tipo_vendedor === "representante";
      const result = await createMut.mutateAsync({
        email: form.email.trim(),
        password: form.password,
        nome_completo: form.nome_completo.trim(),
        telefone: form.telefone.trim() || null,
        codigo_vendedor: form.codigo_vendedor.trim() || null,
        role: form.role,
        tipo_vendedor: isVendedor ? form.tipo_vendedor : null,
        regiao: isVendedor ? form.regiao : null,
        comissao_percent: isRep && form.comissao_percent
          ? Number(form.comissao_percent.replace(",", "."))
          : null,
        cargo: isVendedor && !isRep ? form.cargo.trim() || null : null,
        supervisor: isVendedor && !isRep ? form.supervisor.trim() || null : null,
        cnpj_cpf: isRep ? form.cnpj_cpf.trim() || null : null,
        empresa: isRep ? form.empresa.trim() || null : null,
        observacoes: isRep ? form.observacoes.trim() || null : null,
      });
      setCredModal({
        login: result.login_amigavel,
        email: form.email.trim(),
        senha: form.password,
      });
      setForm({
        ...form,
        email: "",
        password: "Fetely@2025",
        nome_completo: "",
        telefone: "",
        codigo_vendedor: "",
        comissao_percent: "",
        cargo: "",
        supervisor: "",
        cnpj_cpf: "",
        empresa: "",
        observacoes: "",
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar usuário");
    }
  };

  const filtered = useMemo(() => {
    const list = usersQ.data ?? [];
    const q = busca.trim().toLowerCase();
    return list.filter((u) => {
      if (filtroTipo === "inativos" && u.ativo) return false;
      if (filtroTipo === "interno" && u.tipo_vendedor !== "interno") return false;
      if (filtroTipo === "representante" && u.tipo_vendedor !== "representante")
        return false;
      if (!q) return true;
      return (
        (u.nome_completo ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.login_amigavel ?? "").toLowerCase().includes(q) ||
        (u.regiao ?? "").toLowerCase().includes(q)
      );
    });
  }, [usersQ.data, busca, filtroTipo]);

  if (loading || !session || !isAdminOrMaster()) {
    return (
      <div className="px-6 py-10 text-text-secondary text-sm">Carregando...</div>
    );
  }

  const isVendedor = form.role === "vendedor";
  const isRep = isVendedor && form.tipo_vendedor === "representante";

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-8 space-y-8 pb-24 md:pb-8">
      <div>
        <h1 className="font-display text-2xl text-text-primary">
          Gestão de vendedores e usuários
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Cadastre vendedores internos, representantes e administradores.
        </p>
      </div>

      {/* Create form */}
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-surface p-6 space-y-6"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-gold" />
          <h2 className="font-display text-lg">Novo usuário</h2>
        </div>

        <section className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
            Dados gerais
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Nome completo"
              value={form.nome_completo}
              onChange={(v) => setForm({ ...form, nome_completo: v })}
              required
            />
            <Field
              label="Email (credencial de login)"
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
              label="Código do vendedor (ERP)"
              value={form.codigo_vendedor}
              onChange={(v) => setForm({ ...form, codigo_vendedor: v })}
            />
            <Field
              label="Senha inicial (mín. 8)"
              type="text"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              required
            />
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                Perfil
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
        </section>

        {isVendedor && (
          <section className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
              Dados do vendedor
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                  Tipo *
                </label>
                <div className="flex gap-2">
                  {(["interno", "representante"] as TipoVendedor[]).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setForm({ ...form, tipo_vendedor: t })}
                      className={`flex-1 rounded-md border px-3 py-2 text-xs uppercase tracking-wider transition ${
                        form.tipo_vendedor === t
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border bg-background text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {t === "interno" ? "Interno" : "Representante"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                  Região *
                </label>
                <select
                  value={form.regiao}
                  onChange={(e) => setForm({ ...form, regiao: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
                >
                  {REGIOES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>

              {!isRep && (
                <>
                  <Field
                    label="Cargo"
                    value={form.cargo}
                    onChange={(v) => setForm({ ...form, cargo: v })}
                  />
                  <Field
                    label="Supervisor"
                    value={form.supervisor}
                    onChange={(v) => setForm({ ...form, supervisor: v })}
                  />
                </>
              )}

              {isRep && (
                <>
                  <Field
                    label="CNPJ / CPF"
                    value={form.cnpj_cpf}
                    onChange={(v) => setForm({ ...form, cnpj_cpf: v })}
                  />
                  <Field
                    label="Empresa / Escritório"
                    value={form.empresa}
                    onChange={(v) => setForm({ ...form, empresa: v })}
                  />
                  <Field
                    label="Comissão (%) *"
                    value={form.comissao_percent}
                    onChange={(v) =>
                      setForm({ ...form, comissao_percent: v })
                    }
                    placeholder="ex: 3.5"
                  />
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                      Observações
                    </label>
                    <textarea
                      value={form.observacoes}
                      onChange={(e) =>
                        setForm({ ...form, observacoes: e.target.value })
                      }
                      rows={3}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-text-secondary">
              <span className="text-gold-muted uppercase tracking-wider text-[10px]">
                Login amigável:{" "}
              </span>
              <span className="text-gold font-mono">
                {loginPreview || "(digite o nome)"}
              </span>
              <span className="text-text-secondary/70 ml-2">
                — gerado automaticamente
              </span>
            </div>
          </section>
        )}

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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["todos", "Todos"],
              ["interno", "Internos"],
              ["representante", "Representantes"],
              ["inativos", "Inativos"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFiltroTipo(k)}
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider transition ${
                filtroTipo === k
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, login, email, região..."
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      {/* List - Desktop */}
      <div className="hidden md:block rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-text-secondary text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Região</th>
              <th className="text-left px-4 py-3">Login</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Comissão</th>
              <th className="text-left px-4 py-3">Papel</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 text-text-primary">
                  {u.nome_completo ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <TipoBadge tipo={u.tipo_vendedor} />
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {u.regiao ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-gold text-xs">
                  {u.login_amigavel ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary text-xs">
                  {u.email}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {u.comissao_percent != null
                    ? `${u.comissao_percent}%`
                    : "—"}
                </td>
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
                        if (confirm(`Excluir ${u.email}?`))
                          deleteMut.mutate(u.id);
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
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-text-secondary"
                >
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* List - Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="rounded-lg border border-border bg-surface p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-text-primary font-medium">
                  {u.nome_completo ?? "—"}
                </div>
                <div className="text-xs text-text-secondary">{u.email}</div>
              </div>
              <TipoBadge tipo={u.tipo_vendedor} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {u.login_amigavel && (
                <span className="font-mono text-gold">{u.login_amigavel}</span>
              )}
              {u.regiao && (
                <span className="text-text-secondary">{u.regiao}</span>
              )}
              {u.comissao_percent != null && (
                <span className="text-text-secondary">
                  Comissão {u.comissao_percent}%
                </span>
              )}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex gap-1">
                {u.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold"
                  >
                    {r}
                  </span>
                ))}
                <span
                  className={`ml-2 text-[10px] uppercase tracking-wider ${u.ativo ? "text-stock-in" : "text-text-secondary"}`}
                >
                  {u.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    toggleMut.mutate({ user_id: u.id, ativo: !u.ativo })
                  }
                  className="text-text-secondary hover:text-gold p-1"
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Excluir ${u.email}?`)) deleteMut.mutate(u.id);
                  }}
                  className="text-text-secondary hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-text-secondary text-sm py-8">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {credModal && (
        <CredentialsModal
          login={credModal.login}
          email={credModal.email}
          senha={credModal.senha}
          onClose={() => setCredModal(null)}
        />
      )}
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: TipoVendedor | null }) {
  if (!tipo) return <span className="text-text-secondary text-xs">—</span>;
  const isRep = tipo === "representante";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
        isRep
          ? "bg-gold/15 text-gold border border-gold/30"
          : "bg-surface-hover text-text-secondary border border-border"
      }`}
    >
      {isRep ? "Rep" : "Interno"}
    </span>
  );
}

function CredentialsModal({
  login,
  email,
  senha,
  onClose,
}: {
  login: string | null;
  email: string;
  senha: string;
  onClose: () => void;
}) {
  const texto = `*Fetély B2B Orders — Acesso criado*
${login ? `Login amigável: ${login}\n` : ""}Email: ${email}
Senha: ${senha}
Acesse: ${typeof window !== "undefined" ? window.location.origin : ""}
*Troque sua senha no primeiro acesso.*`;
  const copy = () => {
    navigator.clipboard.writeText(texto);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg border border-gold/40 bg-surface p-6 space-y-4">
        <h3 className="font-display text-lg text-gold">
          ✦ Usuário criado com sucesso
        </h3>
        <div className="space-y-2 text-sm">
          {login && (
            <Row label="Login amigável" value={login} mono />
          )}
          <Row label="Email" value={email} mono />
          <Row label="Senha" value={senha} mono />
        </div>
        <p className="text-xs text-text-secondary">
          Repasse estas credenciais ao vendedor. Recomende que ele altere a
          senha no primeiro acesso.
        </p>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-xs uppercase tracking-wider text-gold hover:bg-gold/20"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar credenciais
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 rounded-md bg-background/60 px-3 py-2 border border-border">
      <span className="text-[10px] uppercase tracking-wider text-text-secondary self-center">
        {label}
      </span>
      <span
        className={`text-text-primary ${mono ? "font-mono text-xs" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
      />
    </div>
  );
}
