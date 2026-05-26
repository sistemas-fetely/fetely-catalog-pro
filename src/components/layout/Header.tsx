import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useOrder } from "@/store/orderStore";

export function Header() {
  const items = useOrder((s) => s.items);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-[0.2em] text-text-primary group-hover:text-gold transition">
            FETÉLY
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            B2B Orders
          </span>
        </Link>
        <nav className="flex items-center gap-8 text-sm">
          <Link
            to="/"
            className={`uppercase tracking-wider text-xs transition ${
              pathname === "/" ? "text-gold" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Início
          </Link>
          <Link
            to="/new-order"
            className={`uppercase tracking-wider text-xs transition ${
              pathname.startsWith("/new-order")
                ? "text-gold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Novo Pedido
          </Link>
          <Link
            to="/cart"
            className="relative flex items-center gap-2 text-text-primary hover:text-gold transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Carrinho</span>
            {count > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-semibold text-background">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
