import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ClipboardList, Package, BookOpen, User as UserIcon, ShoppingCart } from "lucide-react";
import { useOrder } from "@/store/orderStore";

type Item = {
  to: string;
  label: string;
  Icon: typeof Home;
  exact?: boolean;
  divider?: boolean;
  badgeKey?: "cart";
};

const items: Item[] = [
  { to: "/portal", label: "Início", Icon: Home, exact: true },
  { to: "/catalog", label: "Catálogo", Icon: BookOpen },
  { to: "/cart", label: "Meu Carrinho", Icon: ShoppingCart, badgeKey: "cart" },
  { to: "/portal/pedidos", label: "Meus Pedidos", Icon: ClipboardList },
  { to: "/portal/provisoes", label: "Provisões", Icon: Package },
  { to: "/portal/conta", label: "Minha Conta", Icon: UserIcon, divider: true },
];

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-surface/40 min-h-[calc(100vh-4rem)] py-6 px-3">
      <div className="px-3 mb-6">
        <div className="font-display text-xl tracking-[0.25em] text-text-primary">FETÉLY</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted mt-0.5">
          Portal do Cliente
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((it) => {
          const active = it.exact
            ? pathname === it.to
            : pathname === it.to || pathname.startsWith(it.to + "/");
          return (
            <span key={it.to}>
              {it.divider && (
                <div className="my-2 mx-2 h-px bg-border" />
              )}
              <Link
                to={it.to}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active
                    ? "bg-gold/10 text-gold"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`}
              >
                <it.Icon className="h-4 w-4" />
                <span>{it.label}</span>
              </Link>
            </span>
          );
        })}
      </nav>
    </aside>
  );
}
