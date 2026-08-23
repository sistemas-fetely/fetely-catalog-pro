import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  FileText,
  FileClock,
  CalendarDays,
  Users,
  BarChart3,
  Settings,
  ShoppingBag,
  Home,
  Image as ImageIcon,
  Upload,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/store/authStore";
import { useTemPermissao } from "@/store/permissoesStore";
import { usePreSelecao, usePreSelecoesEscopo } from "@/store/preSelecaoStore";
import { useEffect } from "react";

type Item = {
  to: string;
  label: string;
  Icon: typeof Home;
  tela?: string;
  exact?: boolean;
  badge?: number;
  adminOnly?: boolean;
};

/**
 * Painel de navegação mobile — espelha a nav do desktop (Header + dropdowns)
 * em uma lista compacta, respeitando permissões e papéis.
 * Renderizado no topo do Sheet mobile antes do CatalogSidebar.
 */
export function MobileNavPanel({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const temPermissao = useTemPermissao();
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster());
  const hydrate = usePreSelecao((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  const lista = usePreSelecoesEscopo();
  const reunioesNovas = lista.filter((p) => p.status === "nova").length;

  const primary: Item[] = [
    { to: "/", label: "Início", Icon: Home, exact: true },
    { to: "/catalog", label: "Catálogo", Icon: BookOpen, tela: "catalogo" },
    { to: "/cart", label: "Carrinho", Icon: ShoppingBag },
  ];

  const comercial: Item[] = [
    { to: "/orders", label: "Pedidos", Icon: ClipboardList, tela: "pedidos_lista" },
    { to: "/cotacoes", label: "Cotações", Icon: FileText, tela: "cotacoes_lista" },
    { to: "/provisoes", label: "Provisões", Icon: FileClock, tela: "provisoes_lista" },
  ];

  const operacional: Item[] = [
    { to: "/reunioes", label: "Reuniões", Icon: CalendarDays, badge: reunioesNovas },
    { to: "/clientes", label: "Clientes", Icon: Users, tela: "clientes_lista" },
    { to: "/dashboard", label: "Dashboard", Icon: BarChart3, tela: "dashboard" },
    { to: "/academia", label: "Academia", Icon: GraduationCap, tela: "academia" },
  ];

  const admin: Item[] = [
    { to: "/photos", label: "Fotos", Icon: ImageIcon, tela: "fotos_gerenciar" },
    { to: "/import", label: "Importar", Icon: Upload, tela: "cfg_produtos_importar" },
    { to: "/admin/academia", label: "Academia (conteúdo)", Icon: GraduationCap, adminOnly: true },
    { to: "/admin/permissoes", label: "Permissões", Icon: ShieldCheck, adminOnly: true },
    { to: "/settings", label: "Configurações", Icon: Settings },
  ];

  const roles = useAuth((s) => s.roles);
  const profile = useAuth((s) => s.profile);
  const isRepresentante =
    !isAdminOrMaster &&
    roles.includes("vendedor") &&
    profile?.tipo_vendedor === "representante";

  const filter = (items: Item[]) =>
    items.filter((it) => {
      if (it.adminOnly && !isAdminOrMaster) return false;
      if (isRepresentante && ["/settings", "/photos", "/import", "/dashboard"].includes(it.to))
        return false;
      if (it.tela && !temPermissao(it.tela, "ver")) return false;
      return true;
    });


  const isActive = (it: Item) =>
    it.exact ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/");

  const renderGroup = (title: string, items: Item[]) => {
    const visible = filter(items);
    if (visible.length === 0) return null;
    return (
      <div className="py-1">
        <div className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-[0.25em] text-gold-muted">
          {title}
        </div>
        <ul>
          {visible.map((it) => {
            const active = isActive(it);
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-gold/10 text-gold"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  <it.Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.badge !== undefined && it.badge > 0 && (
                    <span className="ml-auto inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                      {it.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <nav className="border-b border-border bg-surface/60" aria-label="Navegação mobile">
      {renderGroup("Principal", primary)}
      {renderGroup("Comercial", comercial)}
      {renderGroup("Operacional", operacional)}
      {renderGroup("Administração", admin)}
    </nav>
  );
}
