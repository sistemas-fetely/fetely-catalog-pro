import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Titularidade do cadastro: a matriz `produto_fase_ficha` é a ÚNICA fonte da
// verdade sobre quem edita cada campo. A tela lê `dono` daqui — não existe
// lista de campos no código, então mudança de dono na tabela muda a tela sozinha.
//   dono = 'thomer'  → editável no FOP
//   dono = 'fetely'  → somente leitura (editado no SNCF — Ficha do Produto)
//   dono = 'sistema' → somente leitura (preenchido pelo sistema)
// Campo ausente da matriz não é governado: fica como está.
export type DonoCampo = "thomer" | "fetely" | "sistema" | (string & {});

let cache: Record<string, DonoCampo> | null = null;

export function useFichaDonos(): Record<string, DonoCampo> {
  const [donos, setDonos] = useState<Record<string, DonoCampo>>(cache ?? {});

  useEffect(() => {
    if (cache) return;
    void supabase
      .from("produto_fase_ficha")
      .select("campo,dono")
      .then(({ data, error }) => {
        if (error || !data) return;
        const mapa: Record<string, DonoCampo> = {};
        for (const r of data) {
          const campo = String((r as { campo: unknown }).campo ?? "");
          const dono = String((r as { dono: unknown }).dono ?? "");
          if (campo && dono) mapa[campo] = dono as DonoCampo;
        }
        cache = mapa;
        setDonos(mapa);
      });
  }, []);

  return donos;
}

export const NOTA_DONO: Record<string, string> = {
  fetely: "editado no SNCF — Ficha do Produto",
  sistema: "preenchido pelo sistema",
};
