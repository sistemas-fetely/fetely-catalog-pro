import { Fragment, useState } from "react";
import {
  Send,
  AlertTriangle,
  X,
  Check,
  Loader2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { SyncOrderRow, SncfStatus } from "@/hooks/useSyncManagement";
import { formatBRL } from "@/lib/format";

const RETRY_STATUSES: SncfStatus[] = ["nao_enviado", "erro_persistente"];

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export function SyncTable({
  rows,
  selected,
  onSelectedChange,
}: {
  rows: SyncOrderRow[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };
  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const retryableRows = rows.filter((r) => RETRY_STATUSES.includes(r.sncf_status_sync));
  const allRetryableSelected =
    retryableRows.length > 0 && retryableRows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allRetryableSelected) onSelectedChange(new Set());
    else onSelectedChange(new Set(retryableRows.map((r) => r.id)));
  };

  return (
    <div className="rounded-lg border border-border bg-surface/40">
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-[0.15em] text-text-secondary border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={allRetryableSelected}
                  onChange={toggleAll}
                  disabled={retryableRows.length === 0}
                  aria-label="Selecionar todos retentáveis"
                />
              </th>
              <th className="px-3 py-2 text-left">Pedido</th>
              <th className="px-3 py-2 text-left">Vendedor</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Forma</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Erro</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isExpanded = expanded.has(r.id);
              const isRetryable = RETRY_STATUSES.includes(r.sncf_status_sync);
              return (
                <>
                  <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover/40">
                    <td className="px-3 py-2">
                      {isRetryable && (
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          aria-label={`Selecionar ${r.id}`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{r.id}</td>
                    <td className="px-3 py-2">{r.vendedor_nome ?? "—"}</td>
                    <td className="px-3 py-2">{r.cliente_nome ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(r.total)}</td>
                    <td className="px-3 py-2">{r.forma_pagamento ?? "—"}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.sncf_status_sync} /></td>
                    <td className="px-3 py-2 text-text-secondary text-[11px]">
                      {r.sncf_ultimo_erro ? truncate(r.sncf_ultimo_erro, 60) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(r.id)}
                        className="text-text-secondary hover:text-gold"
                        aria-label={isExpanded ? "Recolher" : "Expandir"}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-surface/30 border-b border-border/50">
                      <td colSpan={9} className="px-3 py-3">
                        <DetailExpanded row={r} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-text-secondary text-xs">
                  Nenhum pedido com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {rows.map((r) => {
          const isExpanded = expanded.has(r.id);
          const isRetryable = RETRY_STATUSES.includes(r.sncf_status_sync);
          return (
            <div key={r.id} className="p-3">
              <div className="flex items-start gap-2">
                {isRetryable && (
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px]">{r.id}</span>
                    <StatusBadge status={r.sncf_status_sync} />
                  </div>
                  <p className="text-sm mt-1 truncate">{r.cliente_nome ?? "—"}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    {r.vendedor_nome ?? "—"} · {formatBRL(r.total)} · {r.forma_pagamento ?? "—"}
                  </p>
                  {r.sncf_ultimo_erro && (
                    <p className="text-[11px] text-amber-500 mt-1">{r.sncf_ultimo_erro}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(r.id)}
                    className="mt-2 text-[10px] uppercase tracking-wider text-gold"
                  >
                    {isExpanded ? "Recolher" : "Detalhes"}
                  </button>
                  {isExpanded && <DetailExpanded row={r} />}
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="p-6 text-center text-text-secondary text-xs">
            Nenhum pedido com os filtros aplicados.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SncfStatus }) {
  const map: Record<
    SncfStatus,
    { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    nao_enviado: { label: "Não enviado", cls: "border-gold/40 text-gold", Icon: Send },
    pendente: { label: "Pendente", cls: "border-gold/30 text-gold-muted", Icon: Loader2 },
    enviado: { label: "Enviado", cls: "border-emerald-500/40 text-emerald-500", Icon: Check },
    rejeitado: { label: "Rejeitado", cls: "border-red-500/40 text-red-500", Icon: X },
    erro_persistente: {
      label: "Erro técnico",
      cls: "border-amber-500/40 text-amber-500",
      Icon: AlertTriangle,
    },
  };
  const { label, cls, Icon } = map[status];
  const animate = status === "pendente" ? "animate-spin" : "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}
    >
      <Icon className={`h-3 w-3 ${animate}`} />
      {label}
    </span>
  );
}

function DetailExpanded({ row }: { row: SyncOrderRow }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
      <div className="space-y-1">
        <h4 className="text-[10px] uppercase tracking-[0.15em] text-text-secondary mb-1">
          Sincronização
        </h4>
        <Kv k="SNCF Pedido ID" v={row.sncf_pedido_id ?? "—"} />
        <Kv k="Estágio" v={row.sncf_estagio ?? "—"} />
        <Kv k="Tentativas" v={String(row.sncf_tentativas ?? 0)} />
        <Kv k="Enviado em" v={fmtDate(row.sncf_enviado_em)} />
        <Kv k="Último sync" v={fmtDate(row.sncf_ultimo_sync_em)} />
      </div>
      <div className="space-y-1">
        <h4 className="text-[10px] uppercase tracking-[0.15em] text-text-secondary mb-1">
          Pedido
        </h4>
        <Kv k="Criado em" v={fmtDate(row.created_at)} />
        <Kv k="Total" v={formatBRL(row.total)} />
        {row.sncf_ultimo_erro && (
          <>
            <h4 className="text-[10px] uppercase tracking-[0.15em] text-text-secondary mt-2 mb-1">
              Último erro
            </h4>
            <pre className="text-[11px] text-amber-500 whitespace-pre-wrap break-words rounded border border-amber-500/20 bg-amber-500/5 p-2">
              {row.sncf_ultimo_erro}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-text-secondary min-w-[110px]">{k}</span>
      <span className="text-text-primary break-all">{v}</span>
    </div>
  );
}
