import { useState } from "react";
import { X, Save } from "lucide-react";
import { toast } from "sonner";
import { useModelos } from "@/store/modeloStore";
import { useAuth } from "@/store/authStore";
import type { CartItem } from "@/types";

export function SalvarModeloModal({
  itens,
  onClose,
}: {
  itens: CartItem[];
  onClose: () => void;
}) {
  const upsertModelo = useModelos((s) => s.upsertModelo);
  const user = useAuth((s) => s.user);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do modelo"); return; }
    if (!user?.id) { toast.error("Sessão inválida"); return; }
    if (itens.length === 0) { toast.error("Carrinho vazio"); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await upsertModelo({
        id: crypto.randomUUID(),
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        itens: itens.map((i) => ({
          sku: i.sku,
          nomeComercial: i.product.nomeComercial,
          quantidade: i.quantity,
        })),
        criadoPorVendedorId: user.id,
        criadoEm: now,
        atualizadoEm: now,
      });
      toast.success("Modelo salvo");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar modelo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg border border-gold/40 bg-surface">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Modelo</div>
            <h3 className="font-display text-xl mt-0.5">Salvar como modelo</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-5 space-y-4">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Nome *</div>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Kit Velas Premium"
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Descrição</div>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-gold resize-none"
            />
          </label>
          <div className="text-xs text-text-muted">
            {itens.length} item(ns) · capturados apenas SKU e quantidade.
          </div>
        </div>
        <footer className="flex items-center justify-between gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar modelo"}
          </button>
        </footer>
      </div>
    </div>
  );
}
