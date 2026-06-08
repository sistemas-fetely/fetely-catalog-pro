import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, FileClock, ClipboardList, Menu, ShoppingBag } from "lucide-react";
import { useOrder } from "@/store/orderStore";
import { useUI } from "@/store/uiStore";
import { useAuth } from "@/store/authStore";
import { useTemPermissao } from "@/store/permissoesStore";

/**
 * Bottom navigation visível apenas em mobile (< md).
 * Garante UX de app nativo: ações principais sempre a um toque.
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const items = useOrder((s) => s.items);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const setMobileOpen = useUI((s) => s.setMobileSidebarOpen);
  const session = useAuth((s) => s.session);
  const temPermissao = useTemPermissao();

  // Em modo público, não mostra o bottom-nav comercial
  if (!session) return null;

  const isActive = (prefix: string) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5 h-16">
        <li>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 w-full h-full text-text-muted hover:text-gold active:bg-surface-2 transition"
            aria-label="Abrir menu de coleções"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[9px] uppercase tracking-wider">Menu</span>
          </button>
        </li>
        <BottomItem to="/catalog" active={isActive("/catalog")} icon={<BookOpen className="h-5 w-5" />} label="Catálogo" />
        <BottomItem to="/provisoes" active={isActive("/provisoes")} icon={<FileClock className="h-5 w-5" />} label="Provisões" />
        <BottomItem to="/orders" active={isActive("/orders")} icon={<ClipboardList className="h-5 w-5" />} label="Pedidos" />
        <BottomItem
          to="/cart"
          active={isActive("/cart")}
          icon={
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-background">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </div>
          }
          label="Carrinho"
        />
      </ul>
    </nav>
  );
}

function BottomItem({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition ${
          active ? "text-gold" : "text-text-muted hover:text-text-primary"
        } active:bg-surface-2`}
      >
        {icon}
        <span className="text-[9px] uppercase tracking-wider">{label}</span>
      </Link>
    </li>
  );
}
