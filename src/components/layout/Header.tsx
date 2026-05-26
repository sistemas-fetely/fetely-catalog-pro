import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, ClipboardList, Lock, LogOut, Menu, Moon, ShoppingBag, Sun, Users } from "lucide-react";
import { useOrder } from "@/store/orderStore";
import { useUI } from "@/store/uiStore";
import { useAuth } from "@/store/authStore";
import { useNegotiation } from "@/store/negotiationStore";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";

export function Header() {
  const items = useOrder((s) => s.items);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const mobileOpen = useUI((s) => s.mobileSidebarOpen);
  const setMobileOpen = useUI((s) => s.setMobileSidebarOpen);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const profile = useAuth((s) => s.profile);
  const session = useAuth((s) => s.session);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);
  const signOut = useAuth((s) => s.signOut);
  const negociacaoAtiva = useNegotiation((s) => s.ativo);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md h-16">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 md:px-6">
        {/* Mobile: hamburger to open catalog sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              className="md:hidden text-text-secondary hover:text-gold p-1"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] bg-surface border-r border-border">
            <CatalogSidebar
              forceExpanded
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <Link to="/" className="group flex items-baseline gap-2 flex-shrink-0">
          <span className="font-display text-2xl tracking-[0.2em] text-text-primary group-hover:text-gold transition">
            FETÉLY
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            B2B Orders
          </span>
        </Link>

        <div className="hidden md:flex flex-1 justify-center">
          <GlobalSearch />
        </div>

        <nav className="ml-auto flex items-center gap-4 md:gap-6 text-sm">
          <Link
            to="/catalog"
            className={`hidden md:inline uppercase tracking-wider text-xs transition ${
              pathname.startsWith("/catalog")
                ? "text-gold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Catálogo
          </Link>
          <Link
            to="/photos"
            className={`flex items-center gap-1.5 uppercase tracking-wider text-xs transition ${
              pathname.startsWith("/photos")
                ? "text-gold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Fotos</span>
          </Link>
          <Link
            to="/commercial"
            className={`hidden md:inline uppercase tracking-wider text-xs transition ${
              pathname.startsWith("/commercial")
                ? "text-gold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Cartilhas
          </Link>
          <Link
            to="/import"
            className={`hidden md:inline uppercase tracking-wider text-xs transition ${
              pathname.startsWith("/import")
                ? "text-gold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Importar
          </Link>
          {session && isAdminOrMaster() && (
            <Link
              to="/admin/users"
              className={`hidden md:flex items-center gap-1.5 uppercase tracking-wider text-xs transition ${
                pathname.startsWith("/admin")
                  ? "text-gold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Users className="h-4 w-4" />
              Usuários
            </Link>
          )}
          {negociacaoAtiva && (
            <Link
              to="/cart"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gold"
              title="Modo negociação ativo"
            >
              <Lock className="h-3 w-3" /> Negociação
            </Link>
          )}
          <button
            onClick={toggleTheme}
            className="text-text-secondary hover:text-gold transition p-1"
            aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <Link
            to="/cart"
            className="relative flex items-center gap-2 text-text-primary hover:text-gold transition"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline text-xs uppercase tracking-wider">
              Carrinho
            </span>
            {count > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-semibold text-background">
                {count}
              </span>
            )}
          </Link>
          {session ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-text-secondary hover:text-gold transition"
              title={profile?.nome_completo ?? profile?.email ?? "Sair"}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline text-xs uppercase tracking-wider">
                Sair
              </span>
            </button>
          ) : (
            <Link
              to="/login"
              className="text-xs uppercase tracking-wider text-text-secondary hover:text-gold transition"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>

      {/* Mobile search row */}
      <div className="md:hidden border-t border-border px-4 py-2">
        <GlobalSearch />
      </div>
    </header>
  );
}
