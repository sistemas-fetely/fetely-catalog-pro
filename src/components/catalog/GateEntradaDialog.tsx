import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface GateEntradaValue {
  nome: string;
  whatsapp: string;
}

interface Props {
  open: boolean;
  vendedor?: string;
  onSubmit: (v: GateEntradaValue) => void | Promise<void>;
}

// Máscara BR: (99) 99999-9999
function formatWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 7);
  const p3 = digits.slice(7, 11);
  if (digits.length <= 2) return p1 ? `(${p1}` : "";
  if (digits.length <= 7) return `(${p1}) ${p2}`;
  return `(${p1}) ${p2}-${p3}`;
}

function whatsappDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export function GateEntradaDialog({ open, vendedor, onSubmit }: Props) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeOk = nome.trim().length >= 2;
  const wpDigits = whatsappDigits(whatsapp);
  const whatsappOk = wpDigits.length >= 10 && wpDigits.length <= 11;
  const pode = nomeOk && whatsappOk && !enviando;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pode) return;
    setErro(null);
    setEnviando(true);
    try {
      await onSubmit({ nome: nome.trim(), whatsapp: wpDigits });
    } catch (err) {
      console.error("[gate] falha ao registrar identidade", err);
      setErro("Não conseguimos registrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-1">Catálogo Fetély</div>
          <DialogTitle className="font-display text-xl">Bem-vindo(a)</DialogTitle>
          <DialogDescription>
            {vendedor
              ? <>Antes de abrir o catálogo, deixe seu nome e WhatsApp para que <span className="text-gold uppercase tracking-wider">{vendedor}</span> possa dar continuidade ao atendimento.</>
              : "Deixe seu nome e WhatsApp para que possamos dar continuidade ao atendimento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="gate-nome">Seu nome</Label>
            <Input
              id="gate-nome"
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como podemos te chamar?"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gate-whatsapp">WhatsApp</Label>
            <Input
              id="gate-whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>

          {erro && <div className="text-xs text-red-500">{erro}</div>}

          <Button type="submit" disabled={!pode} className="w-full">
            {enviando ? "Registrando…" : "Ver catálogo"}
          </Button>
          <p className="text-[10px] text-text-muted text-center">
            Usamos apenas para atendimento comercial. Sem spam.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
