import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Search, Layers } from "lucide-react";
import { useOrder } from "@/store/orderStore";
import { useProvisao } from "@/store/provisaoStore";
import { formatBRL } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/settings/pedido-original")({
  component: PedidoOriginalPage,
  head: () => ({
    meta: [{ title: "Pedido Original · Fetély" }],
  }),
});

interface LinhaPedidoOriginal {
  pedidoId: string;
  createdAt: string;
  cliente: string;
  vendedorNome: string;
  totalPedido: number;
  totalProvisoes: number;
  qtdProvisoes: number;
  pedidoOriginal: number;
  provisaoIds: string[];
}

function PedidoOriginalPage() {
  const orders = useOrder((s) => s.history);
  const provisoes = useProvisao((s) => s.provisoes);
  const [busca, setBusca] = useState("");

  const linhas = useMemo<LinhaPedidoOriginal[]>(() => {
    const provsPorPedido = new Map<string, typeof provisoes>();
    for (const p of provisoes) {
      const pid = p.pedidoFirmeId ?? p.pedidoConvertidoId;
      if (!pid) continue;
      if (p.reprovado || p.status === "cancelado") continue;
      const arr = provsPorPedido.get(pid) ?? [];
      arr.push(p);
      provsPorPedido.set(pid, arr);
    }

    return orders
      .filter((o) => !o.reprovado)
      .map((o) => {
        const provs = provsPorPedido.get(o.id) ?? [];
        const totalProvisoes = provs.reduce((s, p) => s + p.totalReferencia, 0);
        const cliente =
          o.meta.nomeFantasia || o.meta.cliente || o.meta.cnpj || "—";
        return {
          pedidoId: o.id,
          createdAt: o.createdAt,
          cliente,
          vendedorNome: o.vendedorNome ?? o.meta.vendedor ?? "—",
          totalPedido: o.total,
          totalProvisoes,
          qtdProvisoes: provs.length,
          pedidoOriginal: o.total + totalProvisoes,
          provisaoIds: provs.map((p) => p.id),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, provisoes]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter(
      (l) =>
        l.pedidoId.toLowerCase().includes(q) ||
        l.cliente.toLowerCase().includes(q) ||
        l.vendedorNome.toLowerCase().includes(q),
    );
  }, [linhas, busca]);

  const totais = useMemo(
    () => ({
      pedidos: filtradas.reduce((s, l) => s + l.totalPedido, 0),
      provisoes: filtradas.reduce((s, l) => s + l.totalProvisoes, 0),
      original: filtradas.reduce((s, l) => s + l.pedidoOriginal, 0),
      comProvisao: filtradas.filter((l) => l.qtdProvisoes > 0).length,
    }),
    [filtradas],
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-text-secondary hover:text-gold transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Configurações
          </Link>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <Layers className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-text-primary">
              Pedido Original
            </h1>
            <p className="text-sm text-text-secondary">
              Pedido firme + provisões vinculadas, somados por pedido
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPI label="Pedidos" value={String(filtradas.length)} />
          <KPI label="Com provisão" value={String(totais.comProvisao)} />
          <KPI label="Σ Provisões" value={formatBRL(totais.provisoes)} />
          <KPI
            label="Σ Pedido Original"
            value={formatBRL(totais.original)}
            highlight
          />
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pedido, cliente ou vendedor"
            className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-gold/50"
          />
        </div>

        <div className="rounded-lg border border-border bg-surface/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-text-secondary">Pedido</TableHead>
                <TableHead className="text-text-secondary">Data</TableHead>
                <TableHead className="text-text-secondary">Cliente</TableHead>
                <TableHead className="text-text-secondary">Vendedor</TableHead>
                <TableHead className="text-right text-text-secondary">
                  Total Pedido
                </TableHead>
                <TableHead className="text-right text-text-secondary">
                  Σ Provisões
                </TableHead>
                <TableHead className="text-center text-text-secondary">
                  Qtd. Prov.
                </TableHead>
                <TableHead className="text-right text-text-secondary">
                  Pedido Original
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-text-secondary py-8"
                  >
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((l) => (
                  <TableRow key={l.pedidoId}>
                    <TableCell className="font-mono text-xs text-text-primary">
                      {l.pedidoId}
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary">
                      {new Date(l.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm text-text-primary max-w-[220px] truncate">
                      {l.cliente}
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary max-w-[160px] truncate">
                      {l.vendedorNome}
                    </TableCell>
                    <TableCell className="text-right text-sm text-text-primary tabular-nums">
                      {formatBRL(l.totalPedido)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {l.totalProvisoes > 0 ? (
                        <span className="text-yellow-300">
                          {formatBRL(l.totalProvisoes)}
                        </span>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-text-secondary">
                      {l.qtdProvisoes || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-gold tabular-nums">
                      {formatBRL(l.pedidoOriginal)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-[11px] text-text-secondary mt-4">
          * O "Pedido Original" considera apenas provisões vinculadas ao pedido
          firme (não reprovadas e não canceladas). Valores de provisão são de
          referência (sem desconto comercial aplicado).
        </p>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight
          ? "border-gold/40 bg-gold/5"
          : "border-border bg-surface/40"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">
        {label}
      </div>
      <div
        className={`font-display text-xl mt-1 ${
          highlight ? "text-gold" : "text-text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
