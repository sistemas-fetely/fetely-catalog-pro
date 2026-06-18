import { useMemo, useState } from "react";
import { X, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useGrupos } from "@/store/grupoStore";
import { useClientes } from "@/store/clienteStore";
import { useAuth } from "@/store/authStore";
import { CORES_GRUPO, type GrupoCliente } from "@/types/grupo";

export function GrupoFormModal({
  grupo,
  onClose,
}: {
  grupo: GrupoCliente | null;
  onClose: () => void;
}) {
  const upsertGrupo = useGrupos((s) => s.upsertGrupo);
  const clientes = useClientes((s) => s.clientes);
  const user = useAuth((s) => s.user);

  const [step, setStep] = useState<1 | 2>(1);
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [descricao, setDescricao] = useState(grupo?.descricao ?? "");
  const [cor, setCor] = useState(grupo?.cor ?? CORES_GRUPO[0].valor);
  const [selecionados, setSelecionados] = useState<Set<string>>(
    new Set(grupo?.clienteIds ?? []),
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return clientes.filter((c) => {
      if (!q) return true;
      return (
        c.razaoSocial.toLowerCase().includes(q) ||
        c.nomeFantasia.toLowerCase().includes(q) ||
        (digits && c.cnpj.includes(digits)) ||
        c.cidade.toLowerCase().includes(q)
      );
    });
  }, [clientes, query]);

  const toggle = (id: string) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do grupo"); setStep(1); return; }
    if (selecionados.size === 0) { toast.error("Selecione ao menos um cliente"); setStep(2); return; }
    if (!user?.id) { toast.error("Sessão inválida"); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const next: GrupoCliente = {
        id: grupo?.id ?? crypto.randomUUID(),
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        cor,
        clienteIds: Array.from(selecionados),
        criadoPorVendedorId: grupo?.criadoPorVendedorId ?? user.id,
        criadoEm: grupo?.criadoEm ?? now,
        atualizadoEm: now,
        ativo: grupo?.ativo ?? true,
      };
      await upsertGrupo(next);
      toast.success(grupo ? "Grupo atualizado" : "Grupo criado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-lg border border-gold/40 bg-surface flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold">
              {grupo ? "Editar grupo" : "Novo grupo"} · Passo {step}/2
            </div>
            <h3 className="font-display text-xl mt-0.5">
              {step === 1 ? "Identidade" : "Selecionar clientes"}
            </h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 1 ? (
            <div className="space-y-4">
              <label className="block">
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Nome *</div>
                <input
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Rede Ateliê das Rosas"
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
                  placeholder="Unidades, observações..."
                />
              </label>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Cor</div>
                <div className="flex flex-wrap gap-2">
                  {CORES_GRUPO.map((c) => (
                    <button
                      key={c.valor}
                      type="button"
                      onClick={() => setCor(c.valor)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                        cor === c.valor
                          ? "border-gold bg-gold/10 text-text-primary"
                          : "border-border text-text-secondary hover:border-gold/50"
                      }`}
                    >
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.valor }} />
                      {c.nome}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome, CNPJ ou cidade..."
                  className="w-full bg-surface-2 border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
              <div className="border border-border rounded-md max-h-[400px] overflow-y-auto divide-y divide-border/50">
                {filtered.length === 0 && (
                  <div className="p-6 text-center text-sm text-text-muted">Nenhum cliente encontrado.</div>
                )}
                {filtered.map((c) => {
                  const checked = selecionados.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition ${
                        checked ? "bg-gold/5" : "hover:bg-surface-2/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                        className="accent-gold"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{c.nomeFantasia || c.razaoSocial}</div>
                        <div className="text-[11px] font-mono text-text-muted truncate">
                          {c.cnpjFormatado || "—"} · {c.cidade}/{c.estado}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="text-xs text-text-muted">
                Selecionados: <span className="text-gold font-medium">{selecionados.size}</span> cliente{selecionados.size === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 px-5 py-4 border-t border-border">
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
          ) : (
            <button onClick={onClose} className="text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary">
              Cancelar
            </button>
          )}
          {step === 1 ? (
            <button
              onClick={() => {
                if (!nome.trim()) { toast.error("Informe o nome"); return; }
                setStep(2);
              }}
              className="rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-wider text-background hover:bg-gold-light disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar grupo"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
