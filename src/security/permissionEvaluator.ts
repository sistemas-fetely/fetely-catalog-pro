// Avaliador puro de permissões.
// Aplica as 3 camadas (perfil base → grupo → exceção individual) e devolve
// um Set<string> no formato `${telaId}:${acao}`.
//
// Esse módulo NÃO toca o banco — recebe os dados crus e calcula.

import {
  AcaoPermissao,
  PERMISSOES_PADRAO,
  PerfilBaseRole,
  TELAS_SISTEMA,
} from "./permissions";

export interface PerfilOverrideRow {
  perfil: PerfilBaseRole;
  tela_id: string;
  acao: AcaoPermissao;
  permitido: boolean;
}
export interface GrupoOverrideRow {
  grupo_id: string;
  tela_id: string;
  acao: AcaoPermissao;
  permitido: boolean;
}
export interface ExcecaoRow {
  tela_id: string;
  acao: AcaoPermissao;
  permitido: boolean;
}

export function chave(telaId: string, acao: AcaoPermissao): string {
  return `${telaId}:${acao}`;
}

/**
 * Calcula o conjunto efetivo de pares (tela, ação) permitidos para um usuário.
 *
 * - Admin: tudo. Curto-circuito.
 * - Master/Vendedor/Cliente: parte do seed PERMISSOES_PADRAO, aplica overrides
 *   do perfil base, aplica overrides do grupo (se houver), aplica exceções
 *   individuais.
 */
export function computarPermissoesEfetivas(args: {
  roles: string[];
  grupoId: string | null;
  perfisOverride: PerfilOverrideRow[];
  grupoOverrides: GrupoOverrideRow[];
  excecoes: ExcecaoRow[];
}): Set<string> {
  const set = new Set<string>();

  // Admin = tudo
  if (args.roles.includes("admin")) {
    for (const t of TELAS_SISTEMA) {
      for (const a of t.acoes) set.add(chave(t.id, a));
    }
    return set;
  }

  // Define o perfil base efetivo (prioridade: master > vendedor > cliente)
  const perfil: PerfilBaseRole = args.roles.includes("master")
    ? "master"
    : args.roles.includes("vendedor")
    ? "vendedor"
    : args.roles.includes("cliente")
    ? "cliente"
    : "vendedor";

  // 1) Seed do perfil base
  for (const reg of PERMISSOES_PADRAO[perfil]) {
    for (const a of reg.acoes) set.add(chave(reg.telaId, a));
  }

  // 2) Overrides do perfil base
  for (const o of args.perfisOverride) {
    if (o.perfil !== perfil) continue;
    const k = chave(o.tela_id, o.acao);
    if (o.permitido) set.add(k);
    else set.delete(k);
  }

  // 3) Overrides do grupo (camada acima do perfil)
  if (args.grupoId) {
    for (const o of args.grupoOverrides) {
      if (o.grupo_id !== args.grupoId) continue;
      const k = chave(o.tela_id, o.acao);
      if (o.permitido) set.add(k);
      else set.delete(k);
    }
  }

  // 4) Exceções individuais (camada final, vence todas)
  for (const o of args.excecoes) {
    const k = chave(o.tela_id, o.acao);
    if (o.permitido) set.add(k);
    else set.delete(k);
  }

  return set;
}
