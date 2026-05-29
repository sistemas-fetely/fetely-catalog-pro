import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAuth } from "@/store/authStore";
import { useProvisao } from "@/store/provisaoStore";
import { formatBRL } from "@/lib/format";
import { STATUS_PROVISAO_LABEL } from "@/types/provisao";

export const Route = createFileRoute("/portal/provisoes")({
  component: PortalProvisoes,
});

function PortalProvisoes() {
  const clienteId = useAuth((s) => s.profile?.cliente_id ?? null);
  const all = useProvisao((s) => s.provisoes);
  const minhas = useMemo(
    () => all.filter((p) => clienteId && p.clienteId === clienteId),
    [all, clienteId],
  );

  const abertas = minhas.filter(
    (p) => p.status === "aguardando_estoque" || p.status === "estoque_liberado",
  );
  const fechadas = minhas.filter(
    (p) => p.status === "convertido_em_pedido" || p.status === "cancelado",
  );

  const liberadas = abertas.filter((p) => p.status === "estoque_liberado");

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="border-b border-border pb-5">
        <h1 className="font-display text-3xl text-text-primary">Provisões</h1>
        <p className="text-sm text-text-secondary mt-1">
          Itens reservados para entrega futura. Conforme o estoque chega, sua
          provisão é liberada.
        </p>
      </header>

      {liberadas.length > 0 && (
        <section className="space-y-3">
          {liberadas.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-gold/40 bg-gold/10 p-5 flex flex-col md:flex-row md:items-center gap-3"
            >
              <div className="flex-1">
                <div className="text-lg text-gold font-display">
                  🎉 Estoque liberado!
                </div>
                <div className="text-sm text-text-primary mt-0.5">
                  Provisão #{p.id} — {p.itens.length} item(s) disponíveis para
                  entrega · ref {formatBRL(p.totalReferencia)}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  Fale com seu vendedor para confirmar a conversão em pedido.
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="font-display text-lg text-text-primary mb-3">Em aberto</h2>
        {abertas.length === 0 ? (
          <div className="rounded-md border border-border bg-surface/40 px-6 py-8 text-center text-text-muted text-sm">
            Nenhuma provisão em aberto.
          </div>
        ) : (
          <ProvisaoTable items={abertas} />
        )}
      </section>

      {fechadas.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-text-primary mb-3">Encerradas</h2>
          <ProvisaoTable items={fechadas} muted />
        </section>
      )}
    </div>
  );
}

function ProvisaoTable({
  items,
  muted,
}: {
  items: ReturnType<typeof useProvisao.getState>["provisoes"];
  muted?: boolean;
}) {
  return (
    <div className={`rounded-md border border-border bg-surface/40 overflow-hidden ${muted ? "opacity-80" : ""}`}>
      <div className="grid grid-cols-[80px_1fr_140px_140px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-text-muted bg-surface border-b border-border">
        <div>#</div>
        <div>Itens</div>
        <div>Previsão</div>
        <div>Status</div>
      </div>
      {items.map((p) => (
        <div
          key={p.id}
          className="grid grid-cols-[80px_1fr_140px_140px] gap-3 px-4 py-3 text-xs items-center border-b border-border/40 last:border-b-0"
        >
          <span className="font-mono text-text-muted">{p.id}</span>
          <span className="text-text-primary">
            {p.itens.length} item(s) · ref {formatBRL(p.totalReferencia)}
          </span>
          <span className="text-text-secondary">{p.proximaPrevisao}</span>
          <span
            className={`text-xs ${
              p.status === "estoque_liberado"
                ? "text-gold"
                : p.status === "cancelado"
                ? "text-text-muted"
                : "text-text-secondary"
            }`}
          >
            {STATUS_PROVISAO_LABEL[p.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
