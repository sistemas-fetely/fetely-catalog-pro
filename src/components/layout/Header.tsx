import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ClipboardList, FileClock, Lock, LogOut, Menu, Moon, Settings, ShoppingBag, Sun, User, Users } from "lucide-react";
import { useOrder } from "@/store/orderStore";
import { useUI } from "@/store/uiStore";
import { useAuth } from "@/store/authStore";
import { useNegotiation } from "@/store/negotiationStore";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CatalogSidebar } from "@/components/layout/CatalogSidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const authLoading = useAuth((s) => s.loading);
  const roles = useAuth((s) => s.roles);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);
  const signOut = useAuth((s) => s.signOut);
  const negociacaoAtiva = useNegotiation((s) => s.ativo);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const navLinkClass = (active: boolean) =>
    `hidden md:flex items-center gap-1.5 uppercase tracking-wider text-xs transition ${
      active ? "text-gold" : "text-text-secondary hover:text-text-primary"
    }`;

  const iconBtnClass =
    "text-text-secondary hover:text-gold hover:bg-surface-hover transition p-2 rounded-md";

  const initials = (() => {
    const name = profile?.nome_completo ?? profile?.email ?? "?";
    return name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("");
  })();

  const roleLabel = authLoading
    ? "Carregando"
    : roles.includes("master")
    ? "Master"
    : roles.includes("admin")
    ? "Admin"
    : profile?.tipo_vendedor === "representante"
    ? "Representante"
    : "Interno";

  const isPublic = !session;

  return (
    <TooltipProvider delayDuration={200}>
      {isPublic && (
        <div className="w-full bg-gold/10 border-b border-gold/30 text-center py-1.5 text-[10px] uppercase tracking-[0.18em] text-gold">
          Modo visualização — Faça login para acessar o sistema completo
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md h-16">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 md:px-6">
          {/* Mobile: hamburger */}
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
              <CatalogSidebar forceExpanded onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>


          {/* Brand */}
          <Link to="/" className="group flex items-baseline gap-2 flex-shrink-0">
            <span className="font-display text-2xl tracking-[0.2em] text-text-primary group-hover:text-gold transition">
              FETÉLY
            </span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.3em] text-gold-muted">
              B2B Orders
            </span>
          </Link>

          {/* Primary nav (left group) */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            <Link to="/catalog" className={navLinkClass(pathname.startsWith("/catalog"))}>
              <span className="px-2 py-1.5">Catálogo</span>
            </Link>
            <Link to="/orders" className={navLinkClass(pathname.startsWith("/orders"))}>
              <ClipboardList className="h-4 w-4" />
              <span className="hidden lg:inline px-1 py-1.5">Pedidos</span>
            </Link>
            <Link to="/clientes" className={navLinkClass(pathname.startsWith("/clientes"))}>
              <Users className="h-4 w-4" />
              <span className="hidden lg:inline px-1 py-1.5">Clientes</span>
            </Link>
            <Link to="/provisoes" className={navLinkClass(pathname.startsWith("/provisoes"))}>
              <FileClock className="h-4 w-4" />
              <span className="hidden lg:inline px-1 py-1.5">Provisões</span>
            </Link>
          </nav>

          {/* Search (center) */}
          <div className="hidden md:flex flex-1 justify-center max-w-xl mx-auto">
            <GlobalSearch />
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {negociacaoAtiva && (
              <Link
                to="/cart"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gold shadow-[0_0_0_0_rgba(201,168,76,0.5)] animate-pulse"
                title="Modo negociação ativo"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                <Lock className="h-3 w-3" /> Negociação
              </Link>
            )}

            {/* Settings link */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/settings"
                  className={`hidden md:flex items-center justify-center p-2 rounded-md transition ${
                    pathname.startsWith("/settings") ||
                    pathname.startsWith("/photos") ||
                    pathname.startsWith("/commercial") ||
                    pathname.startsWith("/import") ||
                    pathname.startsWith("/admin")
                      ? "text-gold bg-surface-hover"
                      : "text-text-secondary hover:text-gold hover:bg-surface-hover"
                  }`}
                  aria-label="Configurações"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">Configurações</TooltipContent>
            </Tooltip>

            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleTheme}
                  className={iconBtnClass}
                  aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {theme === "dark" ? "Modo claro" : "Modo escuro"}
              </TooltipContent>
            </Tooltip>

            {/* Cart icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/cart"
                  className={`relative ${iconBtnClass} ${
                    pathname.startsWith("/cart") ? "text-gold" : ""
                  }`}
                  aria-label="Carrinho"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-background">
                      {count}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Carrinho{count > 0 ? ` (${count})` : ""}
              </TooltipContent>
            </Tooltip>

            <div className="hidden md:block h-6 w-px bg-border mx-1" />

            {/* Profile menu */}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-md pl-1 pr-2 py-1 hover:bg-surface-hover transition"
                    aria-label="Menu do usuário"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 border border-gold/40 text-[11px] font-semibold text-gold tracking-wider">
                      {initials || <User className="h-4 w-4" />}
                    </span>
                    <span className="hidden lg:flex flex-col items-start leading-tight">
                      <span className="text-xs text-text-primary max-w-[120px] truncate">
                        {profile?.login_amigavel ?? profile?.nome_completo ?? profile?.email}
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.15em] text-text-secondary">
                        {roleLabel}
                      </span>
                    </span>
                    <ChevronDown className="hidden lg:inline h-3 w-3 text-text-secondary" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 bg-surface border border-border">
                  <div className="px-2 py-2">
                    <p className="text-sm text-text-primary truncate">
                      {profile?.nome_completo ?? profile?.email}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate">
                      {profile?.email}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      {roles.includes("master") ? (
                        <span className="rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-gold font-medium">
                          Master
                        </span>
                      ) : roles.includes("admin") ? (
                        <span className="rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-gold font-medium">
                          Admin
                        </span>
                      ) : profile?.tipo_vendedor === "representante" ? (
                        <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-gold-muted">
                          Rep
                        </span>
                      ) : (
                        <span className="rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-text-secondary">
                          Interno
                        </span>
                      )}
                      {profile?.login_amigavel && (
                        <span className="text-[10px] text-text-secondary font-mono">
                          {profile.login_amigavel}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="flex items-center gap-2 cursor-pointer text-text-secondary focus:text-gold"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className="text-xs uppercase tracking-wider text-text-secondary hover:text-gold transition px-2"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>

        {/* Mobile search row */}
        <div className="md:hidden border-t border-border px-4 py-2">
          <GlobalSearch />
        </div>
      </header>
    </TooltipProvider>
  );
}
