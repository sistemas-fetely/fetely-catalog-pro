import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CreditCard, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/condicoes-pagamento")({
  component: CondicoesPagamentoPage,
  head: () => ({
    meta: [{ title: "Condições de Pagamento · Fetély" }],
  }),
});

interface Condicao {
  id: number;
  descricao: string;
  tipo: "pix" | "boleto" | "cartao";
  valor_minimo: number;
  numero_parcelas: number | null;
  dias_parcelas: number[] | null;
  sem_juros: boolean;
  tem_bonus_pix: boolean;
  destaque: boolean;
  ativa: boolean;
  ordem: number;
}

function CondicoesPagamentoPage() {
  const [condicoes, setCondicoes] = useState<Condicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function fetchCondicoes() {
      const { data, error } = await supabase
        .from("condicoes_pagamento")
        .select("*")
        .order("ordem", { ascending: true });

      if (!error && data) {
        setCondicoes(data as Condicao[]);
      }
      setLoading(false);
    }
    fetchCondicoes();
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return condicoes;
    return condicoes.filter(
      (c) =>
        c.descricao.toLowerCase().includes(q) ||
        c.tipo.toLowerCase().includes(q),
    );
  }, [condicoes, busca]);

  const totais = useMemo(() => {
    const ativas = filtradas.filter((c) => c.ativa).length;
    const inativas = filtradas.filter((c) => !c.ativa).length;
    const comBonusPix = filtradas.filter((c) => c.tem_bonus_pix).length;
    return { ativas, inativas, comBonusPix };
  }, [filtradas]);

  function badgeTipo(tipo: string) {
    const map: Record<string, string> = {
      pix: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      boleto: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      cartao: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[tipo] || "bg-muted text-muted-foreground"}`}
      >
        {tipo}
      </span>
    );
  }

  function badgeParcelas(c: Condicao) {
    if (!c.numero_parcelas || c.numero_parcelas <= 1) return "À vista";
    return `${c.numero_parcelas}x`;
  }

  function formatDias(dias: number[] | null) {
    if (!dias || dias.length === 0) return "—";
    return dias.map((d) => `${d}d`).join(" / ");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface transition hover:border-gold/40 hover:bg-surface-hover"
          >
            <ArrowLeft className="h-4 w-4 text-text-secondary" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <CreditCard className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-text-primary">
                Condições de Pagamento
              </h1>
              <p className="text-sm text-text-secondary">
                Tabela completa de formas de pagamento disponíveis no sistema
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por descrição ou tipo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span className="rounded-md bg-surface px-2 py-1 border border-border">
              Ativas: <strong className="text-emerald-400">{totais.ativas}</strong>
            </span>
            <span className="rounded-md bg-surface px-2 py-1 border border-border">
              Inativas: <strong className="text-red-400">{totais.inativas}</strong>
            </span>
            <span className="rounded-md bg-surface px-2 py-1 border border-border">
              Com Bônus PIX: <strong className="text-gold">{totais.comBonusPix}</strong>
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="w-16 text-center text-text-secondary">#</TableHead>
                    <TableHead className="text-text-secondary">Descrição</TableHead>
                    <TableHead className="text-text-secondary">Tipo</TableHead>
                    <TableHead className="text-right text-text-secondary">Parcelas</TableHead>
                    <TableHead className="text-right text-text-secondary">Dias</TableHead>
                    <TableHead className="text-right text-text-secondary">Valor Mínimo</TableHead>
                    <TableHead className="text-center text-text-secondary">Sem Juros</TableHead>
                    <TableHead className="text-center text-text-secondary">Bônus PIX</TableHead>
                    <TableHead className="text-center text-text-secondary">Destaque</TableHead>
                    <TableHead className="text-center text-text-secondary">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-12 text-center text-sm text-text-secondary"
                      >
                        Nenhuma condição encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtradas.map((c) => (
                      <TableRow
                        key={c.id}
                        className={`border-b border-border transition hover:bg-surface-hover ${!c.ativa ? "opacity-50" : ""}`}
                      >
                        <TableCell className="text-center font-mono text-xs text-text-secondary">
                          {c.id}
                        </TableCell>
                        <TableCell className="font-medium text-text-primary">
                          {c.descricao}
                        </TableCell>
                        <TableCell>{badgeTipo(c.tipo)}</TableCell>
                        <TableCell className="text-right text-sm text-text-primary">
                          {badgeParcelas(c)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-text-secondary">
                          {formatDias(c.dias_parcelas)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-text-primary">
                          {formatBRL(c.valor_minimo)}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.sem_juros ? (
                            <span className="text-emerald-400">Sim</span>
                          ) : (
                            <span className="text-text-secondary">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.tem_bonus_pix ? (
                            <span className="text-gold">Sim</span>
                          ) : (
                            <span className="text-text-secondary">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.destaque ? (
                            <span className="text-gold">★</span>
                          ) : (
                            <span className="text-text-secondary">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.ativa ? (
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          ) : (
                            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-xs text-text-secondary">
          Total de {condicoes.length} condição(ões) cadastrada(s) no sistema.
        </div>
      </div>
    </div>
  );
}
