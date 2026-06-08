import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Minus, Plus, Trash2, Users as UsersIcon, Search, Shield, Star, ShoppingBag, Briefcase, ChevronLeft } from "lucide-react";
import { useAuth } from "@/store/authStore";
import { listAppUsers } from "@/lib/users.functions";
import {
  carregarPermissoes,
  setPermissaoPerfil,
  setPermissaoGrupo,
  criarGrupo,
  excluirGrupo,
  setExcecaoUsuario,
  removerExcecaoUsuario,
  setGrupoUsuario,
} from "@/lib/permissoes.functions";
import {
  TELAS_SISTEMA,
  GRUPOS_TELAS,
  TODAS_ACOES,
  PERMISSOES_PADRAO,
  perfilBaseConcede,
  acaoAplicavel,
  type AcaoPermissao,
  type PerfilBaseRole,
} from "@/security/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/permissoes")({
  component: PermissoesPage,
});

type Selecao =
  | { tipo: "perfil"; perfil: PerfilBaseRole }
  | { tipo: "grupo"; grupoId: string }
  | { tipo: "usuario"; userId: string };

const PERFIS_INFO: { perfil: PerfilBaseRole; icone: React.ElementType; cor: string }[] = [
  { perfil: "admin", icone: Shield, cor: "text-red-400" },
  { perfil: "master", icone: Star, cor: "text-amber-400" },
  { perfil: "vendedor", icone: Briefcase, cor: "text-blue-400" },
  { perfil: "cliente", icone: ShoppingBag, cor: "text-emerald-400" },
];

