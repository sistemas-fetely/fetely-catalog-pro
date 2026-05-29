import { useState, useMemo } from "react";
import { Mail, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/store/clienteStore";
import { generateOrderPDF } from "@/lib/orderPdf";
import { buildClienteEmail, buildSOpsEmail } from "@/lib/orderEmailTemplates";
import type { SavedOrder } from "@/types";

// TODO: migrar pra regras_gerais.email_sops se algum dia precisar trocar sem release
const EMAIL_SOPS = "pedidos.corp@fetelycorp.com.br";

type Destino = "geral" | "financeiro" | "outro";

interface Props {
  order: SavedOrder;
  tipo: "cliente" | "sops";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnviarEmailDialog({ order, tipo, open, onOpenChange }: Props) {
  const clienteId = order.meta.clienteId;
  const cliente = useClientes((s) =>
    clienteId ? s.clientes.find((c) => c.id === clienteId) : null,
  );

  const [destino, setDestino] = useState<Destino>("geral");
  const [emailOutro, setEmailOutro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  const emailDestino = useMemo(() => {
    if (tipo === "sops") return EMAIL_SOPS;
    if (destino === "geral") return cliente?.contatoEmail || order.meta.email || "";
    if (destino === "financeiro") return cliente?.financeiroEmail || "";
    return emailOutro.trim();
  }, [tipo, destino, cliente, order.meta.email, emailOutro]);

  const nomeDestinatario = useMemo(() => {
    if (tipo === "sops") return undefined;
    if (destino === "geral") return cliente?.contatoNome;
    if (destino === "financeiro") return cliente?.financeiroNome;
    return undefined;
  }, [tipo, destino, cliente]);

  const podeEnviar =
    !enviando &&
    emailDestino.length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino);

  async function handleEnviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const { base64, filename } = generateOrderPDF(order);
      const content =
        tipo === "cliente"
          ? buildClienteEmail(order, nomeDestinatario)
          : buildSOpsEmail(order);

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: emailDestino,
          subject: content.subject,
          html: content.html,
          attachments: [{ filename, content: base64 }],
        },
      });

      if (error) throw error;
      setResultado({ ok: true, msg: `Email enviado para ${emailDestino}` });
      setTimeout(() => onOpenChange(false), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar email";
      console.error("[EnviarEmailDialog] falhou:", err);
      setResultado({ ok: false, msg });
    } finally {
      setEnviando(false);
    }
  }

  function handleClose() {
    if (enviando) return;
    setResultado(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-gold" />
            {tipo === "cliente" ? "Enviar pedido para o cliente" : "Enviar pedido para SOps"}
          </DialogTitle>
          <DialogDescription>
            {tipo === "cliente"
              ? "O cliente recebe um email branded com resumo + PDF anexado."
              : "O time SOps recebe resumo direto + PDF anexado para registro."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {tipo === "cliente" ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-text-muted">
                  Destinatário
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestino("geral")}
                    disabled={!cliente?.contatoEmail && !order.meta.email}
                    className={`text-xs uppercase tracking-wider px-3 py-2 rounded border transition ${
                      destino === "geral"
                        ? "bg-gold/10 border-gold text-gold"
                        : "border-border text-text-secondary hover:border-gold/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    Geral
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestino("financeiro")}
                    disabled={!cliente?.financeiroEmail}
                    className={`text-xs uppercase tracking-wider px-3 py-2 rounded border transition ${
                      destino === "financeiro"
                        ? "bg-gold/10 border-gold text-gold"
                        : "border-border text-text-secondary hover:border-gold/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    Financeiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestino("outro")}
                    className={`text-xs uppercase tracking-wider px-3 py-2 rounded border transition ${
                      destino === "outro"
                        ? "bg-gold/10 border-gold text-gold"
                        : "border-border text-text-secondary hover:border-gold/50"
                    }`}
                  >
                    Outro
                  </button>
                </div>
              </div>

              {destino === "outro" ? (
                <div className="space-y-2">
                  <Label htmlFor="emailOutro">Email</Label>
                  <Input
                    id="emailOutro"
                    type="email"
                    placeholder="nome@exemplo.com.br"
                    value={emailOutro}
                    onChange={(e) => setEmailOutro(e.target.value)}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm">
                  {emailDestino ? (
                    <span className="text-text-primary">{emailDestino}</span>
                  ) : (
                    <span className="text-text-muted italic">
                      {destino === "financeiro"
                        ? "Cliente não tem email financeiro cadastrado"
                        : "Cliente não tem email cadastrado"}
                    </span>
                  )}
                  {nomeDestinatario && (
                    <div className="text-xs text-text-muted mt-0.5">
                      A/C {nomeDestinatario}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-text-muted">
                Destinatário
              </Label>
              <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary">
                {EMAIL_SOPS}
              </div>
            </div>
          )}

          {resultado && (
            <div
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                resultado.ok
                  ? "bg-green-500/10 text-green-600 border border-green-500/30"
                  : "bg-red-500/10 text-red-600 border border-red-500/30"
              }`}
            >
              {resultado.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{resultado.msg}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={!podeEnviar}>
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
