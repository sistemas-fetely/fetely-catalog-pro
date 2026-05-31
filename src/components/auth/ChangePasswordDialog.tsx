import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setNovaSenha("");
    setConfirmar("");
    setSaving(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 8) {
      toast.error("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível alterar a senha.");
      return;
    }
    toast.success("Senha alterada com sucesso.");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <KeyRound className="h-4 w-4 text-gold" />
            Mudar senha
          </DialogTitle>
          <DialogDescription className="text-xs text-text-secondary">
            Defina uma nova senha de acesso. Mínimo de 8 caracteres.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha" className="text-[11px] uppercase tracking-wider text-text-secondary">
              Nova senha
            </Label>
            <Input
              id="nova-senha"
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              minLength={8}
              className="bg-surface-2 border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-senha" className="text-[11px] uppercase tracking-wider text-text-secondary">
              Confirmar nova senha
            </Label>
            <Input
              id="confirmar-senha"
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
              minLength={8}
              className="bg-surface-2 border-border"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gold text-background hover:bg-gold-light"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
