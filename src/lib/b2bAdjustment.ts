import { balcao } from "@/hooks/useBalcao";
import type { CartItem } from "@/types";

export interface B2BPermissions {
  estagio: string;
  editar_itens: boolean;
  editar_frete: boolean;
  editar_pagamento: boolean;
  motivo_bloqueio: string | null;
  frete: { tipo: string; valor: number; contratado_pelo_cliente: boolean };
  condicao_atual: string;
  condicoes: { slug: string; rotulo: string }[];
}
export interface B2BResult {
  ok: boolean;
  resultado: "aplicado" | "enviado_reanalise";
  mensagem: string;
}
export const b2b = balcao;
export const canAdjust = (p: B2BPermissions) => p.editar_itens === true || p.editar_frete === true || p.editar_pagamento === true;
export const canAdjustFreight = (p: B2BPermissions) => p.editar_frete === true && p.frete.contratado_pelo_cliente !== true;
export function adjustmentItems(items: CartItem[], factor: number) {
  return items.map(i => ({ sku: i.sku, descricao: i.product.nomeComercial, quantidade: i.quantity,
    valor_unitario: Math.round((i.precoOverride ?? i.product.precoAtacado) * (1 - (i.descontoItemPct ?? 0) / 100) * factor * 100) / 100 }));
}
export async function submitAdjustment(tipo: string, body: Record<string, unknown>, call = b2b<B2BResult>) {
  const motivo = String(body.motivo ?? "").trim();
  if (motivo.length < 3) throw new Error("Informe o motivo do ajuste (mín. 3 caracteres).");
  return call(tipo, { ...body, motivo });
}