// Catálogo central de telas e ações do sistema.
// Fonte única da verdade — usada pela tela /admin/permissoes e (em fase futura)
// pelos guards de rota e helpers de UI.

export type AcaoPermissao =
  | "ver"
  | "criar"
  | "editar"
  | "excluir"
  | "exportar"
  | "aprovar";

export const TODAS_ACOES: AcaoPermissao[] = [
  "ver",
  "criar",
  "editar",
  "excluir",
  "exportar",
  "aprovar",
];

export interface TelaDefinicao {
  id: string;
  nome: string;
  grupo: string;
  /** Ações que fazem sentido para essa tela. As demais aparecem como "—". */
  acoes: AcaoPermissao[];
}

const V: AcaoPermissao[] = ["ver"];
const VE: AcaoPermissao[] = ["ver", "exportar"];
const VC: AcaoPermissao[] = ["ver", "criar"];
const CRUD: AcaoPermissao[] = ["ver", "criar", "editar", "excluir"];
const CRUDE: AcaoPermissao[] = ["ver", "criar", "editar", "excluir", "exportar"];

export const TELAS_SISTEMA: TelaDefinicao[] = [
  // VISÃO GERAL
  { id: "dashboard", nome: "Dashboard", grupo: "Visão Geral", acoes: V },
  { id: "relatorios", nome: "Relatórios", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_vendas", nome: "↳ Vendas Geral", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_produtos", nome: "↳ Por Produto", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_colecoes", nome: "↳ Por Coleção", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_categorias", nome: "↳ Por Categoria", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_grupos", nome: "↳ Por Grupo", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_tipos", nome: "↳ Por Tipo", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_clientes", nome: "↳ Por Cliente", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_vendedores", nome: "↳ Por Vendedor", grupo: "Visão Geral", acoes: VE },
  { id: "relatorio_financeiro", nome: "↳ Financeiro", grupo: "Visão Geral", acoes: VE },

  // PEDIDOS
  { id: "pedidos_lista", nome: "Lista de Pedidos", grupo: "Pedidos", acoes: VE },
  { id: "pedidos_novo", nome: "Novo Pedido", grupo: "Pedidos", acoes: VC },
  { id: "pedidos_detalhe", nome: "Detalhe do Pedido", grupo: "Pedidos", acoes: ["ver", "editar", "exportar"] },
  { id: "pedidos_exportar", nome: "Exportar Pedidos", grupo: "Pedidos", acoes: ["exportar"] },
  { id: "pedidos_aprovar", nome: "Aprovar Pedidos (portal)", grupo: "Pedidos", acoes: ["ver", "aprovar"] },
  { id: "pedidos_todos", nome: "Ver Pedidos de Todos", grupo: "Pedidos", acoes: V },

  // COTAÇÕES
  { id: "cotacoes_lista", nome: "Lista de Cotações", grupo: "Cotações", acoes: VE },
  { id: "cotacoes_nova", nome: "Nova Cotação", grupo: "Cotações", acoes: VC },
  { id: "cotacoes_converter", nome: "Converter em Pedido", grupo: "Cotações", acoes: V },

  // PROVISÕES
  { id: "provisoes_lista", nome: "Lista de Provisões", grupo: "Provisões", acoes: VE },
  { id: "provisoes_converter", nome: "Converter Provisão", grupo: "Provisões", acoes: V },

  // CATÁLOGO
  { id: "catalogo", nome: "Catálogo de Produtos", grupo: "Catálogo", acoes: V },
  { id: "catalogo_precos", nome: "↳ Ver Preço Atacado", grupo: "Catálogo", acoes: V },

  // CLIENTES
  { id: "clientes_lista", nome: "Lista de Clientes", grupo: "Clientes", acoes: VE },
  { id: "clientes_detalhe", nome: "Detalhe do Cliente", grupo: "Clientes", acoes: V },
  { id: "clientes_criar", nome: "Cadastrar Cliente", grupo: "Clientes", acoes: ["criar"] },
  { id: "clientes_editar", nome: "Editar Cliente", grupo: "Clientes", acoes: ["editar"] },
  { id: "clientes_premissas", nome: "↳ Premissas Comerciais", grupo: "Clientes", acoes: ["ver", "editar"] },
  { id: "clientes_todos", nome: "Ver Clientes de Todos", grupo: "Clientes", acoes: V },

  // COMERCIAL
  { id: "modo_negociacao", nome: "Modo Negociação (senha)", grupo: "Comercial", acoes: V },
  { id: "negociacao_desconto", nome: "↳ Aplicar Desconto Extra", grupo: "Comercial", acoes: V },
  { id: "negociacao_faixa_res", nome: "↳ Ativar Faixa Reservada", grupo: "Comercial", acoes: V },

  // ACADEMIA
  { id: "academia", nome: "Academia Fetély", grupo: "Academia", acoes: CRUD },

  // CONFIGURAÇÕES — PRODUTOS
  { id: "cfg_produtos", nome: "Gestão de Produtos", grupo: "Configurações", acoes: CRUDE },
  { id: "cfg_produtos_criar", nome: "↳ Criar Produto", grupo: "Configurações", acoes: ["criar"] },
  { id: "cfg_produtos_editar", nome: "↳ Editar Produto", grupo: "Configurações", acoes: ["editar"] },
  { id: "cfg_produtos_desativar", nome: "↳ Desativar Produto", grupo: "Configurações", acoes: ["editar"] },
  { id: "cfg_produtos_importar", nome: "↳ Importar CSV", grupo: "Configurações", acoes: ["criar"] },

  // CONFIGURAÇÕES — CARTILHAS
  { id: "cfg_cartilhas", nome: "Cartilhas e Níveis", grupo: "Configurações", acoes: CRUD },
  { id: "cfg_faixas_editar", nome: "↳ Editar Faixas", grupo: "Configurações", acoes: ["editar"] },
  { id: "cfg_condicoes_editar", nome: "↳ Editar Condições Pgto", grupo: "Configurações", acoes: ["editar"] },
  { id: "cfg_regras_gerais", nome: "↳ Regras Gerais", grupo: "Configurações", acoes: ["ver", "editar"] },

  // CONFIGURAÇÕES — LEADS
  { id: "cfg_leads", nome: "Gestão de Leads", grupo: "Configurações", acoes: CRUDE },
  { id: "cfg_leads_exportar", nome: "↳ Exportar Leads", grupo: "Configurações", acoes: ["exportar"] },
  { id: "cfg_leads_campanhas", nome: "↳ Campanhas", grupo: "Configurações", acoes: CRUD },
  { id: "cfg_leads_integracoes", nome: "↳ Integrações", grupo: "Configurações", acoes: ["ver", "editar"] },

  // CONFIGURAÇÕES — USUÁRIOS E PERMISSÕES
  { id: "cfg_vendedores", nome: "Gestão de Vendedores", grupo: "Configurações", acoes: CRUD },
  { id: "cfg_usuarios", nome: "Gestão de Usuários", grupo: "Configurações", acoes: CRUD },
  { id: "cfg_permissoes", nome: "Gestor de Permissões", grupo: "Configurações", acoes: ["ver", "editar"] },
  { id: "cfg_senha_master", nome: "Senha Master", grupo: "Configurações", acoes: ["ver", "editar"] },

  // PORTAL DO CLIENTE
  { id: "portal_dashboard", nome: "Portal — Dashboard", grupo: "Portal Cliente", acoes: V },
  { id: "portal_pedidos", nome: "Portal — Meus Pedidos", grupo: "Portal Cliente", acoes: V },
  { id: "portal_novo_pedido", nome: "Portal — Fazer Pedido", grupo: "Portal Cliente", acoes: VC },
  { id: "portal_provisoes", nome: "Portal — Provisões", grupo: "Portal Cliente", acoes: V },
  { id: "portal_conta", nome: "Portal — Minha Conta", grupo: "Portal Cliente", acoes: ["ver", "editar"] },

  // MÍDIA
  { id: "fotos_gerenciar", nome: "Gerenciar Fotos", grupo: "Mídia", acoes: CRUD },
];

