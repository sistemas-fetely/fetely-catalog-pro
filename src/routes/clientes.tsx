import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Download, X, Edit2, Power } from "lucide-react";
import { toast } from "sonner";
import { useClientes, useVisibleClientes, calcClienteStats } from "@/store/clienteStore";
import { useAuth } from "@/store/authStore";
import { Can } from "@/components/security/Can";
import { ClienteFormModal } from "@/components/clientes/ClienteFormModal";
import {
  CANAL_LABEL,
  SEGMENTO_LABEL,
  UF_LIST,
  type Cliente,
  type CanalCliente,
  type SegmentoCliente,
  type SituacaoCadastral,
} from "@/types/cliente";
import { formatBRL } from "@/lib/format";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalAccessTab } from "@/components/clientes/PortalAccessTab";
import { PremissasComercialTab } from "@/components/clientes/PremissasComercialTab";
import { statusPremissas, diasParaExpirar, diffPremissas } from "@/lib/premissas";
import { GruposListPage } from "@/components/grupos/GruposListPage";
import { MigracoesCarteiraPanel } from "@/components/clientes/MigracoesCarteiraPanel";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Fetély B2B" },
      { name: "description", content: "Gestão de clientes lojistas B2B." },
    ],
  }),
  component: ClientesPage,
});

const SITUACOES: SituacaoCadastral[] = [
  "ativa","suspensa","inapta","baixada","nula","desconhecida",
];

