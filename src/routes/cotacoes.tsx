import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { formatBRL } from "@/lib/format";
import {
  useCotacao,
  useVisibleCotacoes,
  diasAteExpirar,
} from "@/store/cotacaoStore";
import type { Cotacao, StatusCotacao } from "@/types/cotacao";
import { STATUS_COTACAO_LABEL } from "@/types/cotacao";
import { CotacaoDetailDrawer } from "@/components/cotacoes/CotacaoDetailDrawer";

export const Route = createFileRoute("/cotacoes")({
  head: () => ({
    meta: [
      { title: "Cotações — Fetély B2B" },
      { name: "description", content: "Gerencie cotações abertas, em negociação e aprovadas." },
    ],
  }),
  component: CotacoesPage,
});

const STATUS_BADGE: Record<StatusCotacao, string> = {
  aberta: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  em_negociacao: "border-blue-500/40 bg-blue-500/10 text-blue-500",
  aprovada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  convertida: "border-gold/40 bg-gold/10 text-gold",
  expirada: "border-border bg-surface-2 text-text-muted",
  perdida: "border-red-500/40 bg-red-500/10 text-red-500",
};

const STATUS_ICON: Record<StatusCotacao, string> = {
  aberta: "🟡",
  em_negociacao: "🔵",
  aprovada: "🟢",
  convertida: "✅",
  expirada: "⚫",
  perdida: "🔴",
};

type Filtro = "abertas" | "em_negociacao" | "aprovadas" | "convertidas" | "todas";

let expiracaoJaRodou = false;

