import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ShoppingBag, Sparkles, Truck } from "lucide-react";
import {
  CONDICOES_PAGAMENTO,
  FAIXAS,
  type Faixa,
} from "@/lib/commercial";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/commercial")({
  head: () => ({
    meta: [
      { title: "Cartilhas Comerciais — Fetély B2B" },
      {
        name: "description",
        content:
          "Faixas, descontos, frete e condições de pagamento Fetély — referência completa para vendedores.",
      },
      { property: "og:title", content: "Cartilhas Comerciais — Fetély B2B" },
      {
        property: "og:description",
        content: "Tabela completa de faixas e condições comerciais Fetély.",
      },
    ],
  }),
  component: CommercialPage,
});

function CommercialPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-6 py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">
            Manual Fetély
          </div>
          <h1 className="font-display text-5xl mt-2">Cartilhas Comerciais</h1>
          <p className="text-text-secondary mt-2 max-w-2xl text-sm">
            Faixas progressivas por volume de pedido com descontos, frete e
            condições de pagamento. Use no carrinho a opção{" "}
            <strong className="text-gold">Modo Negociação</strong> para liberar
            condições extras e elevar a faixa do cliente.
          </p>
        </div>

        <Link
          to="/cart"
          className="inline-flex items-center gap-2 rounded-md gold-border px-4 py-3 text-xs uppercase tracking-wider text-gold hover:bg-gold/10"
        >
          <ShoppingBag className="h-4 w-4" /> Ir para o carrinho
        </Link>
      </header>

      {/* Cards de faixas — todas visíveis para referência */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {FAIXAS.map((f) => (
          <FaixaCard key={f.id} faixa={f} />
        ))}
      </section>


      {/* Tabela de condições */}
      <section className="mt-14">
        <div className="mb-5">
          <h2 className="font-display text-3xl">Condições de pagamento</h2>
        </div>
        <div className="rounded-lg gold-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-right">Pedido mínimo</th>
                <th className="px-4 py-3 text-center">Faixas que liberam</th>
              </tr>
            </thead>
            <tbody>
              {CONDICOES_PAGAMENTO.map((c) => {
                const faixasLib = FAIXAS.filter((f) =>
                  f.condicoesDisponiveis.includes(c.id),
                );
                return (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-mono text-text-muted text-xs">
                      {c.id.toString().padStart(2, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <TipoBadge tipo={c.tipo} />
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {c.descricao}
                    </td>
                    <td className="px-4 py-3 text-right text-gold">
                      {formatBRL(c.valorMinimo)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {FAIXAS.map((f) => {
                          const has = faixasLib.includes(f);
                          return (
                            <span
                              key={f.id}
                              title={f.nome}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                                has
                                  ? "bg-gold/20 text-gold border border-gold/40"
                                  : "bg-surface-2 text-text-muted/40 border border-border"
                              }`}
                            >
                              {f.id}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Regras / legenda */}
      <section className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          title="Pedido mínimo"
          body="O pedido mínimo geral é de R$ 2.500. Abaixo disso, o pedido não pode ser finalizado."
        />
        <InfoCard
          title="Bônus PIX"
          body="Pagamento antecipado em PIX concede +2,5% de desconto adicional (exceto Faixa 5)."
        />
        <InfoCard
          title="Frete CIF"
          body="A partir da Faixa 2 (Anfitrião), o frete é por conta da Fetély. Faixa 1 é FOB."
        />
      </section>
    </main>
  );
}

function FaixaCard({ faixa }: { faixa: Faixa }) {
  const isReservada = !!faixa.requerSenhaMaster;
  return (
    <article
      className={`relative rounded-lg p-5 flex flex-col gap-3 transition ${
        isReservada
          ? "border border-gold bg-gradient-to-br from-gold/10 to-transparent"
          : "gold-border bg-surface"
      }`}
    >
      {isReservada && (
        <span className="absolute top-3 right-3 rounded-full bg-gold px-2 py-0.5 text-[9px] uppercase tracking-wider text-background">
          Master
        </span>
      )}
      <header>
        <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
          Faixa {faixa.id}
        </div>
        <h3 className="font-display text-3xl text-gold flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> {faixa.nome}
        </h3>
        <p className="text-xs text-text-muted mt-1">
          {formatBRL(faixa.valorMin)}
          {faixa.valorMax === Infinity ? " +" : ` – ${formatBRL(faixa.valorMax)}`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric
          label="Desconto"
          value={`${faixa.descontoCelebra}%`}
          accent
        />
        <Metric
          label="Bônus PIX"
          value={faixa.bonusPix > 0 ? `+${faixa.bonusPix}%` : "—"}
        />
        <Metric label="Total c/ PIX" value={`${faixa.totalComPix}%`} accent />
        <Metric
          label="Prazo médio"
          value={`${faixa.prazoMedioBoleto} dias`}
        />
      </div>

      <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
        <Truck className="h-3.5 w-3.5 text-gold" />
        {faixa.frete === "CIF" ? (
          <span>
            Frete <strong className="text-gold">CIF</strong> — Fetély entrega
          </span>
        ) : (
          <span>
            Frete <strong>FOB</strong> — por conta do lojista
          </span>
        )}
      </div>

      <ul className="text-xs space-y-1 text-text-secondary">
        <li className="flex gap-2">
          <Check className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
          Cartão até {faixa.cartaoAte}
        </li>
        <li className="flex gap-2">
          <Check className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
          Boleto até {faixa.boletoAte}
        </li>
        <li className="flex gap-2">
          <Check className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
          {faixa.condicoesDisponiveis.length} condições de pagamento
        </li>
      </ul>
    </article>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div
        className={`mt-0.5 font-display text-lg ${
          accent ? "text-gold" : "text-text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: "pix" | "boleto" | "cartao" }) {
  const map = {
    pix: { label: "PIX", cls: "bg-gold/15 text-gold border-gold/40" },
    boleto: {
      label: "Boleto",
      cls: "bg-surface-2 text-text-secondary border-border",
    },
    cartao: {
      label: "Cartão",
      cls: "bg-surface-2 text-text-secondary border-border",
    },
  } as const;
  const m = map[tipo];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg gold-border bg-surface p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
        {title}
      </div>
      <p className="text-sm text-text-secondary mt-2">{body}</p>
    </div>
  );
}
