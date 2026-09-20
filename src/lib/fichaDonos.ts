import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Titularidade do cadastro: a matriz `produto_fase_ficha` é a ÚNICA fonte da
// verdade sobre quem edita cada campo. A tela lê `dono` daqui — não existe
// lista de campos no código, então mudança de dono na tabela muda a tela sozinha.
//   dono = 'thomer'  → editável no FOP
//   dono = 'fetely'  → somente leitura (editado no SNCF — Ficha do Produto)
//   dono = 'sistema' → somente leitura (preenchido pelo sistema)
// Campo ausente da matriz não é governado: fica como está.
//
// O mapa NÃO é cacheado em variável de módulo: React Query com staleTime de
// 5 min e refetchOnWindowFocus — voltar para a aba revalida a titularidade,
// que muda por UPDATE na tabela sem deploy (chega sozinha em no máx. 5 min).
export type DonoCampo = "thomer" | "fetely" | "sistema" | (string & {});

export type FichaDonosEstado = {
  /** Mapa campo → dono. Vazio enquanto carrega ou em caso de erro. */
  donos: Record<string, DonoCampo>;
  /** Consulta ainda em voo (primeira carga ou revalidação sem dados). */
  carregando: boolean;
  /** Consulta falhou: falha fecha — tratado como tudo travado. */
  erro: boolean;
};

async function buscarDonos(): Promise<Record<string, DonoCampo>> {
  const { data, error } = await supabase
    .from("produto_fase_ficha")
    .select("campo,bloco,dono,fase_exigida,obrigatorio,ordem,descricao");
  if (error) throw error;
  const mapa: Record<string, DonoCampo> = {};
  for (const r of data ?? []) {
    const campo = String((r as { campo: unknown }).campo ?? "");
    const dono = String((r as { dono: unknown }).dono ?? "");
    if (campo && dono) mapa[campo] = dono as DonoCampo;
  }
  return mapa;
}

export const FICHA_DONOS_QUERY_KEY = ["ficha-donos"] as const;

export function useFichaDonos(): FichaDonosEstado {
  const { data, isPending, isError } = useQuery({
    queryKey: FICHA_DONOS_QUERY_KEY,
    queryFn: buscarDonos,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  // `isPending` cobre a primeira carga; revalidações em background mantêm os
  // dados anteriores na tela (comportamento do React Query) — só trava de
  // verdade enquanto não há NENHUM dado ou quando a consulta falhou.
  return { donos: data ?? {}, carregando: isPending, erro: isError };
}

export const NOTA_DONO: Record<string, string> = {
  fetely: "editado no SNCF — Ficha do Produto",
  sistema: "preenchido pelo sistema",
  carregando: "carregando permissões",
  erro: "permissões de edição indisponíveis",
};
