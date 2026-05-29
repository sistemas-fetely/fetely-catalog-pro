import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";
import { useOrder } from "@/store/orderStore";
import { useProvisao } from "@/store/provisaoStore";
import { formatBRL } from "@/lib/format";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/portal/")({
  component: PortalHome,
});

function PortalHome() {
  const profile = useAuth((s) => s.profile);
  const clienteId = profile?.cliente_id ?? null;
  const cliente = useClientes((s) =>
    clienteId ? s.clientes.find((c) => c.id === clienteId) : undefined,
  );
  const allOrders = useOrder((s) => s.history);
  const allProvisoes = useProvisao((s) => s.provisoes);

  const pedidos = useMemo(
    () => allOrders.filter((o) => clienteId && o.meta.clienteId === clienteId),
    [allOrders, clienteId],
  );
  const provisoesAbertas = useMemo(
    () =>
      allProvisoes.filter(
        (p) =>
          clienteId &&
          p.clienteId === clienteId &&
          (p.status === "aguardando_estoque" || p.status === "estoque_liberado"),
      ),
    [allProvisoes, clienteId],
  );

  const anoCorrente = new Date().getFullYear();
  const pedidosAno = pedidos.filter(
    (p) => new Date(p.createdAt).getFullYear() === anoCorrente,
  );
  const totalAno = pedidosAno.reduce((s, p) => s + p.total, 0);
  const ultimo = pedidos[0];
  const totalProvisao = provisoesAbertas.reduce((s, p) => s + p.totalReferencia, 0);

  const vendedorNome = cliente?.cadastradoPorVendedorNome ?? "—";
  const empresa = cliente?.nomeFantasia || cliente?.razaoSocial || "—";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="border-b border-border pb-5">
        <h1 className="font-display text-3xl text-text-primary">
          Olá, {empresa} <span aria-hidden>👋</span>
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {cliente?.cnpjFormatado && (
            <>
              CNPJ: {cliente.cnpjFormatado} · Vendedor:{" "}
              <span className="text-text-primary">{vendedorNome}</span>
            </>
          )}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          label={`Pedidos em ${anoCorrente}`}
          big={String(pedidosAno.length)}
          sub={formatBRL(totalAno)}
        />
        <Card
          label="Último Pedido"
          big={ultimo ? new Date(ultimo.createdAt).toLocaleDateString("pt-BR") : "—"}
          sub={ultimo ? formatBRL(ultimo.total) : "Nenhum pedido"}
        />
        <Card
          label="Provisões em aberto"
          big={String(provisoesAbertas.length)}
          sub={totalProvisao > 0 ? `${formatBRL(totalProvisao)} ref` : "—"}
        />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-lg text-text-primary">Últimos pedidos</h2>
          <Link
            to="/portal/pedidos"
            className="text-xs uppercase tracking-wider text-gold hover:text-gold-light"
          >
            Ver todos →
          </Link>
        </div>
        <div className="rounded-md border border-border bg-surface/40 overflow-hidden">
          {pedidos.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              Você ainda não tem pedidos. Fale com seu vendedor para começar.
            </div>
          ) : (
            pedidos.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                to="/portal/pedidos"
                className="grid grid-cols-[80px_120px_1fr_120px] gap-3 px-4 py-3 text-xs items-center border-b border-border/40 last:border-b-0 hover:bg-surface-hover transition"
              >
                <span className="font-mono text-text-muted">
                  {p.id.replace("PED-", "#")}
                </span>
                <span className="text-text-secondary">
                  {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                </span>
                <span className="text-text-primary truncate">
                  {p.commercial?.condicaoDescricao ?? p.meta.condicaoPagamento}
                </span>
                <span className="text-right text-gold font-medium">
                  {formatBRL(p.total)}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gold/30 bg-gold/5 p-5 flex flex-col md:flex-row md:items-center gap-4">
        <Sparkles className="h-6 w-6 text-gold shrink-0" />
        <div className="flex-1">
          <h3 className="font-display text-lg text-text-primary">
            Explore o catálogo
          </h3>
          <p className="text-sm text-text-secondary mt-0.5">
            Navegue pelas coleções atualizadas. Em breve você poderá fazer pedidos
            diretamente pelo portal.
          </p>
        </div>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light"
        >
          Ver catálogo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}

function Card({ label, big, sub }: { label: string; big: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
        {label}
      </div>
      <div className="font-display text-3xl text-text-primary mt-2">{big}</div>
      <div className="text-xs text-text-secondary mt-1">{sub}</div>
    </div>
  );
}