export const GRUPOS_TELAS: string[] = Array.from(
  new Set(TELAS_SISTEMA.map((t) => t.grupo)),
);

export type PerfilBaseRole = "master" | "admin" | "vendedor" | "cliente";

/**
 * Seed inicial — define quais (tela, ação) são permitidos por perfil.
 * Admin = tudo (computado, não listado).
 */
export const PERMISSOES_PADRAO: Record<
  PerfilBaseRole,
  { telaId: string; acoes: AcaoPermissao[] }[]
> = {
  admin: TELAS_SISTEMA.map((t) => ({ telaId: t.id, acoes: t.acoes })),

  master: TELAS_SISTEMA
    .filter(
      (t) =>
        !["cfg_permissoes", "cfg_senha_master"].includes(t.id) &&
        !t.grupo.startsWith("Portal"),
    )
    .map((t) => ({ telaId: t.id, acoes: t.acoes })),

  vendedor: [
    { telaId: "dashboard", acoes: V },
    { telaId: "pedidos_lista", acoes: VE },
    { telaId: "pedidos_novo", acoes: VC },
    { telaId: "pedidos_detalhe", acoes: ["ver", "editar", "exportar"] },
    { telaId: "pedidos_exportar", acoes: ["exportar"] },
    { telaId: "cotacoes_lista", acoes: VE },
    { telaId: "cotacoes_nova", acoes: VC },
    { telaId: "cotacoes_converter", acoes: V },
    { telaId: "provisoes_lista", acoes: VE },
    { telaId: "provisoes_converter", acoes: V },
    { telaId: "catalogo", acoes: V },
    { telaId: "catalogo_precos", acoes: V },
    { telaId: "clientes_lista", acoes: VE },
    { telaId: "clientes_detalhe", acoes: V },
    { telaId: "clientes_criar", acoes: ["criar"] },
    { telaId: "clientes_editar", acoes: ["editar"] },
    { telaId: "modo_negociacao", acoes: V },
    { telaId: "negociacao_desconto", acoes: V },
    { telaId: "academia", acoes: V },
  ],

  cliente: [
    { telaId: "portal_dashboard", acoes: V },
    { telaId: "portal_pedidos", acoes: V },
    { telaId: "portal_novo_pedido", acoes: VC },
    { telaId: "portal_provisoes", acoes: V },
    { telaId: "portal_conta", acoes: ["ver", "editar"] },
    { telaId: "catalogo", acoes: V },
  ],
};

