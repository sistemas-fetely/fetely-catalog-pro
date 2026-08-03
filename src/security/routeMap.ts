// Mapa pathname → telaId requerida.
// Rotas não listadas são consideradas livres (não passam pelo guard).
// Comparação por prefixo: rota mais específica primeiro.

import type { AcaoPermissao } from "./permissions";

interface RotaProtegida {
  prefix: string;
  telaId: string;
  acao?: AcaoPermissao; // default "ver"
  exact?: boolean;
}

// Ordem importa — mais específico antes do genérico.
const ROTAS: RotaProtegida[] = [
  // ADMIN
  { prefix: "/admin/permissoes", telaId: "cfg_permissoes" },
  { prefix: "/admin/products", telaId: "cfg_produtos" },
  { prefix: "/admin/cartilhas", telaId: "cfg_cartilhas" },
  { prefix: "/admin/leads", telaId: "cfg_leads" },
  { prefix: "/admin/precos", telaId: "cfg_produtos" },
  { prefix: "/admin/users", telaId: "cfg_vendedores" },
  { prefix: "/admin/sincronizacao-sncf", telaId: "cfg_produtos" },

  // PORTAL CLIENTE
  { prefix: "/portal/pedidos", telaId: "portal_pedidos" },
  { prefix: "/portal/cotacoes", telaId: "portal_pedidos" },
  { prefix: "/portal/provisoes", telaId: "portal_provisoes" },
  { prefix: "/portal/conta", telaId: "portal_conta" },
  { prefix: "/portal", telaId: "portal_dashboard" },

  // OPERACIONAL
  { prefix: "/dashboard", telaId: "dashboard" },
  { prefix: "/metas-pace", telaId: "dashboard" },
  { prefix: "/relatorios", telaId: "relatorios" },


  { prefix: "/analytics", telaId: "relatorios" },
  { prefix: "/orders", telaId: "pedidos_lista" },
  { prefix: "/farol", telaId: "pedidos_lista" },
  { prefix: "/new-order", telaId: "pedidos_novo", acao: "criar" },
  { prefix: "/cotacoes", telaId: "cotacoes_lista" },
  { prefix: "/provisoes", telaId: "provisoes_lista" },
  { prefix: "/clientes", telaId: "clientes_lista" },
  { prefix: "/commercial", telaId: "cfg_cartilhas" },
  { prefix: "/condicoes-pagamento", telaId: "cfg_condicoes_editar" },
  { prefix: "/import", telaId: "cfg_produtos_importar", acao: "criar" },
  { prefix: "/photos", telaId: "fotos_gerenciar" },
  { prefix: "/pedido-original", telaId: "pedidos_detalhe" },
];

/**
 * Encontra a regra que cobre o pathname dado.
 * Retorna null para rotas livres (login, catálogo público, etc).
 */
export function regraDaRota(
  pathname: string,
): { telaId: string; acao: AcaoPermissao } | null {
  for (const r of ROTAS) {
    const bate = r.exact ? pathname === r.prefix : pathname === r.prefix || pathname.startsWith(r.prefix + "/");
    if (bate) return { telaId: r.telaId, acao: r.acao ?? "ver" };
  }
  return null;
}
