import { useState } from "react";
import { Send, Loader2, Check, AlertTriangle, X, RotateCw, Lock } from "lucide-react";
import { useEnviarParaSncf } from "@/hooks/useEnviarParaSncf";
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
import { useNegotiation } from "@/store/negotiationStore";
import { useAuth } from "@/store/authStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { OrderCommercial } from "@/types";

function formatData(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}h${mm}`;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const BASE =
  "flex items-center justify-center rounded-md border w-8 h-8 transition";

export function BotaoEnviarSncf({ orderId }: { orderId: string }) {
  const { status, estagio, erro, enviadoEm, enviar, isEnviando } = useEnviarParaSncf(orderId);
  const [reenvioOpen, setReenvioOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [aprovacaoOpen, setAprovacaoOpen] = useState(false);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [comercial, setComercial] = useState<Partial<OrderCommercial> | null>(null);
  const tryActivate = useNegotiation((s) => s.tryActivate);
  const canLiberar = useAuth((s) => s.roles.includes("admin") || s.roles.includes("master"));

  async function abrirAprovacao() {
    setAprovacaoOpen(true);
    setCarregandoResumo(true);
    try {
      const { data } = await supabase
        .from("orders")
        .select("commercial")
        .eq("id", orderId)
        .maybeSingle();
      setComercial((data?.commercial as Partial<OrderCommercial> | null) ?? null);
    } finally {
      setCarregandoResumo(false);
    }
  }

  const bruto = Number(comercial?.bruto ?? 0);
  const descCelebra = Number(comercial?.descontoCelebraValor ?? 0);
  const descMaster = Number(comercial?.descontoMasterValor ?? 0);
  const descontoValor = descCelebra + descMaster;
  const descontoPct = bruto > 0 ? (descontoValor / bruto) * 100 : 0;

  if (!canLiberar) {
    return (
      <button
        disabled
        title="Apenas admin/master pode liberar para o SNCF"
        className={`${BASE} border-border/60 text-text-muted opacity-60 cursor-not-allowed`}
      >
        <Lock className="h-3.5 w-3.5" />
      </button>
    );
  }

  const dialogAprovacao = (
    <Dialog open={aprovacaoOpen} onOpenChange={setAprovacaoOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar desconto antes de sincronizar</DialogTitle>
          <DialogDescription>
            Confira o desconto aplicado neste pedido. A sincronização com o SNCF
            só acontece após a aprovação.
          </DialogDescription>
        </DialogHeader>
        {carregandoResumo ? (
          <p className="text-xs text-text-secondary">Carregando resumo…</p>
        ) : (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Bruto</span>
              <span>{BRL(bruto)}</span>
            </div>
            {descCelebra > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Desconto Celebra ({Number(comercial?.descontoCelebraPct ?? 0)}%)
                </span>
                <span>-{BRL(descCelebra)}</span>
              </div>
            )}
            {descMaster > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Desconto negociação ({Number(comercial?.descontoMasterPct ?? 0)}%)
                </span>
                <span>-{BRL(descMaster)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Desconto total</span>
              <span>
                {descontoPct.toFixed(2)}% · {BRL(descontoValor)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold">
              <span>Total final</span>
              <span>{BRL(Number(comercial?.totalFinal ?? 0))}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAprovacaoOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={carregandoResumo}
            onClick={async () => {
              setAprovacaoOpen(false);
              await enviar();
            }}
          >
            Aprovar e sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  async function confirmarReenvio() {
    if (!senha.trim()) {
      toast.error("Digite a senha master.");
      return;
    }
    setVerificando(true);
    try {
      const r = await tryActivate(senha);
      if (!r.ok) {
        toast.error(r.erro ?? "Senha incorreta.");
        return;
      }
      setReenvioOpen(false);
      setSenha("");
      await abrirAprovacao();
    } finally {
      setVerificando(false);
    }
  }

  // Envio ativo nesta sessão → spinner desabilitado (transitório, esperado).
  if (status === "pendente" && isEnviando) {
    return (
      <button
        disabled
        title="Enviando..."
        className={`${BASE} border-gold/40 text-gold opacity-60`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </button>
    );
  }

  // Pendente carregado do banco sem envio ativo = preso. Reabilita o clique
  // pra reenviar em vez de girar pra sempre.
  if (status === "pendente" && !isEnviando) {
    return (
      <button
        onClick={() => enviar()}
        title="Preso em 'pendente' — clique pra reenviar"
        className={`${BASE} border-amber-500/40 text-amber-500 hover:bg-amber-500/10`}
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (status === "enviado") {
    const quando = enviadoEm ? formatData(enviadoEm) : "";
    const onde = estagio ?? "";
    return (
      <>
        <button
          onClick={() => setReenvioOpen(true)}
          title={`Enviado em ${quando}${onde ? ` • em ${onde}` : ""} — clique pra reenviar (senha master)`}
          className={`${BASE} border-green-500/40 text-green-500 hover:bg-green-500/10 relative group`}
        >
          <Check className="h-3.5 w-3.5 group-hover:hidden" />
          <RotateCw className="h-3.5 w-3.5 hidden group-hover:block" />
        </button>
        <Dialog open={reenvioOpen} onOpenChange={(o) => { setReenvioOpen(o); if (!o) setSenha(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reenviar pedido pro SNCF</DialogTitle>
              <DialogDescription>
                Este pedido já foi enviado em {quando}{onde ? ` (${onde})` : ""}.
                Digite a senha master para reenviar com as mesmas configurações.
              </DialogDescription>
            </DialogHeader>
            <Input
              type="password"
              placeholder="Senha master"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void confirmarReenvio(); }}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReenvioOpen(false)} disabled={verificando}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmarReenvio()} disabled={verificando}>
                {verificando ? "Verificando..." : "Reenviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (status === "erro_persistente") {
    return (
      <button
        onClick={() => enviar()}
        title={`Falhou: ${erro ?? "erro"} (clique pra tentar de novo)`}
        className={`${BASE} border-amber-500/40 text-amber-500 hover:bg-amber-500/10`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (status === "rejeitado") {
    return (
      <button
        disabled
        title={`Rejeitado: ${erro ?? "erro"}`}
        className={`${BASE} border-red-500/40 text-red-500`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => enviar()}
      title="Enviar pra SNCF"
      className={`${BASE} gold-border text-gold hover:bg-gold/10`}
    >
      <Send className="h-3.5 w-3.5" />
    </button>
  );
}