/**
 * Representante (vendedor externo): acesso restrito a operar os PRÓPRIOS
 * pedidos/cotações/provisões/clientes. Sem dashboard, metas, relatórios,
 * configurações ou qualquer visão agregada da empresa.
 */
export const TELAS_REPRESENTANTE: string[] = [
  "catalogo",
  "catalogo_precos",
  "pedidos_lista",
  "pedidos_novo",
  "pedidos_detalhe",
  "pedidos_exportar",
  "cotacoes_lista",
  "cotacoes_nova",
  "cotacoes_converter",
  "provisoes_lista",
  "provisoes_converter",
  "clientes_lista",
  "clientes_detalhe",
  "clientes_criar",
  "clientes_editar",
  "academia",
];

/** True quando a tela é permitida para o perfil representante. */
export function representanteConcede(telaId: string): boolean {
  return TELAS_REPRESENTANTE.includes(telaId);
}

/** True quando o perfil base concede essa (tela, ação). */

export function perfilBaseConcede(
  perfil: PerfilBaseRole,
  telaId: string,
  acao: AcaoPermissao,
): boolean {
  if (perfil === "admin") return true;
  const reg = PERMISSOES_PADRAO[perfil].find((p) => p.telaId === telaId);
  return reg ? reg.acoes.includes(acao) : false;
}

/** True se a ação faz sentido para a tela (caso contrário a célula é "—"). */
export function acaoAplicavel(telaId: string, acao: AcaoPermissao): boolean {
  const t = TELAS_SISTEMA.find((x) => x.id === telaId);
  return t ? t.acoes.includes(acao) : false;
}

export function getTelaNome(telaId: string): string {
  return TELAS_SISTEMA.find((t) => t.id === telaId)?.nome ?? telaId;
}