function CotacoesPage() {
  const cotacoes = useVisibleCotacoes();
  const fetchAll = useCotacao((s) => s.fetchAll);
  const expirarVencidas = useCotacao((s) => s.expirarVencidas);
  const loading = useCotacao((s) => s.loading);
  const loaded = useCotacao((s) => s.loaded);
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(null);

  // Cache-first: a lista já carregada aparece na hora; a revalidação roda
  // em background (com TTL no store) e a expiração só uma vez por sessão.
  useEffect(() => {
    void (async () => {
      await fetchAll();
      if (!expiracaoJaRodou) {
        expiracaoJaRodou = true;
        await expirarVencidas();
      }
    })();
  }, [fetchAll, expirarVencidas]);


  const counts = useMemo(() => {
    return {
      abertas: cotacoes.filter((c) => c.status === "aberta").length,
      em_negociacao: cotacoes.filter((c) => c.status === "em_negociacao").length,
      aprovadas: cotacoes.filter((c) => c.status === "aprovada").length,
      convertidas: cotacoes.filter((c) => c.status === "convertida").length,
      todas: cotacoes.length,
    };
  }, [cotacoes]);

  const filtradas = useMemo(() => {
    let list = cotacoes;
    if (filtro === "abertas") list = list.filter((c) => c.status === "aberta");
    else if (filtro === "em_negociacao") list = list.filter((c) => c.status === "em_negociacao");
    else if (filtro === "aprovadas") list = list.filter((c) => c.status === "aprovada");
    else if (filtro === "convertidas") list = list.filter((c) => c.status === "convertida");
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          (c.meta.cliente ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [cotacoes, filtro, busca]);

  const cotacaoAberta = selecionada ? cotacoes.find((c) => c.id === selecionada) ?? null : null;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">B2B</div>
          <h1 className="font-display text-3xl sm:text-4xl mt-1 flex items-center gap-2">
            <FileText className="h-7 w-7 text-gold" /> Cotações
          </h1>
        </div>
        <Link
          to="/new-order"
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-background hover:bg-gold-light"
        >
          <Plus className="h-4 w-4" /> Nova Cotação
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["abertas", `Abertas: ${counts.abertas}`],
            ["em_negociacao", `Em negociação: ${counts.em_negociacao}`],
            ["aprovadas", `Aprovadas: ${counts.aprovadas}`],
            ["convertidas", `Convertidas: ${counts.convertidas}`],
            ["todas", `Todas: ${counts.todas}`],
          ] as [Filtro, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`rounded-md border px-3 py-1.5 text-[11px] uppercase tracking-wider transition ${
              filtro === key
                ? "border-gold bg-gold/10 text-gold"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou número..."
          className="w-full max-w-md pl-9 pr-3 py-2 rounded-md bg-surface-2 border border-border text-sm text-text-primary outline-none focus:border-gold"
        />
      </div>

      {loading && !loaded ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center text-text-secondary">
          <p className="text-sm">Carregando cotações...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center text-text-secondary">
          <FileText className="h-10 w-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm">Nenhuma cotação encontrada.</p>
          <p className="text-xs text-text-muted mt-1">
            Inicie um novo pedido e, ao finalizar, escolha "Salvar como Cotação".
          </p>
        </div>

      ) : (
        <>
          {/* Tabela — desktop/tablet */}
          <div className="hidden md:block overflow-x-auto rounded-lg gold-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-secondary text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-right px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Criada em</th>
                  <th className="text-left px-4 py-3">Válida até</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <CotacaoRow key={c.id} cotacao={c} onClick={() => setSelecionada(c.id)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-2">
            {filtradas.map((c) => {
              const dias = diasAteExpirar(c);
              const expirando =
                dias >= 0 && dias <= 3 && (c.status === "aberta" || c.status === "em_negociacao");
              return (
                <button
                  key={c.id}
                  onClick={() => setSelecionada(c.id)}
                  className="w-full text-left rounded-lg gold-border bg-surface p-3 active:bg-surface-hover transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11px] text-gold truncate">{c.id}</div>
                      <div className="text-sm text-text-primary truncate mt-0.5">
                        {c.meta.cliente || "—"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${STATUS_BADGE[c.status]}`}
                    >
                      <span>{STATUS_ICON[c.status]}</span>
                      {STATUS_COTACAO_LABEL[c.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div className="text-[10px] text-text-secondary leading-tight">
                      <div>Criada: {new Date(c.criadoEm).toLocaleDateString("pt-BR")}</div>
                      <div>
                        Válida: {new Date(c.validoAte).toLocaleDateString("pt-BR")}
                        {expirando && (
                          <span className="ml-1 text-amber-500">
                            ⚠ {dias === 0 ? "hoje" : `${dias}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-gold font-semibold text-sm">
                      {formatBRL(c.total)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {cotacaoAberta && (
        <CotacaoDetailDrawer cotacao={cotacaoAberta} onClose={() => setSelecionada(null)} />
      )}
    </main>
  );
}

function CotacaoRow({ cotacao, onClick }: { cotacao: Cotacao; onClick: () => void }) {
  const dias = diasAteExpirar(cotacao);
  const expirando =
    dias >= 0 && dias <= 3 && (cotacao.status === "aberta" || cotacao.status === "em_negociacao");
  return (
    <tr
      onClick={onClick}
      className="border-t border-border hover:bg-surface-hover cursor-pointer"
    >
      <td className="px-4 py-3 font-mono text-text-primary">{cotacao.id}</td>
      <td className="px-4 py-3 text-text-primary truncate max-w-xs">
        {cotacao.meta.cliente || "—"}
      </td>
      <td className="px-4 py-3 text-right text-gold font-medium">
        {formatBRL(cotacao.total)}
      </td>
      <td className="px-4 py-3 text-text-secondary text-xs">
        {new Date(cotacao.criadoEm).toLocaleDateString("pt-BR")}
      </td>
      <td className="px-4 py-3 text-text-secondary text-xs">
        {new Date(cotacao.validoAte).toLocaleDateString("pt-BR")}
        {expirando && (
          <div className="text-amber-500 text-[10px] mt-0.5">
            ⚠ {dias === 0 ? "Expira hoje" : `Expira em ${dias}d`}
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_BADGE[cotacao.status]}`}
        >
          <span>{STATUS_ICON[cotacao.status]}</span>
          {STATUS_COTACAO_LABEL[cotacao.status]}
        </span>
      </td>
    </tr>
  );
}
