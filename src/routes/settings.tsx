import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Building,
  Camera,
  ChevronRight,
  CreditCard,
  Layers,
  Settings,
  Upload,
  Package,
  Users,
  ExternalLink,
  Target,
  FileStack,
  History,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/store/authStore";
import { useTemPermissao } from "@/store/permissoesStore";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type Badge = "auditoria" | "log" | "nova-aba";

type Item = {
  label: string;
  description: string;
  to: string;
  icon: typeof Settings;
  external?: boolean;
  tela?: string;
  badge?: Badge;
};

type Section = {
  title: string;
  items: Item[];
};

function SettingsPage() {
  const session = useAuth((s) => s.session);
  const roles = useAuth((s) => s.roles);
  const isAdminOrMaster = roles.includes("admin") || roles.includes("master");
  const temPermissao = useTemPermissao();

  const secoes: Section[] = [
    {
      title: "Catálogo & Produtos",
      items: [
        ...(session && isAdminOrMaster
          ? [
              {
                label: "Cadastro de Produtos",
                description:
                  "Nascimento do Produto: rascunho com ficha técnica e publicação validada pelo SNCF",
                to: "/admin/nascimento-produto",
                icon: Package,
                tela: "cfg_produtos",
              } as Item,
              {
                label: "Produtos",
                description: "Cadastrar, editar e desativar produtos do catálogo",
                to: "/admin/products",
                icon: Package,
                tela: "cfg_produtos",
              } as Item,
            ]
          : []),
        {
          label: "Fotos",
          description: "Gerenciar fotos do catálogo",
          to: "/photos",
          icon: Camera,
          tela: "fotos_gerenciar",
        },
        ...(session && isAdminOrMaster
          ? [
              {
                label: "Tabela de Preço",
                description: "Histórico de alterações de preço dos produtos",
                to: "/admin/precos",
                icon: History,
                tela: "cfg_produtos",
                badge: "auditoria" as Badge,
              } as Item,
            ]
          : []),
        {
          label: "Importar",
          description: "Importar dados do sistema via planilhas",
          to: "/import",
          icon: Upload,
          tela: "cfg_produtos_importar",
        },
      ],
    },
    {
      title: "Comercial & Regras de Pedido",
      items: [
        ...(session && isAdminOrMaster
          ? [
              {
                label: "Cartilhas & Níveis",
                description: "Faixas, condições de pagamento e regras gerais",
                to: "/admin/cartilhas",
                icon: Layers,
                tela: "cfg_cartilhas",
              } as Item,
            ]
          : []),
        {
          label: "Cartilhas Comerciais",
          description: "Gerenciar cartilhas comerciais",
          to: "/commercial",
          icon: BookOpen,
          tela: "cfg_cartilhas",
        },
        {
          label: "Pedido Original",
          description: "Pedido firme + provisões vinculadas, somados por pedido",
          to: "/pedido-original",
          icon: FileStack,
          tela: "pedidos_detalhe",
        },
        {
          label: "Condições de Pagamento",
          description: "Visualizar tabela completa de formas de pagamento",
          to: "/condicoes-pagamento",
          icon: CreditCard,
          tela: "cfg_condicoes_editar",
        },
      ],
    },
    {
      title: "Usuários & Segurança",
      items:
        session && isAdminOrMaster
          ? [
              {
                label: "Usuários",
                description: "Gerenciar vendedores e acessos do sistema",
                to: "/admin/users",
                icon: Users,
                tela: "cfg_vendedores",
              },
              {
                label: "Permissões",
                description: "Acessos por perfil, grupo e exceções individuais",
                to: "/admin/permissoes",
                icon: Lock,
                tela: "cfg_permissoes",
              },
              {
                label: "Gestão de Acessos",
                description:
                  "Histórico de logins e eventos de criação/alteração de acessos",
                to: "/admin/access-logs",
                icon: ShieldCheck,
                badge: "log" as Badge,
              },
            ]
          : [],
    },
    {
      title: "Leads & Feiras",
      items: [
        {
          label: "Captação de Leads",
          description: "Tela para cadastro de visitantes no stand em feiras",
          to: "/stand",
          icon: Building,
          tela: "cfg_leads",
        },
        {
          label: "Gestão de Leads",
          description: "Leads captados via formulário de qualificação",
          to: "/admin/leads",
          icon: Target,
          tela: "cfg_leads",
        },
      ],
    },
    {
      title: "Canais Externos",
      items: [
        {
          label: "Portal do Cliente",
          description: "Abrir o portal do lojista em uma nova aba",
          to: "/portal",
          icon: ExternalLink,
          external: true,
          badge: "nova-aba",
        },
        {
          label: "Catálogo Público",
          description:
            "Link público do catálogo (varejo + previsão), sem login. Compartilhe a URL.",
          to: "https://fetely-catalog-pro.lovable.app/catalog",
          icon: Package,
          external: true,
          badge: "nova-aba",
        },
      ],
    },
  ];

  // Filtra pelas permissões granulares (admin sempre passa)
  const secoesFiltradas = secoes
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !it.tela || temPermissao(it.tela, "ver")),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <Settings className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-text-primary">Configurações</h1>
            <p className="text-sm text-text-secondary">
              Gerencie os módulos e opções do sistema
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {secoesFiltradas.map((section) => (
            <section key={section.title}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-[10px] uppercase tracking-[0.28em] text-gold font-semibold">
                  {section.title}
                </h2>
                <div className="flex-1 h-px bg-gold/20" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.items.map((item) => (
                  <SettingsCard key={item.to + item.label} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ item }: { item: Item }) {
  const inner = (
    <>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/10 transition group-hover:bg-gold/20">
        <item.icon className="h-5 w-5 text-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {item.label}
          </h3>
          {item.badge && <BadgeSelo badge={item.badge} />}
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">{item.description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary transition group-hover:translate-x-1 group-hover:text-gold" />
    </>
  );
  const className =
    "group flex items-center gap-4 rounded-xl border border-border bg-surface p-5 transition hover:border-gold/40 hover:bg-surface-hover";

  if (item.external) {
    return (
      <a href={item.to} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={item.to} className={className}>
      {inner}
    </Link>
  );
}

function BadgeSelo({ badge }: { badge: Badge }) {
  if (badge === "nova-aba") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-gold/50 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.15em] text-gold-muted">
        <ExternalLink className="h-2.5 w-2.5" />
        Nova aba
      </span>
    );
  }
  const label = badge === "auditoria" ? "Auditoria" : "Log";
  return (
    <span className="inline-flex items-center rounded-full bg-gold/15 border border-gold/30 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.15em] text-gold">
      {label}
    </span>
  );
}
