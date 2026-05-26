import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Package, ShoppingBag, Sparkles, Upload } from "lucide-react";
import { useCatalog } from "@/store/catalogStore";
import { formatBRL } from "@/lib/format";
import { useOrder, cartTotal } from "@/store/orderStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fetély — Sistema B2B de Pedidos" },
      {
        name: "description",
        content: "Painel inicial do sistema de pedidos para representantes Fetély.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const items = useOrder((s) => s.items);
  const history = useOrder((s) => s.history);
  const products = useCatalog((s) => s.products);
  const catalogSource = useCatalog((s) => s.source);
  const total = cartTotal(items);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  const todayCount = history.filter((h) => {
    const d = new Date(h.createdAt);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }).length;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-16">
      <div className="text-center space-y-3 mb-16">
        <div className="text-[10px] uppercase tracking-[0.4em] text-gold-muted">
          Bem-vindo(a), representante
        </div>
        <h1 className="font-display text-6xl md:text-7xl tracking-tight">
          Catálogo <span className="italic text-gold">Fetély</span>
        </h1>
        <p className="text-text-secondary max-w-xl mx-auto text-sm leading-relaxed">
          Registre pedidos para lojistas e parceiros com a curadoria completa das
          coleções <em>Lumier</em> e <em>Célébrée</em>.
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Catálogo ativo"
          value={`${products.length} SKUs`}
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Carrinho atual"
          value={totalUnits > 0 ? formatBRL(total) : "—"}
          hint={totalUnits > 0 ? `${totalUnits} itens` : "Vazio"}
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Pedidos hoje"
          value={String(todayCount)}
          hint={`${history.length} no histórico`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/new-order"
          className="md:col-span-2 group relative overflow-hidden rounded-xl gold-border gold-border-hover bg-surface p-10 transition"
        >
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl group-hover:bg-gold/20 transition" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold">
              Iniciar
            </div>
            <h2 className="font-display text-5xl mt-3 mb-4">Novo Pedido</h2>
            <p className="text-text-secondary max-w-md text-sm">
              Navegue pelo catálogo em cascata: Marca → Categoria → Coleção →
              Grupo → Produto.
            </p>
            <div className="flex items-center gap-2 mt-8 text-gold font-medium uppercase tracking-wider text-xs">
              Começar agora
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        <Link
          to="/cart"
          className="group rounded-xl gold-border gold-border-hover bg-surface p-8 transition flex flex-col"
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            Em andamento
          </div>
          <h3 className="font-display text-3xl mt-2">Carrinho</h3>
          <div className="mt-auto pt-8">
            <div className="text-3xl font-display text-gold">
              {totalUnits > 0 ? formatBRL(total) : "Vazio"}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              {totalUnits > 0 ? `${totalUnits} unidades` : "Adicione produtos para começar"}
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg gold-border bg-surface p-5 flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-gold/10 text-gold flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted">
          {label}
        </div>
        <div className="font-display text-xl text-text-primary leading-tight">
          {value}
        </div>
        {hint && <div className="text-[10px] text-text-secondary">{hint}</div>}
      </div>
    </div>
  );
}
