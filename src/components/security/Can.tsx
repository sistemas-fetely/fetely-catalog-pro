// Wrapper de UI: renderiza children apenas quando o usuário tem a permissão.
// Uso:
//   <Can tela="cfg_produtos" acao="criar"><Button>Novo</Button></Can>

import type { ReactNode } from "react";
import type { AcaoPermissao } from "@/security/permissions";
import { useTemPermissao } from "@/store/permissoesStore";

interface CanProps {
  tela: string;
  acao?: AcaoPermissao;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ tela, acao = "ver", children, fallback = null }: CanProps) {
  const temPermissao = useTemPermissao();
  return <>{temPermissao(tela, acao) ? children : fallback}</>;
}
