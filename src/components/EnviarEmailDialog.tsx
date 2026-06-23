import { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Headphones,
  Forward,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/store/clienteStore";
import { generateOrderPDF } from "@/lib/orderPdf";
import { buildClienteEmail, buildSOpsEmail } from "@/lib/orderEmailTemplates";
import type { SavedOrder } from "@/types";

// TODO: Migrar para regras_gerais.email_sops se algum dia precisar trocar sem release
const EMAIL_SOPS = "pedidos.corp@fetelycorp.com.br";

type Destino = "cliente" | "sops" | "ambos";
type ContatoCliente = "geral" | "financeiro" | "outro";
type Step = "destino" | "detalhes" | "enviando" | "resultado";

interface Props {
  order: SavedOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OpcaoCard {
  id: Destino;
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}

interface EnvioResult {
  ok: boolean;
  alvo: string;
  erro?: string;
}

export function EnviarEmailDialog({ order, open, onOpenChange }: Props) {
  const clienteId = order.meta.clienteId;
  const cliente = useClientes((s) =>
    clienteId ? s.clientes.find((c) => c.id === clienteId) : null,
  );

  const [step, setStep] = useState<Step>("destino");
  const [destino, setDestino] = useState<Destino | null>(null);
  const [contatoCliente, setContatoCliente] = useState<ContatoCliente>("geral");
  const [emailOutro, setEmailOutro] = useState("");
  const [resultado, setResultado] = useState<{
    ok: boolean;
    msg: string;
    detalhes?: string[];
  } | null>(null);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep("destino");
        setDestino(null);
        setContatoCliente("geral");
        setEmailOutro("");
        setResultado(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Sugere o melhor contato disponível como default
  useEffect(() => {
    if (destino === "cliente" || destino === "ambos") {
      if (cliente?.contatoEmail || order.meta.email) setContatoCliente("geral");
      else if (cliente?.financeiroEmail) setContatoCliente("financeiro");
      else setContatoCliente("outro");
    }
  }, [destino, cliente, order.meta.email]);

  const emailClienteSelecionado = useMemo(() => {
    if (contatoCliente === "geral") return cliente?.contatoEmail || order.meta.email || "";
    if (contatoCliente === "financeiro") return cliente?.financeiroEmail || "";
    return emailOutro.trim();
  }, [contatoCliente, cliente, order.meta.email, emailOutro]);

  const nomeContatoCliente = useMemo(() => {
    if (contatoCliente === "geral") return cliente?.contatoNome;
    if (contatoCliente === "financeiro") return cliente?.financeiroNome;
    return undefined;
  }, [contatoCliente, cliente]);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClienteSelecionado);
  const precisaContato = destino === "cliente" || destino === "ambos";
  const podeEnviar = destino === "sops" || (precisaContato && emailValido);

  const opcoes: OpcaoCard[] = [
    {
      id: "cliente",
      icone: <Building2 className="h-7 w-7" />,
      titulo: "Cliente",
      descricao: "Email branded com PDF anexado",
    },
    {
      id: "sops",
      icone: <Headphones className="h-7 w-7" />,
      titulo: "SOps",
      descricao: "Resumo interno com PDF",
    },
    {
      id: "ambos",
      icone: <Forward className="h-7 w-7" />,
      titulo: "Os dois",
      descricao: "Envia para cliente e SOps",
    },
  ];

  function handleSelecionarDestino(d: Destino) {
    setDestino(d);
    if (d === "sops") {
      void handleEnviar(d, null);
    } else {
      setStep("detalhes");
    }
  }

  async function handleEnviar(destinoFinal: Destino, emailCliente: string | null) {
    setStep("enviando");
    setResultado(null);

    const { base64, filename } = await generateOrderPDF(order);
    const tasks: Array<Promise<EnvioResult>> = [];

    if (destinoFinal === "cliente" || destinoFinal === "ambos") {
      const content = buildClienteEmail(order, nomeContatoCliente);
      tasks.push(
        supabase.functions
          .invoke("send-email", {
            body: {
              to: emailCliente!,
              subject: content.subject,
              html: content.html,
              attachments: [{ filename, content: base64 }],
            },
          })
          .then(({ error }) =>
            error
              ? { ok: false, alvo: `Cliente (${emailCliente})`, erro: error.message }
              : { ok: true, alvo: `Cliente (${emailCliente})` },
          ),
      );
    }

    if (destinoFinal === "sops" || destinoFinal === "ambos") {
      const content = buildSOpsEmail(order);
      tasks.push(
        supabase.functions
          .invoke("send-email", {
            body: {
              to: EMAIL_SOPS,
              subject: content.subject,
              html: content.html,
              attachments: [{ filename, content: base64 }],
            },
          })
          .then(({ error }) =>
            error
              ? { ok: false, alvo: `SOps (${EMAIL_SOPS})`, erro: error.message }
              : { ok: true, alvo: `SOps (${EMAIL_SOPS})` },
          ),
      );
    }

    const results = await Promise.all(tasks);
    const sucessos = results.filter((r) => r.ok);
    const falhas = results.filter((r) => !r.ok);

    if (falhas.length === 0) {
      setResultado({
        ok: true,
        msg: results.length > 1 ? "Emails enviados com sucesso" : "Email enviado",
        detalhes: sucessos.map((s) => s.alvo),
      });
    } else if (sucessos.length === 0) {
      setResultado({
        ok: false,
        msg: "Falha ao enviar",
        detalhes: falhas.map((f) => `${f.alvo}: ${f.erro}`),
      });
    } else {
      setResultado({
        ok: false,
        msg: "Parcialmente enviado",
        detalhes: [
          ...sucessos.map((s) => `✓ ${s.alvo}`),
          ...falhas.map((f) => `✗ ${f.alvo}: ${f.erro}`),
        ],
      });
    }
    setStep("resultado");

    if (falhas.length === 0) {
      setTimeout(() => onOpenChange(false), 1800);
    }
  }

  function handleFechar() {
    if (step === "enviando") return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleFechar() : onOpenChange(o))}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold font-semibold">
            Enviar pedido
          </div>
          <DialogTitle className="font-display text-3xl mt-1">{order.id}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            {step === "destino" && "Escolha o destinatário do email"}
            {step === "detalhes" && "Confirme os detalhes do envio"}
            {step === "enviando" && "Enviando..."}
            {step === "resultado" && (resultado?.ok ? "Concluído" : "Resultado do envio")}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="px-6 py-5 min-h-[220px]">
          {/* STEP 1 — destinatário */}
          {step === "destino" && (
            <div className="grid grid-cols-3 gap-3">
              {opcoes.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelecionarDestino(opt.id)}
                  className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-card hover:border-gold hover:bg-gold/5 transition-all px-4 py-6 text-center"
                >
                  <div className="text-text-secondary group-hover:text-gold transition-colors">
                    {opt.icone}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-text-primary">{opt.titulo}</div>
                    <div className="text-xs text-text-muted leading-tight">{opt.descricao}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 2 — detalhes */}
          {step === "detalhes" && precisaContato && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  Contato do cliente
                </div>
                <div className="space-y-2">
                  {/* Geral */}
                  <button
                    type="button"
                    onClick={() => setContatoCliente("geral")}
                    disabled={!cliente?.contatoEmail && !order.meta.email}
                    className={`w-full flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-all ${
                      contatoCliente === "geral"
                        ? "border-gold bg-gold/5"
                        : "border-border hover:border-gold/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        contatoCliente === "geral" ? "border-gold bg-gold" : "border-border"
                      }`}
                    >
                      {contatoCliente === "geral" && (
                        <Check className="h-2.5 w-2.5 text-background" strokeWidth={4} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary">Geral</div>
                      <div className="text-xs text-text-muted truncate">
                        {cliente?.contatoEmail || order.meta.email || "Não cadastrado"}
                        {cliente?.contatoNome && (
                          <span className="text-text-muted/70"> · {cliente.contatoNome}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Financeiro */}
                  <button
                    type="button"
                    onClick={() => setContatoCliente("financeiro")}
                    disabled={!cliente?.financeiroEmail}
                    className={`w-full flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-all ${
                      contatoCliente === "financeiro"
                        ? "border-gold bg-gold/5"
                        : "border-border hover:border-gold/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        contatoCliente === "financeiro" ? "border-gold bg-gold" : "border-border"
                      }`}
                    >
                      {contatoCliente === "financeiro" && (
                        <Check className="h-2.5 w-2.5 text-background" strokeWidth={4} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary">Financeiro</div>
                      <div className="text-xs text-text-muted truncate">
                        {cliente?.financeiroEmail || "Não cadastrado"}
                        {cliente?.financeiroNome && (
                          <span className="text-text-muted/70"> · {cliente.financeiroNome}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Outro */}
                  <div
                    onClick={() => setContatoCliente("outro")}
                    className={`w-full flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-all cursor-pointer ${
                      contatoCliente === "outro"
                        ? "border-gold bg-gold/5"
                        : "border-border hover:border-gold/50"
                    }`}
                  >
                    <div
                      className={`mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        contatoCliente === "outro" ? "border-gold bg-gold" : "border-border"
                      }`}
                    >
                      {contatoCliente === "outro" && (
                        <Check className="h-2.5 w-2.5 text-background" strokeWidth={4} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-text-primary">Outro email</div>
                      <Input
                        type="email"
                        placeholder="nome@exemplo.com.br"
                        value={emailOutro}
                        onChange={(e) => setEmailOutro(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => setContatoCliente("outro")}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {destino === "ambos" && (
                <div className="rounded-md bg-surface-2 border border-border px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                    SOps também recebe
                  </div>
                  <div className="text-sm text-text-primary">{EMAIL_SOPS}</div>
                </div>
              )}
            </div>
          )}

          {/* ENVIANDO */}
          {step === "enviando" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-gold animate-spin" />
              <div className="text-sm text-text-secondary">Enviando email...</div>
            </div>
          )}

          {/* RESULTADO */}
          {step === "resultado" && resultado && (
            <div
              className={`rounded-md border px-4 py-4 ${
                resultado.ok
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <div className="flex items-start gap-3">
                {resultado.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold ${
                      resultado.ok ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {resultado.msg}
                  </div>
                  {resultado.detalhes && resultado.detalhes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {resultado.detalhes.map((d, i) => (
                        <li key={i} className="text-xs text-text-secondary font-mono">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-surface-2/40 border-t border-border">
          {step === "destino" && (
            <Button variant="outline" onClick={handleFechar}>
              Cancelar
            </Button>
          )}

          {step === "detalhes" && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep("destino")}
                className="text-text-secondary"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={() => handleEnviar(destino!, emailClienteSelecionado)}
                disabled={!podeEnviar}
                className="bg-gold text-background hover:bg-gold-light"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </>
          )}

          {step === "enviando" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </Button>
          )}

          {step === "resultado" && (
            <Button onClick={handleFechar} variant={resultado?.ok ? "default" : "outline"}>
              {resultado?.ok ? "Fechar" : "Voltar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