function PermissoesPage() {
  const navigate = useNavigate();
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!isAdminOrMaster()) navigate({ to: "/catalog" });
  }, [loading, session, isAdminOrMaster, navigate]);

  const qc = useQueryClient();
  const carregarFn = useServerFn(carregarPermissoes);
  const listUsersFn = useServerFn(listAppUsers);
  const setPerfilFn = useServerFn(setPermissaoPerfil);
  const setGrupoFn = useServerFn(setPermissaoGrupo);
  const criarGrupoFn = useServerFn(criarGrupo);
  const excluirGrupoFn = useServerFn(excluirGrupo);
  const setExcecaoFn = useServerFn(setExcecaoUsuario);
  const removerExcecaoFn = useServerFn(removerExcecaoUsuario);
  const setGrupoUsuarioFn = useServerFn(setGrupoUsuario);

  const permsQ = useQuery({
    queryKey: ["permissoes"],
    queryFn: () => carregarFn(),
    enabled: !!session && isAdminOrMaster(),
  });

  const usersQ = useQuery({
    queryKey: ["app-users"],
    queryFn: () => listUsersFn(),
    enabled: !!session && isAdminOrMaster(),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["permissoes"] });
    qc.invalidateQueries({ queryKey: ["app-users"] });
  };

  const [selecao, setSelecao] = useState<Selecao>({ tipo: "perfil", perfil: "admin" });
  const [filtroTela, setFiltroTela] = useState("");
  const [novoGrupoAberto, setNovoGrupoAberto] = useState(false);
  const [excecaoAberta, setExcecaoAberta] = useState(false);

  // Mutations
  const mutPerfil = useMutation({
    mutationFn: (v: {
      perfil: PerfilBaseRole;
      tela_id: string;
      acao: AcaoPermissao;
      permitido: boolean;
      permitido_padrao: boolean;
    }) => setPerfilFn({ data: v }),
    onSuccess: invalidar,
  });
  const mutGrupo = useMutation({
    mutationFn: (v: {
      grupo_id: string;
      grupo_nome: string;
      tela_id: string;
      acao: AcaoPermissao;
      permitido: boolean;
      permitido_base: boolean;
    }) => setGrupoFn({ data: v }),
    onSuccess: invalidar,
  });
  const mutCriarGrupo = useMutation({
    mutationFn: (v: {
      nome: string;
      descricao: string | null;
      baseado_em: PerfilBaseRole;
      copiar_de_grupo_id: string | null;
    }) => criarGrupoFn({ data: v }),
    onSuccess: (g) => {
      invalidar();
      setSelecao({ tipo: "grupo", grupoId: g.id });
      setNovoGrupoAberto(false);
    },
  });
  const mutExcluirGrupo = useMutation({
    mutationFn: (id: string) => excluirGrupoFn({ data: { id } }),
    onSuccess: () => {
      invalidar();
      setSelecao({ tipo: "perfil", perfil: "vendedor" });
    },
  });
  const mutExcecao = useMutation({
    mutationFn: (v: {
      user_id: string;
      user_nome: string;
      tela_id: string;
      acao: AcaoPermissao;
      permitido: boolean;
      permitido_atual: boolean;
    }) => setExcecaoFn({ data: v }),
    onSuccess: invalidar,
  });
  const mutRemoverExcecao = useMutation({
    mutationFn: (v: { user_id: string; tela_id: string; acao: AcaoPermissao }) =>
      removerExcecaoFn({ data: v }),
    onSuccess: invalidar,
  });
  const mutGrupoUsuario = useMutation({
    mutationFn: (v: { user_id: string; grupo_id: string | null }) =>
      setGrupoUsuarioFn({ data: v }),
    onSuccess: invalidar,
  });


  const grupos = permsQ.data?.grupos ?? [];
  const perfisOverride = permsQ.data?.perfisOverride ?? [];
  const grupoOverrides = permsQ.data?.grupoOverrides ?? [];
  const excecoes = permsQ.data?.excecoes ?? [];
  const usuarios = usersQ.data ?? [];

  const usuariosPorGrupo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of usuarios) {
      const g = (u as { grupo_permissao_id?: string | null }).grupo_permissao_id;
      if (g) map[g] = (map[g] ?? 0) + 1;
    }
    return map;
  }, [usuarios]);

  // ============ Calcular permissão efetiva da seleção atual ============
  const matriz = useMemo(() => {
    const telasFiltradas = TELAS_SISTEMA.filter((t) =>
      filtroTela
        ? t.nome.toLowerCase().includes(filtroTela.toLowerCase()) ||
          t.grupo.toLowerCase().includes(filtroTela.toLowerCase())
        : true,
    );

    function permissaoCalculada(telaId: string, acao: AcaoPermissao) {
      if (selecao.tipo === "perfil") {
        const ov = perfisOverride.find(
          (p) => p.perfil === selecao.perfil && p.tela_id === telaId && p.acao === acao,
        );
        const padrao = perfilBaseConcede(selecao.perfil, telaId, acao);
        return {
          permitido: ov ? ov.permitido : padrao,
          padrao,
          custom: !!ov,
          origem: ov ? "override" : "padrão",
        };
      }
      if (selecao.tipo === "grupo") {
        const grupo = grupos.find((g) => g.id === selecao.grupoId);
        if (!grupo) return { permitido: false, padrao: false, custom: false, origem: "—" };
        const perfilBase = grupo.baseado_em as PerfilBaseRole;
        const baseOv = perfisOverride.find(
          (p) => p.perfil === perfilBase && p.tela_id === telaId && p.acao === acao,
        );
        const base = baseOv ? baseOv.permitido : perfilBaseConcede(perfilBase, telaId, acao);
        const ov = grupoOverrides.find(
          (o) => o.grupo_id === selecao.grupoId && o.tela_id === telaId && o.acao === acao,
        );
        return {
          permitido: ov ? ov.permitido : base,
          padrao: base,
          custom: !!ov,
          origem: ov ? "grupo" : "perfil base",
        };
      }
      // usuário
      const u = usuarios.find((x) => x.id === selecao.userId);
      if (!u) return { permitido: false, padrao: false, custom: false, origem: "—" };
      const perfilBase = (u.roles?.[0] ?? "vendedor") as PerfilBaseRole;
      const baseOv = perfisOverride.find(
        (p) => p.perfil === perfilBase && p.tela_id === telaId && p.acao === acao,
      );
      let efetivo = baseOv ? baseOv.permitido : perfilBaseConcede(perfilBase, telaId, acao);
      let origem: string = "perfil base";
      const grupoId = (u as { grupo_permissao_id?: string | null }).grupo_permissao_id;
      if (grupoId) {
        const ov = grupoOverrides.find(
          (o) => o.grupo_id === grupoId && o.tela_id === telaId && o.acao === acao,
        );
        if (ov) {
          efetivo = ov.permitido;
          origem = "grupo";
        }
      }
      const exc = excecoes.find(
        (e) => e.user_id === selecao.userId && e.tela_id === telaId && e.acao === acao,
      );
      if (exc) {
        return { permitido: exc.permitido, padrao: efetivo, custom: true, origem: "exceção" };
      }
      return { permitido: efetivo, padrao: efetivo, custom: false, origem };
    }

    return { telas: telasFiltradas, permissao: permissaoCalculada };
  }, [selecao, perfisOverride, grupos, grupoOverrides, excecoes, usuarios, filtroTela]);

  const handleToggle = (telaId: string, acao: AcaoPermissao, atual: boolean, padrao: boolean) => {
    const novoValor = !atual;
    if (selecao.tipo === "perfil") {
      if (selecao.perfil === "admin") return; // admin nunca muda
      mutPerfil.mutate({
        perfil: selecao.perfil,
        tela_id: telaId,
        acao,
        permitido: novoValor,
        permitido_padrao: padrao,
      });
    } else if (selecao.tipo === "grupo") {
      const grupo = grupos.find((g) => g.id === selecao.grupoId);
      if (!grupo) return;
      mutGrupo.mutate({
        grupo_id: grupo.id,
        grupo_nome: grupo.nome,
        tela_id: telaId,
        acao,
        permitido: novoValor,
        permitido_base: padrao,
      });
    } else {
      const u = usuarios.find((x) => x.id === selecao.userId);
      if (!u) return;
      mutExcecao.mutate({
        user_id: u.id,
        user_nome: u.nome_completo ?? u.email,
        tela_id: telaId,
        acao,
        permitido: novoValor,
        permitido_atual: atual,
      });
    }
  };

  if (loading || permsQ.isLoading) {
    return <div className="p-8 text-text-secondary">Carregando…</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/settings" })}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <div>
              <h1 className="font-display text-2xl text-text-primary">Gestor de Permissões</h1>
              <p className="text-sm text-text-secondary">
                Configure acessos por perfil base, grupo customizado ou usuário individual
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* PAINEL ESQUERDO */}
          <aside className="space-y-4">
            <SectionCard title="Perfis base">
              {PERFIS_INFO.map(({ perfil, icone: Icon, cor }) => (
                <button
                  key={perfil}
                  onClick={() => setSelecao({ tipo: "perfil", perfil })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                    selecao.tipo === "perfil" && selecao.perfil === perfil
                      ? "bg-gold/15 text-text-primary"
                      : "text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  <Icon className={cn("h-4 w-4", cor)} />
                  <span className="capitalize">{perfil}</span>
                </button>
              ))}
            </SectionCard>

            <SectionCard
              title="Grupos customizados"
              action={
                <Button size="sm" variant="ghost" onClick={() => setNovoGrupoAberto(true)}>
                  <Plus className="h-3 w-3" /> Novo
                </Button>
              }
            >
              {grupos.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-secondary">
                  Nenhum grupo criado ainda.
                </p>
              ) : (
                grupos.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelecao({ tipo: "grupo", grupoId: g.id })}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                      selecao.tipo === "grupo" && selecao.grupoId === g.id
                        ? "bg-gold/15 text-text-primary"
                        : "text-text-secondary hover:bg-surface-hover",
                    )}
                  >
                    <span className="truncate">{g.nome}</span>
                    <span className="flex items-center gap-1 text-xs text-text-secondary">
                      <UsersIcon className="h-3 w-3" />
                      {usuariosPorGrupo[g.id] ?? 0}
                    </span>
                  </button>
                ))
              )}
            </SectionCard>

            <SectionCard title="Usuários">
              <div className="max-h-[300px] overflow-y-auto">
                {usuarios.slice(0, 100).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelecao({ tipo: "usuario", userId: u.id })}
                    className={cn(
                      "block w-full rounded-md px-3 py-2 text-left text-sm transition",
                      selecao.tipo === "usuario" && selecao.userId === u.id
                        ? "bg-gold/15 text-text-primary"
                        : "text-text-secondary hover:bg-surface-hover",
                    )}
                  >
                    <div className="truncate font-medium">
                      {u.login_amigavel ?? u.nome_completo ?? u.email}
                    </div>
                    <div className="truncate text-xs text-text-secondary">{u.email}</div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </aside>

          {/* PAINEL DIREITO — MATRIZ */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <SelecaoHeader
              selecao={selecao}
              grupos={grupos}
              usuarios={usuarios}
              onExcluirGrupo={(id) => {
                if (confirm("Excluir este grupo? Usuários vinculados ficam sem grupo.")) {
                  mutExcluirGrupo.mutate(id);
                }
              }}
              onTrocarGrupo={(userId, grupoId) =>
                mutGrupoUsuario.mutate({ user_id: userId, grupo_id: grupoId })
              }
              onAddExcecao={() => setExcecaoAberta(true)}
            />

            <div className="my-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <Input
                  placeholder="Buscar tela..."
                  value={filtroTela}
                  onChange={(e) => setFiltroTela(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="sticky left-0 bg-surface px-3 py-2 text-left">Tela</th>
                    {TODAS_ACOES.map((a) => (
                      <th key={a} className="px-2 py-2 text-center capitalize">
                        {a}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right text-[10px] uppercase">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {GRUPOS_TELAS.map((grupoNome) => {
                    const telasDoGrupo = matriz.telas.filter((t) => t.grupo === grupoNome);
                    if (telasDoGrupo.length === 0) return null;
                    return (
                      <>
                        <tr key={`g-${grupoNome}`} className="bg-background/40">
                          <td
                            colSpan={TODAS_ACOES.length + 2}
                            className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gold"
                          >
                            {grupoNome}
                          </td>
                        </tr>
                        {telasDoGrupo.map((tela) => {
                          let linhaCustom = false;
                          let origemLinha = "";
                          return (
                            <tr
                              key={tela.id}
                              className="border-b border-border/40 hover:bg-surface-hover/40"
                            >
                              <td className="sticky left-0 bg-surface px-3 py-2 text-text-primary">
                                {tela.nome}
                              </td>
                              {TODAS_ACOES.map((acao) => {
                                if (!acaoAplicavel(tela.id, acao)) {
                                  return (
                                    <td key={acao} className="px-2 py-2 text-center text-text-secondary">
                                      <Minus className="mx-auto h-3 w-3 opacity-30" />
                                    </td>
                                  );
                                }
                                const { permitido, padrao, custom, origem } =
                                  matriz.permissao(tela.id, acao);
                                if (custom) {
                                  linhaCustom = true;
                                  origemLinha = origem;
                                }
                                const disabled =
                                  selecao.tipo === "perfil" && selecao.perfil === "admin";
                                return (
                                  <td key={acao} className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() =>
                                        handleToggle(tela.id, acao, permitido, padrao)
                                      }
                                      className={cn(
                                        "inline-flex h-6 w-6 items-center justify-center rounded transition",
                                        permitido
                                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                          : "bg-red-500/15 text-red-400 hover:bg-red-500/25",
                                        custom && "ring-1 ring-gold",
                                        disabled && "cursor-not-allowed opacity-60",
                                      )}
                                      title={`${origem}${custom ? " (customizado)" : ""}`}
                                    >
                                      {permitido ? (
                                        <Check className="h-3 w-3" />
                                      ) : (
                                        <X className="h-3 w-3" />
                                      )}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="px-2 py-2 text-right text-[10px] text-text-secondary">
                                {linhaCustom ? (
                                  <span className="text-gold">{origemLinha}</span>
                                ) : (
                                  ""
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selecao.tipo === "usuario" && excecoes.filter((e) => e.user_id === selecao.userId).length > 0 && (
              <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">
                  Exceções individuais
                </div>
                <div className="space-y-1">
                  {excecoes
                    .filter((e) => e.user_id === selecao.userId)
                    .map((e) => (
                      <div
                        key={`${e.tela_id}-${e.acao}`}
                        className="flex items-center justify-between rounded px-2 py-1 text-xs"
                      >
                        <span className="text-text-primary">
                          {TELAS_SISTEMA.find((t) => t.id === e.tela_id)?.nome ?? e.tela_id} ·{" "}
                          <span className="capitalize text-text-secondary">{e.acao}</span> ·{" "}
                          <span className={e.permitido ? "text-emerald-400" : "text-red-400"}>
                            {e.permitido ? "Concedido" : "Bloqueado"}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            mutRemoverExcecao.mutate({
                              user_id: e.user_id,
                              tela_id: e.tela_id,
                              acao: e.acao,
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <NovoGrupoDialog
        open={novoGrupoAberto}
        onOpenChange={setNovoGrupoAberto}
        grupos={grupos}
        onCriar={(input) => mutCriarGrupo.mutate(input)}
      />
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SelecaoHeader({
  selecao,
  grupos,
  usuarios,
  onExcluirGrupo,
  onTrocarGrupo,
  onAddExcecao,
}: {
  selecao: Selecao;
  grupos: Array<{ id: string; nome: string; baseado_em: string; descricao?: string | null }>;
  usuarios: Array<{
    id: string;
    nome_completo: string | null;
    email: string;
    login_amigavel: string | null;
    roles?: string[];
    grupo_permissao_id?: string | null;
  }>;
  onExcluirGrupo: (id: string) => void;
  onTrocarGrupo: (userId: string, grupoId: string | null) => void;
  onAddExcecao: () => void;
}) {
  if (selecao.tipo === "perfil") {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-text-secondary">Perfil base</div>
            <h2 className="font-display text-xl capitalize text-text-primary">{selecao.perfil}</h2>
          </div>
          {selecao.perfil === "admin" && (
            <span className="rounded-md bg-red-500/15 px-2 py-1 text-xs text-red-400">
              Admin sempre tem acesso total — não editável
            </span>
          )}
        </div>
      </div>
    );
  }
  if (selecao.tipo === "grupo") {
    const g = grupos.find((x) => x.id === selecao.grupoId);
    if (!g) return null;
    return (
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase text-text-secondary">
            Grupo (baseado em {g.baseado_em})
          </div>
          <h2 className="font-display text-xl text-text-primary">{g.nome}</h2>
          {g.descricao && (
            <p className="text-xs text-text-secondary">{g.descricao}</p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onExcluirGrupo(g.id)}>
          <Trash2 className="h-3 w-3" /> Excluir
        </Button>
      </div>
    );
  }
  const u = usuarios.find((x) => x.id === selecao.userId);
  if (!u) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[10px] uppercase text-text-secondary">
          Usuário · {u.roles?.join(", ") ?? "—"}
        </div>
        <h2 className="font-display text-xl text-text-primary">
          {u.nome_completo ?? u.email}
        </h2>
        <p className="text-xs text-text-secondary">{u.login_amigavel ?? u.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={u.grupo_permissao_id ?? "__none__"}
          onValueChange={(v) =>
            onTrocarGrupo(u.id, v === "__none__" ? null : v)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sem grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem grupo customizado</SelectItem>
            {grupos.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={onAddExcecao}>
          <Plus className="h-3 w-3" /> Exceção
        </Button>
      </div>
    </div>
  );
}

function NovoGrupoDialog({
  open,
  onOpenChange,
  grupos,
  onCriar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  grupos: Array<{ id: string; nome: string }>;
  onCriar: (input: {
    nome: string;
    descricao: string | null;
    baseado_em: PerfilBaseRole;
    copiar_de_grupo_id: string | null;
  }) => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [baseadoEm, setBaseadoEm] = useState<PerfilBaseRole>("vendedor");
  const [copiarDe, setCopiarDe] = useState<string>("__none__");

  useEffect(() => {
    if (!open) {
      setNome("");
      setDescricao("");
      setBaseadoEm("vendedor");
      setCopiarDe("__none__");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo grupo customizado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary">Nome *</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Vendedor Sênior" />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Descrição</label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Baseado em *</label>
              <Select value={baseadoEm} onValueChange={(v) => setBaseadoEm(v as PerfilBaseRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERMISSOES_PADRAO) as PerfilBaseRole[]).map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-text-secondary">Copiar permissões de</label>
              <Select value={copiarDe} onValueChange={setCopiarDe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (do zero)</SelectItem>
                  {grupos.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onCriar({
                nome: nome.trim(),
                descricao: descricao.trim() || null,
                baseado_em: baseadoEm,
                copiar_de_grupo_id: copiarDe === "__none__" ? null : copiarDe,
              })
            }
            disabled={!nome.trim()}
          >
            Criar grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