function ClientesPage() {
  const all = useVisibleClientes();
  const setAtivo = useClientes((s) => s.setAtivo);
  const roles = useAuth((s) => s.roles);
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");

  const [tabAtiva, setTabAtiva] = useState<"lista" | "grupos">("lista");
  const [query, setQuery] = useState("");
  const [segFilter, setSegFilter] = useState<SegmentoCliente | "all">("all");
  const [canalFilter, setCanalFilter] = useState<CanalCliente | "all">("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [sitFilter, setSitFilter] = useState<SituacaoCadastral | "all">("all");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"nome" | "totalFat" | "totalPed" | "ultimo">("nome");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const vendedores = useMemo(() => {
    const m = new Map<string, string>();
    all.forEach((c) => m.set(c.cadastradoPorVendedorId, c.cadastradoPorVendedorNome));
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return all.filter((c) => {
      if (segFilter !== "all" && c.segmento !== segFilter) return false;
      if (canalFilter !== "all" && c.canal !== canalFilter) return false;
      if (estadoFilter !== "all" && c.estado !== estadoFilter) return false;
      if (sitFilter !== "all" && c.situacaoCadastral !== sitFilter) return false;
      if (vendedorFilter !== "all" && c.cadastradoPorVendedorId !== vendedorFilter)
        return false;
      if (!q) return true;
      return (
        c.razaoSocial.toLowerCase().includes(q) ||
        c.nomeFantasia.toLowerCase().includes(q) ||
        (digits && c.cnpj.includes(digits)) ||
        c.cidade.toLowerCase().includes(q) ||
        (c.pais ?? "").toLowerCase().includes(q) ||
        (c.documentoNumero ?? "").toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [all, query, segFilter, canalFilter, estadoFilter, sitFilter, vendedorFilter]);

  const enriched = useMemo(
    () =>
      filtered.map((c) => ({ cliente: c, stats: calcClienteStats(c.id) })),
    [filtered],
  );

  const sorted = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      if (sortBy === "nome")
        return (a.cliente.nomeFantasia || a.cliente.razaoSocial).localeCompare(
          b.cliente.nomeFantasia || b.cliente.razaoSocial,
        );
      if (sortBy === "totalFat") return b.stats.totalFaturado - a.stats.totalFaturado;
      if (sortBy === "totalPed") return b.stats.totalPedidos - a.stats.totalPedidos;
      // ultimo
      return (b.stats.ultimoPedidoEm ?? "").localeCompare(a.stats.ultimoPedidoEm ?? "");
    });
    return arr;
  }, [enriched, sortBy]);

  // KPIs
  const now = Date.now();
  const noventaDias = 90 * 24 * 60 * 60 * 1000;
  const trimestre = now - noventaDias;
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const ativos = enriched.filter(
    (e) => e.stats.ultimoPedidoEm && new Date(e.stats.ultimoPedidoEm).getTime() > trimestre,
  ).length;
  const novosEsteMes = all.filter(
    (c) => new Date(c.criadoEm).getTime() > inicioMes.getTime(),
  ).length;

  const selected = selectedId ? all.find((c) => c.id === selectedId) ?? null : null;

  const exportCSV = (subset: { cliente: Cliente; stats: ReturnType<typeof calcClienteStats> }[]) => {
    const header = [
      "Razao Social","Nome Fantasia","Internacional","Pais","Documento Tipo","Documento Numero",
      "CNPJ","IE","Cidade","Estado","CEP",
      "Contato","Email","Telefone","Segmento","Canal","Total Pedidos","Total Faturado","Ultimo Pedido","Vendedor",
    ];
    const rows = subset.map(({ cliente: c, stats }) => [
      c.razaoSocial, c.nomeFantasia,
      c.isInternacional ? "Sim" : "Nao",
      c.pais ?? "", c.documentoTipo ?? "", c.documentoNumero ?? "",
      c.cnpjFormatado, c.inscricaoEstadual ?? "",
      c.cidade, c.estado, c.cep, c.contatoNome, c.contatoEmail, c.contatoTelefone,
      SEGMENTO_LABEL[c.segmento], CANAL_LABEL[c.canal],
      String(stats.totalPedidos), stats.totalFaturado.toFixed(2),
      stats.ultimoPedidoEm ?? "", c.cadastradoPorVendedorNome,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-fetely-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída.");
  };

  const handleExport = (modo: "todos" | "periodo" | "inativos") => {
    if (modo === "todos") return exportCSV(enriched);
    if (modo === "periodo") {
      return exportCSV(
        enriched.filter(
          (e) =>
            e.stats.ultimoPedidoEm &&
            new Date(e.stats.ultimoPedidoEm).getTime() > trimestre,
        ),
      );
    }
    return exportCSV(
      enriched.filter(
        (e) =>
          !e.stats.ultimoPedidoEm ||
          new Date(e.stats.ultimoPedidoEm).getTime() <= trimestre,
      ),
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Cadastro</div>
          <h1 className="font-display text-4xl mt-1">Clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <Can tela="clientes_lista" acao="exportar">
            <ExportMenu onExport={handleExport} />
          </Can>
          <Can tela="clientes_criar" acao="criar">
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light"
            >
              <Plus className="h-4 w-4" /> Novo Cliente
            </button>
          </Can>
        </div>
      </div>

      <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as "lista" | "grupos")} className="mb-4">
        <TabsList>
          <TabsTrigger value="lista">Lista de Clientes</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>
      </Tabs>

      {tabAtiva === "grupos" ? (
        <GruposListPage />
      ) : (
        <>
          {isAdminOrMaster && (
            <div className="mb-4">
              <MigracoesCarteiraPanel />
            </div>
          )}






      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Kpi label="Total de clientes" value={String(all.length)} />
        <Kpi label="Ativos (pedido no trimestre)" value={String(ativos)} />
        <Kpi label="Novos este mês" value={String(novosEsteMes)} />
      </div>

      {/* Search + filters */}
      <div className="rounded-lg gold-border bg-surface p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            className="w-full bg-surface-2 border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-gold"
            placeholder="nome, CNPJ, cidade, tag..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <FilterSelect
            value={segFilter}
            onChange={(v) => setSegFilter(v as SegmentoCliente | "all")}
            label="Segmento"
            options={[["all", "Todos"], ...Object.entries(SEGMENTO_LABEL)]}
          />
          <FilterSelect
            value={canalFilter}
            onChange={(v) => setCanalFilter(v as CanalCliente | "all")}
            label="Canal"
            options={[["all", "Todos"], ...Object.entries(CANAL_LABEL)]}
          />
          <FilterSelect
            value={estadoFilter}
            onChange={setEstadoFilter}
            label="Estado"
            options={[["all", "Todos"], ...UF_LIST.map((u) => [u, u] as [string, string])]}
          />
          <FilterSelect
            value={sitFilter}
            onChange={(v) => setSitFilter(v as SituacaoCadastral | "all")}
            label="Situação"
            options={[["all", "Todas"], ...SITUACOES.map((s) => [s, s] as [string, string])]}
          />
          {isAdminOrMaster && vendedores.length > 0 && (
            <FilterSelect
              value={vendedorFilter}
              onChange={setVendedorFilter}
              label="Vendedor"
              options={[["all", "Todos"], ...vendedores.map((v) => [v.id, v.nome] as [string, string])]}
            />
          )}
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-text-muted">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-surface-2 border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-gold"
            >
              <option value="nome">Nome</option>
              <option value="totalFat">Total faturado</option>
              <option value="totalPed">Nº de pedidos</option>
              <option value="ultimo">Último pedido</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-lg gold-border bg-surface overflow-hidden">
        <div className="grid grid-cols-[2fr_1.2fr_1.2fr_80px_120px_60px] gap-3 px-4 py-2.5 bg-surface-2 text-[10px] uppercase tracking-[0.18em] text-text-muted border-b border-border">
          <div>Cliente</div>
          <div>CNPJ</div>
          <div>Cidade</div>
          <div className="text-right">Pedidos</div>
          <div className="text-right">Total</div>
          <div></div>
        </div>
        {sorted.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            Nenhum cliente encontrado.
          </div>
        )}
        {sorted.map(({ cliente: c, stats }) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className="w-full text-left grid grid-cols-[2fr_1.2fr_1.2fr_80px_120px_60px] gap-3 items-center px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-surface-hover transition"
          >
            <div className="min-w-0">
              <div className={`text-sm truncate flex items-center gap-2 ${c.ativo ? "text-text-primary" : "text-text-muted"}`}>
                <span className="truncate">{c.nomeFantasia || c.razaoSocial}</span>
                {c.isInternacional && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-gold/10 border-gold/40 text-gold">
                    🌐 Internacional
                  </span>
                )}
                {(() => {
                  const st = statusPremissas(c);
                  if (st === "sem" || st === "inativa") return null;
                  const dias = diasParaExpirar(c.premissasComerciais?.vigenciaFim ?? null);
                  const cls =
                    st === "ativa"
                      ? "bg-gold/15 border-gold/40 text-gold"
                      : st === "expirando"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      : "bg-stock-out/15 border-stock-out/40 text-stock-out";
                  const label =
                    st === "ativa"
                      ? "✦ Homologadas"
                      : st === "expirando"
                      ? `✦ Expira em ${dias}d`
                      : "✦ Expirada";
                  return (
                    <span className={`shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${cls}`}>
                      {label}
                    </span>
                  );
                })()}
                {!c.ativo && (
                  <span className="ml-1 text-[9px] uppercase tracking-wider text-stock-out">
                    inativo
                  </span>
                )}
              </div>
              {(c.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(c.tags ?? []).slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-text-secondary font-mono truncate">
              {c.isInternacional
                ? `${c.pais ?? "—"} · ${c.documentoTipo ?? ""} ${c.documentoNumero ?? ""}`.trim()
                : c.cnpjFormatado || "—"}
            </div>
            <div className="text-xs text-text-secondary truncate">
              {c.cidade}/{c.estado}
            </div>
            <div className="text-xs text-right text-text-primary">{stats.totalPedidos}</div>
            <div className="text-xs text-right text-gold font-medium">
              {formatBRL(stats.totalFaturado)}
            </div>
            <div className="text-right text-[10px] text-text-muted">
              {isAdminOrMaster && c.cadastradoPorVendedorNome.split(" ")[0]}
            </div>
          </button>
        ))}
      </div>

      <ClienteFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editing}
      />

      {/* Painel lateral da ficha */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl bg-surface border-l border-border overflow-y-auto p-0"
        >
          {selected && (
            <ClienteDetail
              cliente={selected}
              onClose={() => setSelectedId(null)}
              onEdit={() => {
                setEditing(selected);
                setSelectedId(null);
                setModalOpen(true);
              }}
              onToggleAtivo={() => {
                setAtivo(selected.id, !selected.ativo);
                toast.success(selected.ativo ? "Cliente desativado" : "Cliente reativado");
              }}
            />
          )}
        </SheetContent>
      </Sheet>
        </>
      )}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg gold-border bg-surface p-4">
      <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">{label}</div>
      <div className="font-display text-3xl text-gold mt-1">{value}</div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: (readonly [string, string])[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface-2 border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-gold"
    >
      {options.map(([k, v]) => (
        <option key={k} value={k}>
          {k === "all" ? label : v}
        </option>
      ))}
    </select>
  );
}

