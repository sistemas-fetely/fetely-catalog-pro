import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Edit2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useGrupos, useVisibleGrupos } from "@/store/grupoStore";
import { useClientes } from "@/store/clienteStore";
import type { GrupoCliente } from "@/types/grupo";
import { GrupoFormModal } from "./GrupoFormModal";
import { DuplicarPedidoModal } from "@/components/duplicar/DuplicarPedidoModal";

export function GruposListPage() {
  const grupos = useVisibleGrupos();
  const clientes = useClientes((s) => s.clientes);
  const deleteGrupo = useGrupos((s) => s.deleteGrupo);

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoCliente | null>(null);
  const [duplicarGrupo, setDuplicarGrupo] = useState<GrupoCliente | null>(null);

  const clienteById = useMemo(() => {
    const m = new Map(clientes.map((c) => [c.id, c]));
    return m;
  }, [clientes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter(
      (g) =>
        g.nome.toLowerCase().includes(q) ||
        (g.descricao ?? "").toLowerCase().includes(q) ||
        g.clienteIds.some((cid) =>
          (clienteById.get(cid)?.razaoSocial ?? "").toLowerCase().includes(q),
        ),
    );
  }, [grupos, query, clienteById]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            className="w-full bg-surface-2 border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-gold"
            placeholder="Buscar grupo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background hover:bg-gold-light"
        >
          <Plus className="h-4 w-4" /> Novo Grupo
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg gold-border bg-surface p-12 text-center text-text-secondary text-sm">
          {grupos.length === 0
            ? "Você ainda não tem grupos. Crie um grupo para reunir CNPJs de uma mesma rede."
            : "Nenhum grupo encontrado para essa busca."}
        </div>
      ) : (
        <div className="rounded-lg gold-border bg-surface divide-y divide-border/50 overflow-hidden">
          {filtered.map((g) => {
            const membros = g.clienteIds
              .map((id) => clienteById.get(id))
              .filter(Boolean) as NonNullable<ReturnType<typeof clienteById.get>>[];
            return (
              <div key={g.id} className="p-4 flex items-start gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: g.cor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-text-primary truncate">{g.nome}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-text-muted">
                        {membros.length} cliente{membros.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {g.descricao && (
                      <p className="text-xs text-text-secondary mt-0.5">{g.descricao}</p>
                    )}
                    <div className="text-[11px] text-text-muted mt-1 truncate">
                      {membros.slice(0, 5).map((c) => c.cnpjFormatado || c.razaoSocial).join(" · ")}
                      {membros.length > 5 && ` · +${membros.length - 5}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setDuplicarGrupo(g)}
                    title="Duplicar pedido p/ grupo"
                    className="inline-flex items-center gap-1.5 rounded-md gold-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-gold hover:bg-gold/10"
                  >
                    <Copy className="h-3 w-3" /> Duplicar p/ grupo
                  </button>
                  <button
                    onClick={() => { setEditing(g); setModalOpen(true); }}
                    title="Editar grupo"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-text-secondary hover:text-text-primary"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Excluir o grupo "${g.nome}"? Os clientes permanecem cadastrados.`)) return;
                      try {
                        await deleteGrupo(g.id);
                        toast.success("Grupo excluído");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erro ao excluir");
                      }
                    }}
                    title="Excluir grupo"
                    className="inline-flex items-center gap-1 rounded-md border border-stock-out/40 px-2 py-1.5 text-stock-out hover:bg-stock-out/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <GrupoFormModal
          grupo={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      )}

      {duplicarGrupo && (
        <DuplicarPedidoModal
          grupoInicial={duplicarGrupo}
          onClose={() => setDuplicarGrupo(null)}
        />
      )}
    </div>
  );
}
