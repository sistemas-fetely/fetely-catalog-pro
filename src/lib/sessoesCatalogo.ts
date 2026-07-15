// Fatia 3 — Sessões do catálogo (jornada em andamento / abandonadas).
// Fonte: view public.sessao_catalogo_estado (estado_derivado calculado on-read).

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EstadoSessao =
  | "acessou"
  | "montando"
  | "montagem_abandonada"
  | "formulario_aberto"
  | "formulario_abandonado"
  | "enviada"
  | "em_contato"
  | "convertida"
  | "expirada"
  | "descartada";

export interface SessaoRow {
  id: string;
  link_instance_id: string | null;
  nome: string | null;
  whatsapp: string | null;
  identificado_gate: boolean | null;
  cnpj: string | null;
  razao_social: string | null;
  segmento: string | null;
  valor_wishlist: number | null;
  qtd_itens: number | null;
  estado_atual: string | null;
  primeiro_acesso: string | null;
  ultimo_evento: string | null;
  ultimo_form_open: string | null;
  campos_preenchidos: Record<string, unknown> | null;
  vendedor_responsavel: string | null;
  origem_tipo_snapshot: string | null;
  origem_id_snapshot: string | null;
  user_agent: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
  estado_derivado: EstadoSessao;

}

export const ESTADO_SESSAO_LABEL: Record<EstadoSessao, string> = {
  acessou: "Só acessou",
  montando: "Montando",
  montagem_abandonada: "Montagem abandonada",
  formulario_aberto: "Preenchendo formulário",
  formulario_abandonado: "Formulário abandonado",
  enviada: "Enviada",
  em_contato: "Em contato",
  convertida: "Convertida",
  expirada: "Expirada",
  descartada: "Descartada",
};

const HIDDEN_STATES: EstadoSessao[] = ["enviada", "em_contato", "convertida", "expirada", "descartada"];

/** Retorna sessões "em andamento" (exclui enviada/em_contato/convertida/expirada/descartada). */
export function useSessoesCatalogo(refreshKey: number) {
  const [rows, setRows] = useState<SessaoRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessao_catalogo_estado")
        .select("*")
        .order("ultimo_evento", { ascending: false })
        .limit(500);
      if (error) throw error;
      const parsed = (data ?? []) as unknown as SessaoRow[];
      // Filtra estados terminais no cliente (a wishlist enviada já aparece em pre_selecoes)
      setRows(parsed.filter((r) => !HIDDEN_STATES.includes(r.estado_derivado)));
    } catch (e) {
      console.warn("[sessoes-catalogo] load falhou", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return { rows, loading, reload: load };
}
