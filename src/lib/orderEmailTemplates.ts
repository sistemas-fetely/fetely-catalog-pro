import type { SavedOrder } from "@/types";

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailContent {
  subject: string;
  html: string;
}

/**
 * Email branded pro cliente — visual Fetély, foco em confirmação cordial.
 */
export function buildClienteEmail(order: SavedOrder, contatoNome?: string): EmailContent {
  const c = order.commercial;
  const cliente = order.meta.cliente || "Cliente";
  const saudacao = contatoNome
    ? `Olá, ${escapeHtml(contatoNome.split(" ")[0])}!`
    : "Olá!";
  const vendedor = order.vendedorNome || order.meta.vendedor || "Equipe Fetély";
  const dataPedido = new Date(order.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const subject = `Seu pedido na Fetély · ${order.id} · ${formatBRL(order.total)}`;

  const linha = (label: string, value: string) => `
    <tr>
      <td style="padding: 6px 0; color: #6a6a6a; font-size: 13px; width: 40%;">${escapeHtml(label)}</td>
      <td style="padding: 6px 0; color: #1a1a1a; font-size: 13px; font-weight: 500;">${escapeHtml(value)}</td>
    </tr>`;

  const condicoes = c
    ? `${linha("Data", dataPedido)}
       ${linha("Cliente", cliente)}
       ${linha("Faixa", c.faixaNome)}
       ${linha("Pagamento", c.condicaoDescricao || order.meta.condicaoPagamento)}
       ${linha("Frete", `${c.frete}${c.frete === "CIF" ? " — Fetély entrega" : " — Cliente retira"}`)}`
    : `${linha("Data", dataPedido)}
       ${linha("Cliente", cliente)}
       ${linha("Pagamento", order.meta.condicaoPagamento)}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f3ee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f3ee; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 4px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 32px 40px; text-align: center;">
              <div style="color: #b8923a; font-size: 28px; letter-spacing: 4px; font-weight: 300;">FETÉLY</div>
              <div style="color: #888888; font-size: 10px; letter-spacing: 3px; margin-top: 6px;">B2B · CELEBRE O QUE IMPORTA</div>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 16px; color: #1a1a1a; font-size: 22px; font-weight: 600;">${saudacao}</h1>
              <p style="margin: 0 0 28px; color: #4a4a4a; font-size: 15px; line-height: 1.6;">
                Recebemos seu pedido com todo o cuidado. Em anexo, o documento completo com itens e condições.
              </p>

              <!-- Card resumo -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #faf8f5; border: 1px solid #ece8df; border-radius: 4px; padding: 20px 24px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="color: #6a6a6a; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px;">Pedido</div>
                    <div style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin-bottom: 16px;">${escapeHtml(order.id)}</div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${condicoes}
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top: 1px solid #ece8df; margin-top: 12px; padding-top: 12px;">
                      <tr>
                        <td style="padding: 10px 0 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">Total</td>
                        <td style="padding: 10px 0 0; color: #b8923a; font-size: 20px; font-weight: 600; text-align: right;">${formatBRL(order.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                order.meta.observacoesCliente
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #faf8f5; border: 1px solid #ece8df; border-radius: 4px; padding: 16px 20px; margin-bottom: 16px;">
                <tr><td>
                  <div style="color: #6a6a6a; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;">Observações</div>
                  <div style="color: #1a1a1a; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(order.meta.observacoesCliente)}</div>
                </td></tr>
              </table>`
                  : ""
              }

              <p style="margin: 0 0 8px; color: #6a6a6a; font-size: 13px;">📎 Pedido completo em anexo (PDF)</p>

              <p style="margin: 28px 0 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                Qualquer dúvida ou ajuste, é só responder a este email.<br />
                Sua confirmação garante o lugar na produção.
              </p>

              <p style="margin: 32px 0 0; color: #4a4a4a; font-size: 14px;">
                Com cuidado,<br />
                <strong style="color: #1a1a1a;">${escapeHtml(vendedor)}</strong><br />
                <span style="color: #6a6a6a; font-size: 12px;">Fetély · B2B Orders</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #faf8f5; padding: 24px 40px; border-top: 1px solid #ece8df;">
              <div style="color: #b8923a; font-size: 10px; letter-spacing: 3px; text-align: center; margin-bottom: 8px;">#CELEBREOQUEIMPORTA</div>
              <div style="color: #888888; font-size: 11px; text-align: center; line-height: 1.5;">
                FETELY COMERCIO IMPORTACAO E EXPORTACAO LTDA<br />
                CNPJ 63.591.078/0001-48 · fetelycorp.com.br
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

/**
 * Email pro SOps — scaneável, sem visual, tabela 2-colunas.
 */
export function buildSOpsEmail(order: SavedOrder): EmailContent {
  const c = order.commercial;
  const cliente = order.meta.cliente || "—";
  const vendedor = order.vendedorNome || order.meta.vendedor || "—";
  const dataPedido = new Date(order.createdAt).toLocaleString("pt-BR");

  const subject = `[Pedido] ${order.id} · ${cliente} · ${formatBRL(order.total)}`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding: 6px 12px 6px 0; color: #6a6a6a; font-size: 13px; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>
      <td style="padding: 6px 0; color: #1a1a1a; font-size: 13px;">${escapeHtml(value)}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin: 0; padding: 24px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  <div style="max-width: 640px;">
    <h2 style="margin: 0 0 4px; color: #1a1a1a; font-size: 18px;">Novo pedido recebido</h2>
    <div style="color: #6a6a6a; font-size: 12px; margin-bottom: 20px;">${dataPedido}</div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e0e0e0; border-radius: 4px; padding: 16px 20px;">
      ${row("Pedido", order.id)}
      ${row("Cliente", cliente)}
      ${row("CNPJ", order.meta.cnpj || "—")}
      ${row("Vendedor", vendedor)}
      ${row("Pagamento", c?.condicaoDescricao || order.meta.condicaoPagamento)}
      ${c ? row("Faixa", c.faixaNome) : ""}
      ${c ? row("Frete", c.frete) : ""}
      ${c ? row("Valor bruto", formatBRL(c.bruto)) : ""}
      ${c && c.descontoCelebraValor > 0 ? row(`Desc. ${c.faixaNome} (${c.descontoCelebraPct}%)`, `− ${formatBRL(c.descontoCelebraValor)}`) : ""}
      ${c && c.descontoMasterValor > 0 ? row(`Desc. Master (${c.descontoMasterPct}%)`, `− ${formatBRL(c.descontoMasterValor)}`) : ""}
      ${c && c.aplicouPix && c.bonusPixValor > 0 ? row("Bônus PIX", `− ${formatBRL(c.bonusPixValor)}`) : ""}
      <tr><td colspan="2" style="padding: 8px 0; border-top: 1px solid #e0e0e0;"></td></tr>
      ${row("Total final", formatBRL(order.total))}
      ${c?.negociacao ? row("⚠️ Negociação", c.justificativa || "Sim") : ""}
      ${c?.premissasAplicadas ? row("Premissas", "Aplicadas") : ""}
      ${order.meta.observacoes ? row("Observações", order.meta.observacoes) : ""}
    </table>

    <p style="margin: 20px 0 0; color: #6a6a6a; font-size: 13px;">📎 PDF do pedido em anexo.</p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
    <p style="margin: 0; color: #999999; font-size: 11px;">Email automático · Fetely B2B Orders</p>
  </div>
</body>
</html>`;

  return { subject, html };
}