function ExportMenu({
  onExport,
}: {
  onExport: (m: "todos" | "periodo" | "inativos") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wider text-text-secondary hover:text-gold hover:border-gold"
      >
        <Download className="h-3.5 w-3.5" /> Exportar
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md gold-border bg-surface shadow-lg overflow-hidden">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onExport("todos");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover"
          >
            Todos os clientes (CSV)
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onExport("periodo");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover border-t border-border/50"
          >
            Com pedidos no período (CSV)
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onExport("inativos");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover border-t border-border/50"
          >
            Inativos (sem pedido há 90+ dias)
          </button>
        </div>
      )}
    </div>
  );
}

function ClienteDetail({
  cliente,
  onClose,
  onEdit,
  onToggleAtivo,
}: {
  cliente: Cliente;
  onClose: () => void;
  onEdit: () => void;
  onToggleAtivo: () => void;
}) {
  const stats = calcClienteStats(cliente.id);
  const upsertCliente = useClientes((s) => s.upsertCliente);
  const profile = useAuth((s) => s.profile);

  const handlePremissasChange = async (patch: Partial<Cliente>) => {
    const next: Cliente = { ...cliente, ...patch, atualizadoEm: new Date().toISOString() };
    if (patch.premissasComerciais) {
      const alterados = diffPremissas(cliente.premissasComerciais, patch.premissasComerciais);
      if (alterados.length > 0) {
        const usuario = profile?.nome_completo ?? profile?.email ?? "—";
        next.premissasComerciais = {
          ...patch.premissasComerciais,
          historico: [
            ...(patch.premissasComerciais.historico ?? []),
            {
              timestamp: new Date().toISOString(),
              usuarioNome: usuario,
              descricao: cliente.premissasComerciais
                ? "Atualização de premissas"
                : "Criação de premissas",
              camposAlterados: alterados,
            },
          ],
        };
      }
    }
    try {
      await upsertCliente(next);
      toast.success("Premissas atualizadas.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível salvar as premissas");
    }
  };

  const faixaMaisFreq = useMemo(() => {
    const map = new Map<string, number>();
    stats.pedidos.forEach((p) => {
      const f = p.commercial?.faixaNome ?? "—";
      map.set(f, (map.get(f) ?? 0) + 1);
    });
    let best = "—";
    let bestN = 0;
    map.forEach((n, k) => {
      if (n > bestN) {
        bestN = n;
        best = k;
      }
    });
    return bestN > 0 ? `${best} (${bestN})` : "—";
  }, [stats.pedidos]);

  const produtoTop = useMemo(() => {
    const map = new Map<string, number>();
    stats.pedidos.forEach((p) =>
      p.items.forEach((i) => {
        map.set(i.product.nomeComercial, (map.get(i.product.nomeComercial) ?? 0) + i.quantity);
      }),
    );
    let best = "—";
    let bestN = 0;
    map.forEach((n, k) => {
      if (n > bestN) {
        bestN = n;
        best = k;
      }
    });
    return best;
  }, [stats.pedidos]);

  const intervaloRecompra = useMemo(() => {
    if (stats.pedidos.length < 2) return "—";
    const sorted = [...stats.pedidos].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    let total = 0;
    for (let i = 1; i < sorted.length; i++) {
      total +=
        new Date(sorted[i].createdAt).getTime() -
        new Date(sorted[i - 1].createdAt).getTime();
    }
    const dias = Math.round(total / (sorted.length - 1) / (1000 * 60 * 60 * 24));
    return `${dias} dias`;
  }, [stats.pedidos]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
            Ficha do cliente
          </div>
          <h2 className="font-display text-2xl text-text-primary truncate mt-1 flex items-center gap-2">
            <span className="truncate">{cliente.nomeFantasia || cliente.razaoSocial}</span>
            {cliente.isInternacional && (
              <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-gold/10 border-gold/40 text-gold">
                🌐 Internacional
              </span>
            )}
          </h2>
          <div className="text-xs text-text-secondary mt-1">
            {cliente.isInternacional
              ? `${cliente.pais ?? "—"} · ${cliente.documentoTipo ?? ""} ${cliente.documentoNumero ?? ""}`.trim()
              : cliente.cnpjFormatado || "Sem CNPJ"}{" "}
            · {cliente.cidade || "—"}/{cliente.estado || "—"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-gold p-1"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <Tabs defaultValue="perfil" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 mx-5 mt-3 bg-surface-2">
          <TabsTrigger value="perfil" className="text-xs">Perfil</TabsTrigger>
          <TabsTrigger value="premissas" className="text-xs text-gold">✦ Premissas</TabsTrigger>
          <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
          <TabsTrigger value="inteligencia" className="text-xs">Inteligência</TabsTrigger>
          <TabsTrigger value="portal" className="text-xs">Portal</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="px-5 pb-6 space-y-3 mt-3">
          <DetailRow label="Razão Social" value={cliente.razaoSocial} />
          <DetailRow label="Nome Fantasia" value={cliente.nomeFantasia} />
          {cliente.isInternacional ? (
            <>
              <DetailRow label="País" value={cliente.pais || "—"} />
              <DetailRow
                label="Documento"
                value={`${cliente.documentoTipo ?? "—"} ${cliente.documentoNumero ?? ""}`.trim() || "—"}
              />
            </>
          ) : (
            <>
              <DetailRow label="Inscrição Estadual" value={cliente.inscricaoEstadual || (cliente.isentoIE ? "Isento" : "—")} />
              <DetailRow label="Situação" value={cliente.situacaoCadastral} />
            </>
          )}
          <DetailRow
            label="Endereço"
            value={`${cliente.logradouro}${cliente.numero ? `, ${cliente.numero}` : ""} — ${cliente.bairro}, ${cliente.cidade}/${cliente.estado} · ${cliente.cep}`}
          />
          {!cliente.enderecoEntregaIgual && (
            <DetailRow
              label="Endereço de entrega"
              value={`${cliente.entregaLogradouro ?? ""}${cliente.entregaNumero ? `, ${cliente.entregaNumero}` : ""} — ${cliente.entregaBairro ?? ""}, ${cliente.entregaCidade ?? ""}/${cliente.entregaEstado ?? ""}`}
            />
          )}
          <DetailRow label="Contato" value={`${cliente.contatoNome} · ${cliente.contatoTelefone}`} />
          <DetailRow label="E-mail" value={cliente.contatoEmail} />
          {cliente.financeiroNome && (
            <DetailRow
              label="Financeiro"
              value={`${cliente.financeiroNome} · ${cliente.financeiroEmail ?? ""}`}
            />
          )}
          <DetailRow label="Segmento" value={SEGMENTO_LABEL[cliente.segmento]} />
          <DetailRow label="Canal" value={CANAL_LABEL[cliente.canal]} />
          {cliente.regiaoAtuacao && (
            <DetailRow label="Região" value={cliente.regiaoAtuacao} />
          )}
          {(cliente.tags ?? []).length > 0 && (
            <DetailRow label="Tags" value={(cliente.tags ?? []).join(", ")} />
          )}
          {cliente.observacoes && (
            <DetailRow label="Observações" value={cliente.observacoes} />
          )}
          <DetailRow
            label="Cadastrado por"
            value={`${cliente.cadastradoPorVendedorNome} · ${new Date(cliente.criadoEm).toLocaleDateString("pt-BR")}`}
          />

          <div className="flex gap-2 pt-4">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-gold text-background text-xs font-semibold uppercase tracking-wider hover:bg-gold-light"
            >
              <Edit2 className="h-3.5 w-3.5" /> Editar
            </button>
            <button
              onClick={onToggleAtivo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-surface text-xs uppercase tracking-wider text-text-secondary hover:text-stock-out hover:border-stock-out"
            >
              <Power className="h-3.5 w-3.5" /> {cliente.ativo ? "Desativar" : "Reativar"}
            </button>
          </div>
        </TabsContent>

        <TabsContent value="premissas" className="px-5 pb-6 mt-3">
          <PremissasComercialTab cliente={cliente} onChange={handlePremissasChange} />
        </TabsContent>



        <TabsContent value="pedidos" className="px-5 pb-6 mt-3">
          {stats.pedidos.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">
              Nenhum pedido para este cliente ainda.
            </p>
          ) : (
            <div className="rounded-md gold-border bg-surface-2 overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_100px_80px_100px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted bg-surface border-b border-border">
                <div>Data</div>
                <div>#</div>
                <div className="text-right">Bruto</div>
                <div className="text-right">Desc.</div>
                <div className="text-right">Final</div>
              </div>
              {stats.pedidos.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_80px_100px_80px_100px] gap-2 px-3 py-2 text-xs border-b border-border/50 last:border-b-0"
                >
                  <div className="text-text-secondary">
                    {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="font-mono text-text-muted truncate">{p.id.replace("PED-", "#")}</div>
                  <div className="text-right text-text-primary">
                    {formatBRL(p.commercial?.bruto ?? p.total)}
                  </div>
                  <div className="text-right text-text-muted">
                    {p.commercial
                      ? `${p.commercial.descontoCelebraPct + p.commercial.descontoMasterPct}%`
                      : "—"}
                  </div>
                  <div className="text-right text-gold font-medium">{formatBRL(p.total)}</div>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_80px_100px_80px_100px] gap-2 px-3 py-2 bg-surface border-t border-border">
                <div className="text-[10px] uppercase tracking-wider text-gold-muted">Total</div>
                <div></div>
                <div></div>
                <div></div>
                <div className="text-right text-gold font-display text-base">
                  {formatBRL(stats.totalFaturado)}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inteligencia" className="px-5 pb-6 mt-3 space-y-3">
          <DetailRow label="Ticket médio" value={formatBRL(stats.ticketMedio)} />
          <DetailRow label="Faixa mais frequente" value={faixaMaisFreq} />
          <DetailRow label="Produto mais comprado" value={produtoTop} />
          <DetailRow label="Intervalo médio de recompra" value={intervaloRecompra} />
          <DetailRow
            label="Último pedido"
            value={
              stats.ultimoPedidoEm
                ? `${new Date(stats.ultimoPedidoEm).toLocaleDateString("pt-BR")} (há ${Math.floor((Date.now() - new Date(stats.ultimoPedidoEm).getTime()) / (1000 * 60 * 60 * 24))} dias)`
                : "—"
            }
          />
        </TabsContent>

        <TabsContent value="portal" className="px-5 pb-6 mt-3">
          <PortalAccessTab cliente={cliente} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/40 pb-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</div>
      <div className="text-sm text-text-primary mt-0.5 break-words">{value}</div>
    </div>
  );
}
