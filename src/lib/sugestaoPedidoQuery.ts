import { queryOptions } from "@tanstack/react-query";
import type { Product } from "@/types";
import { carregarDadosSugestao } from "./sugestaoPedido.functions";

export const sugestaoQueryOptions = () =>
  queryOptions({
    queryKey: ["public-sugestao-pedido"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const data = await carregarDadosSugestao();
      const defaults = {
        marca: "",
        linha: "",
        tipo: "",
        familia: "",
        estampa: "",
        tamanhoRef: "",
        material: "",
        materialDescritivo: "",
        pesoG: 0,
        larguraCm: 0,
        alturaCm: 0,
        qtdKit: 1,
        precoVarejo: 0,
      };
      const produtos: Product[] = Array.isArray(data.produtos)
        ? data.produtos
            .filter(
              (p): p is Record<string, import("@/integrations/supabase/types").Json> =>
                !!p && typeof p === "object" && !Array.isArray(p),
            )
            .map(
              (p) =>
                ({
                  ...defaults,
                  ...p,
                  sku: String(p["sku"] ?? ""),
                  codCadastro: String(p["codCadastro"] ?? ""),
                  nomeComercial: String(p["nomeComercial"] ?? ""),
                  colecao: String(p["colecao"] ?? ""),
                  grupo: String(p["grupo"] ?? ""),
                  categoria: String(p["categoria"] ?? ""),
                  corNome: String(p["corNome"] ?? ""),
                  cor: String(p["cor"] ?? ""),
                  tamanhoNumero: String(p["tamanhoNumero"] ?? ""),
                  tamanhoRef: String(p["tamanhoRef"] ?? ""),
                  linha: String(p["linha"] ?? ""),
                  precoAtacado: Number(p["precoAtacado"]),
                  precoVarejo: Number(p["precoVarejo"] ?? 0),
                  multiplos: Number(p["multiplos"] ?? 1),
                  qtdKit: Number(p["qtdKit"] ?? 1),
                }) as Product,
            )
        : [];
      return { ...data, produtos };
    },
  });
