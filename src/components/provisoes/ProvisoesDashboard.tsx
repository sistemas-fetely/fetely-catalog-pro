import { useMemo, useState } from "react";
import { Package, Clock, CheckCircle2, TrendingUp, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useCatalog } from "@/store/catalogStore";
import type { ProvisaoFutura } from "@/types/provisao";
import { compararPrevisao } from "@/lib/classifyItem";

interface Props {
  provisoes: ProvisaoFutura[];
}


const BUCKET_ORDER = ["Celebrar a mesa", "Luz", "Momento"];

function bucketPorProduto(product?: { categoria: string; grupo?: string; tipo?: string }): string {
  if (!product) return "Sem categoria";
  if (product.categoria === "Celebrar à Mesa") return "Celebrar a mesa";
  if (product.categoria === "Luz e Momento") {
    return product.tipo === "Numérica" ? "Momento" : "Luz";
  }
  if (product.categoria === "Acessórios de Mesa") return "Celebrar a mesa";
  return product.categoria || "Sem categoria";
}

export function ProvisoesDashboard({ provisoes }: Props) {
  const products = useCatalog((s) => s.products);
  const [expanded, setExpanded] = useState<string | null>(null);


  const bucketBySku = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.sku, bucketPorProduto(p)));
    return m;
  }, [products]);

  const abertas = useMemo(
    () =>
      provisoes.filter(
        (p) =>
          !p.reprovado &&
          (p.status === "aguardando_estoque" || p.status === "estoque_liberado"),
      ),
    [provisoes],
  );

  const kpis = useMemo(() => {
    const aguardando = abertas.filter((p) => p.status === "aguardando_estoque");
    const liberado = abertas.filter((p) => p.status === "estoque_liberado");
    const convertidas = provisoes.filter((p) => p.status === "convertido_em_pedido");
    const sum = (arr: ProvisaoFutura[]) =>
      arr.reduce((s, p) => s + Number(p.totalReferencia || 0), 0);
    return {
      aberto: { count: abertas.length, valor: sum(abertas) },
      aguardando: { count: aguardando.length, valor: sum(aguardando) },
      liberado: { count: liberado.length, valor: sum(liberado) },
      convertidas: { count: convertidas.length, valor: sum(convertidas) },
    };
  }, [abertas, provisoes]);

  // Agrupamento por categoria de negócio (a partir dos itens abertos)
  const porBucket = useMemo(() => {
    type Item = { sku: string; nome: string; unidades: number; valor: number };
    const map = new Map<
      string,
      {
        bucket: string;
        unidades: number;
        valor: number;
        provisoes: Set<string>;
        itens: Map<string, Item>;
      }
    >();
    const productBySku = new Map(products.map((p) => [p.sku, p]));
    abertas.forEach((p) => {
      p.itens.forEach((it) => {
        const bucket = bucketBySku.get(it.sku) ?? "Sem categoria";
        const cur =
          map.get(bucket) ??
          {
            bucket,
            unidades: 0,
            valor: 0,
            provisoes: new Set<string>(),
            itens: new Map<string, Item>(),
          };
        const qtd = Number(it.quantidade || 0);
        const valor = qtd * Number(it.precoAtacadoReferencia || 0);
        cur.unidades += qtd;
        cur.valor += valor;
        cur.provisoes.add(p.id);
        const prod = productBySku.get(it.sku);
        const nome = prod
          ? `${prod.nomeComercial || prod.sku}${prod.corNome ? ` · ${prod.corNome}` : ""}${prod.tamanhoNumero ? ` · ${prod.tamanhoNumero}` : ""}`
          : it.sku;
        const existing = cur.itens.get(it.sku) ?? { sku: it.sku, nome, unidades: 0, valor: 0 };
        existing.unidades += qtd;
        existing.valor += valor;
        cur.itens.set(it.sku, existing);
        map.set(bucket, cur);
      });
    });
    return Array.from(map.values())
      .map((v) => ({
        ...v,
        provisoesQtd: v.provisoes.size,
        itensList: Array.from(v.itens.values()).sort((a, b) => b.valor - a.valor),
      }))
      .sort((a, b) => {
        const ia = BUCKET_ORDER.indexOf(a.bucket);
        const ib = BUCKET_ORDER.indexOf(b.bucket);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return b.valor - a.valor;
      });
  }, [abertas, bucketBySku, products]);


  const totalBucketValor = porBucket.reduce((s, d) => s + d.valor, 0);

  // Esteira: agrupar por proximaPrevisao
  const esteira = useMemo(() => {
    const map = new Map<
      string,
      { previsao: string; count: number; valor: number; unidades: number }
    >();
    abertas.forEach((p) => {
      const key = p.proximaPrevisao || "—";
      const cur = map.get(key) ?? { previsao: key, count: 0, valor: 0, unidades: 0 };
      cur.count += 1;
      cur.valor += Number(p.totalReferencia || 0);
      cur.unidades += p.itens.reduce((s, i) => s + Number(i.quantidade || 0), 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => compararPrevisao(a.previsao, b.previsao));
  }, [abertas]);

  const maxEsteiraValor = Math.max(1, ...esteira.map((e) => e.valor));

  if (provisoes.length === 0) return null;

  return (
    <section className="mb-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          icon={<Package className="h-3.5 w-3.5" />}
          label="Em aberto"
          value={String(kpis.aberto.count)}
          hint={formatBRL(kpis.aberto.valor)}
          accent
        />
        <Kpi
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Aguardando estoque"
          value={String(kpis.aguardando.count)}
          hint={formatBRL(kpis.aguardando.valor)}
        />
        <Kpi
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Estoque liberado"
          value={String(kpis.liberado.count)}
          hint={formatBRL(kpis.liberado.valor)}
          highlight={kpis.liberado.count > 0}
        />
        <Kpi
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Convertidas"
          value={String(kpis.convertidas.count)}
          hint={formatBRL(kpis.convertidas.valor)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por categoria de negócio */}
        <div className="rounded-lg gold-border bg-surface overflow-hidden">
          <header className="px-4 py-2.5 border-b border-border bg-surface-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
            <Layers className="h-3.5 w-3.5 text-gold" />
            Por categoria (em aberto)
          </header>
          <div className="px-4 py-2 text-[10px] text-text-muted border-b border-border/50 bg-surface/40 space-y-1">
            <div><span className="font-medium text-text-primary">Celebrar a mesa</span> = categoria Celebrar à Mesa + Acessórios de Mesa</div>
            <div><span className="font-medium text-text-primary">Luz</span> = Luz e Momento velas decorativas</div>
            <div><span className="font-medium text-text-primary">Momento</span> = Luz e Momento velas numéricas</div>
          </div>
          {porBucket.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">
              Sem provisões em aberto.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {porBucket.map((d) => {
                const pct = totalBucketValor > 0 ? (d.valor / totalBucketValor) * 100 : 0;
                return (
                  <li key={d.bucket} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm text-text-primary truncate">{d.bucket}</div>
                      <div className="text-sm text-gold font-medium whitespace-nowrap">
                        {formatBRL(d.valor)}
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full bg-gold/70"
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-text-muted">
                      <span>
                        {d.provisoesQtd} provisão{d.provisoesQtd !== 1 ? "ões" : ""} ·{" "}
                        {d.unidades.toLocaleString("pt-BR")} un.
                      </span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Esteira por previsão */}
        <div className="rounded-lg gold-border bg-surface overflow-hidden">
          <header className="px-4 py-2.5 border-b border-border bg-surface-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
            <Clock className="h-3.5 w-3.5 text-gold" />
            Esteira por previsão
          </header>
          {esteira.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">
              Nenhuma previsão em aberto.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {esteira.map((e) => {
                const pct = (e.valor / maxEsteiraValor) * 100;
                return (
                  <li key={e.previsao} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm text-text-primary truncate">
                        {e.previsao}
                      </div>
                      <div className="text-sm text-stock-pre font-medium whitespace-nowrap">
                        {formatBRL(e.valor)}
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full bg-stock-pre/70"
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-text-muted">
                      {e.count} provisão{e.count !== 1 ? "ões" : ""} ·{" "}
                      {e.unidades.toLocaleString("pt-BR")} un.
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  accent,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md p-3 " +
        (accent
          ? "border border-gold/50 bg-gradient-to-br from-gold/10 to-transparent"
          : highlight
            ? "border border-stock-in/40 bg-stock-in/5"
            : "gold-border bg-surface")
      }
    >
      <div className="flex items-center gap-1.5 text-text-muted text-[10px] uppercase tracking-[0.18em]">
        <span className={accent ? "text-gold" : highlight ? "text-stock-in" : "text-gold"}>
          {icon}
        </span>
        {label}
      </div>
      <div
        className={
          "font-display mt-1 text-2xl " +
          (accent ? "text-gold" : highlight ? "text-stock-in" : "text-text-primary")
        }
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-text-muted mt-0.5">{hint}</div>}
    </div>
  );
}
