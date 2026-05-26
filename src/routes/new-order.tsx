import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { NumericalCandleGrid } from "@/components/catalog/NumericalCandleGrid";
import { ProductCard } from "@/components/catalog/ProductCard";
import { StepIndicator, type Step } from "@/components/ui/StepIndicator";
import {
  CATEGORIES,
  COLLECTION_ACCENT,
  collectionsByCategory,
  groupsByCollection,
  isNumericCollection,
  productsBy,
} from "@/data/products";
import { useOrder, cartTotal } from "@/store/orderStore";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/new-order")({
  head: () => ({
    meta: [
      { title: "Novo Pedido — Fetély B2B" },
      { name: "description", content: "Selecione marca, categoria, coleção e produtos." },
    ],
  }),
  component: NewOrder,
});

type Stage = "marca" | "categoria" | "colecao" | "grupo" | "produtos";

function NewOrder() {
  const [marca, setMarca] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [colecao, setColecao] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "stock" | "pre">("all");

  const stage: Stage = !marca
    ? "marca"
    : !categoria
      ? "categoria"
      : !colecao
        ? "colecao"
        : isNumericCollection(colecao)
          ? "produtos"
          : !grupo
            ? "grupo"
            : "produtos";

  const cartItems = useOrder((s) => s.items);
  const total = cartTotal(cartItems);

  const steps: Step[] = [
    { key: "marca", label: "Marca", value: marca ?? undefined },
    { key: "categoria", label: "Categoria", value: categoria ?? undefined },
    { key: "colecao", label: "Coleção", value: colecao ?? undefined },
    {
      key: "grupo",
      label: isNumericCollection(colecao ?? "") ? "Cor & Tamanho" : "Grupo",
      value: isNumericCollection(colecao ?? "") ? undefined : grupo ?? undefined,
    },
    { key: "produtos", label: "Produtos" },
  ];

  const currentIndex = ["marca", "categoria", "colecao", "grupo", "produtos"].indexOf(stage);

  const handleStepClick = (i: number) => {
    if (i <= 0) setMarca(null);
    if (i <= 1) setCategoria(null);
    if (i <= 2) setColecao(null);
    if (i <= 3) setGrupo(null);
  };

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">
        {/* Stepper lateral */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted mb-4">
            Progresso do pedido
          </div>
          <StepIndicator
            steps={steps}
            currentIndex={currentIndex}
            onStepClick={handleStepClick}
          />

          {cartItems.length > 0 && (
            <Link
              to="/cart"
              className="mt-8 block rounded-md gold-border bg-surface p-4 hover:border-gold transition"
            >
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                Carrinho
              </div>
              <div className="font-display text-xl text-gold mt-1">{formatBRL(total)}</div>
              <div className="text-xs text-text-secondary">
                {cartItems.reduce((s, i) => s + i.quantity, 0)} unidades
              </div>
              <div className="flex items-center gap-1 text-xs text-text-primary mt-2">
                Revisar <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          )}
        </aside>

        {/* Conteúdo */}
        <section className="min-h-[60vh]">
          {stage === "marca" && (
            <Stage title="Selecione a marca" subtitle="Etapa 1 de 5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BrandCard onClick={() => setMarca("Fetély")} />
              </div>
            </Stage>
          )}

          {stage === "categoria" && (
            <Stage title="Categoria" subtitle="Etapa 2 de 5" onBack={() => setMarca(null)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CATEGORIES.map((c) => (
                  <CategoryCard key={c} name={c} onClick={() => setCategoria(c)} />
                ))}
              </div>
            </Stage>
          )}

          {stage === "colecao" && categoria && (
            <Stage
              title="Coleção"
              subtitle={`${categoria} · Etapa 3 de 5`}
              onBack={() => setCategoria(null)}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {collectionsByCategory(categoria).map((col) => (
                  <CollectionCard
                    key={col}
                    name={col}
                    isNumeric={isNumericCollection(col)}
                    onClick={() => setColecao(col)}
                  />
                ))}
              </div>
            </Stage>
          )}

          {stage === "grupo" && colecao && (
            <Stage
              title="Grupo de produto"
              subtitle={`${colecao} · Etapa 4 de 5`}
              onBack={() => setColecao(null)}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {groupsByCollection(colecao).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrupo(g)}
                    className="rounded-lg gold-border gold-border-hover bg-surface p-6 text-left transition"
                  >
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
                      Grupo
                    </div>
                    <div className="font-display text-2xl mt-1">{g}</div>
                  </button>
                ))}
              </div>
            </Stage>
          )}

          {stage === "produtos" && colecao && (
            <ProductsView
              colecao={colecao}
              grupo={grupo}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              onBack={() => {
                if (isNumericCollection(colecao)) setColecao(null);
                else setGrupo(null);
              }}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Stage({
  title,
  subtitle,
  children,
  onBack,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">{subtitle}</div>
          <h1 className="font-display text-4xl mt-1">{title}</h1>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-secondary hover:text-gold"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function BrandCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl gold-border gold-border-hover bg-surface p-10 text-left transition group"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">Marca</div>
      <div className="font-display text-5xl tracking-[0.18em] text-text-primary mt-3 group-hover:text-gold transition">
        FETÉLY
      </div>
      <div className="text-xs text-text-secondary mt-4 italic">
        Coleções Lumier (Luz e Momento) & Célébrée (Celebrar à Mesa)
      </div>
    </button>
  );
}

function CategoryCard({ name, onClick }: { name: string; onClick: () => void }) {
  const isLumier = name === "Luz e Momento";
  return (
    <button
      onClick={onClick}
      className="rounded-xl gold-border gold-border-hover bg-surface p-8 text-left transition group relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-30 group-hover:opacity-50 transition"
        style={{
          background: isLumier
            ? "radial-gradient(circle at top right, oklch(0.6 0.12 70), transparent 60%)"
            : "radial-gradient(circle at bottom left, oklch(0.55 0.10 200), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
          Linha {isLumier ? "Lumier" : "Célébrée"}
        </div>
        <div className="font-display text-4xl mt-2">{name}</div>
        <p className="text-xs text-text-secondary mt-3 max-w-xs">
          {isLumier
            ? "Velas decorativas e numéricas para celebrações memoráveis."
            : "Pratos, guardanapos, taças e talheres para mesas postas de luxo."}
        </p>
      </div>
    </button>
  );
}

function CollectionCard({
  name,
  isNumeric,
  onClick,
}: {
  name: string;
  isNumeric: boolean;
  onClick: () => void;
}) {
  const accent = COLLECTION_ACCENT[name] ?? "oklch(0.5 0 0)";
  return (
    <button
      onClick={onClick}
      className="rounded-lg gold-border gold-border-hover bg-surface text-left transition overflow-hidden group"
    >
      <div
        className="h-24 relative"
        style={{ background: `linear-gradient(135deg, ${accent}, oklch(0.18 0 0))` }}
      >
        <div className="absolute bottom-2 left-3 text-[9px] uppercase tracking-[0.2em] text-text-primary/90">
          Coleção
        </div>
      </div>
      <div className="p-4">
        <div className="font-display text-xl text-text-primary">{name}</div>
        {isNumeric && (
          <div className="text-[10px] text-gold uppercase tracking-wider mt-1">
            Vela Numérica · Grade 0–9
          </div>
        )}
      </div>
    </button>
  );
}

function ProductsView({
  colecao,
  grupo,
  filterStatus,
  setFilterStatus,
  onBack,
}: {
  colecao: string;
  grupo: string | null;
  filterStatus: "all" | "stock" | "pre";
  setFilterStatus: (v: "all" | "stock" | "pre") => void;
  onBack: () => void;
}) {
  const isNum = isNumericCollection(colecao);
  const products = useMemo(() => productsBy(colecao, grupo ?? undefined), [colecao, grupo]);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return products;
    return products.filter((p) => {
      const s = p.statusEstoque.toLowerCase();
      if (filterStatus === "stock") return s === "em estoque";
      if (filterStatus === "pre") return s.startsWith("prev");
      return true;
    });
  }, [products, filterStatus]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">
            Etapa 5 de 5 · {colecao}
            {grupo ? ` · ${grupo}` : ""}
          </div>
          <h1 className="font-display text-4xl mt-1">
            {isNum ? "Monte sua grade de números" : "Produtos disponíveis"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {!isNum && (
            <div className="flex items-center gap-1 rounded-md border border-border p-1 bg-surface">
              {(["all", "stock", "pre"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded transition ${
                    filterStatus === f
                      ? "bg-gold text-background"
                      : "text-text-secondary hover:text-gold"
                  }`}
                >
                  {f === "all" ? "Todos" : f === "stock" ? "Estoque" : "Pré-venda"}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-secondary hover:text-gold"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
        </div>
      </div>

      {isNum ? (
        <NumericalCandleGrid products={products} colecao={colecao} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.sku} product={p} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-text-muted text-sm">
              Nenhum produto neste filtro.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
