import { useMemo, useState } from "react";
import { Search, Plus, UserCircle2, ChevronDown } from "lucide-react";
import { useClientes, searchClientesForOrder } from "@/store/clienteStore";
import { useAuth } from "@/store/authStore";
import { ClienteFormModal } from "./ClienteFormModal";
import type { Cliente } from "@/types/cliente";

export interface ClienteSelectorProps {
  selectedId?: string;
  onSelect: (cliente: Cliente) => void;
  onClear: () => void;
}

export function ClienteSelector({
  selectedId,
  onSelect,
  onClear,
}: ClienteSelectorProps) {
  const getById = useClientes((s) => s.getById);
  const allClientes = useClientes((s) => s.clientes); // subscribe for reactivity
  const user = useAuth((s) => s.user);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const selected = selectedId ? getById(selectedId) : undefined;

  const results = useMemo(() => {
    // touch allClientes for reactivity
    void allClientes.length;
    return searchClientesForOrder(query);
  }, [query, allClientes]);

  if (selected) {
    const enderecoEntrega = selected.enderecoEntregaIgual
      ? `${selected.logradouro}${selected.numero ? `, ${selected.numero}` : ""} — ${selected.cidade}/${selected.estado}`
      : `${selected.entregaLogradouro ?? selected.logradouro}${
          selected.entregaNumero ? `, ${selected.entregaNumero}` : ""
        } — ${selected.entregaCidade ?? selected.cidade}/${selected.entregaEstado ?? selected.estado}`;

    return (
      <>
        <div className="rounded-md gold-border bg-surface-2 p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold">
              ✦ Cliente selecionado
            </div>
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] uppercase tracking-wider text-text-secondary hover:text-gold"
            >
              Trocar
            </button>
          </div>
          <div className="font-display text-lg text-text-primary">
            {selected.nomeFantasia || selected.razaoSocial}
          </div>
          {selected.cnpjFormatado && (
            <div className="text-xs text-text-secondary">
              CNPJ: {selected.cnpjFormatado}
            </div>
          )}
          <div className="text-xs text-text-secondary">
            {selected.cidade}/{selected.estado}
            {selected.contatoTelefone ? ` · ${selected.contatoTelefone}` : ""}
          </div>
          {selected.contatoNome && (
            <div className="text-xs text-text-secondary">
              Contato: {selected.contatoNome}
              {selected.contatoEmail ? ` · ${selected.contatoEmail}` : ""}
            </div>
          )}
          {!selected.enderecoEntregaIgual && (
            <div className="mt-2 rounded bg-surface border border-gold/30 px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-gold-muted">
                Entregar em
              </div>
              <div className="text-xs text-text-primary">{enderecoEntrega}</div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <input
              className="w-full bg-surface-2 border border-border rounded-md pl-9 pr-3 py-2 text-sm text-text-primary outline-none focus:border-gold"
              placeholder="Buscar cliente cadastrado..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-gold text-background text-xs font-semibold uppercase tracking-wider hover:bg-gold-light"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
        <p className="mt-1 text-[10px] text-text-muted">
          Digite nome, CNPJ ou cidade
        </p>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-md gold-border bg-surface shadow-lg overflow-hidden max-h-80 overflow-y-auto">
            {results.length === 0 && (
              <div className="p-3 text-xs text-text-muted text-center">
                Nenhum cliente encontrado.
              </div>
            )}
            {results.map((c) => {
              const mine = c.cadastradoPorVendedorId === user?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(c);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-surface-hover transition"
                >
                  <div className="flex items-start gap-2">
                    <UserCircle2 className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text-primary truncate">
                        {c.nomeFantasia || c.razaoSocial}
                      </div>
                      <div className="text-[11px] text-text-secondary truncate">
                        {c.cnpjFormatado || "Sem CNPJ"} · {c.cidade}/{c.estado}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        Cadastrado por: {mine ? "você" : c.cadastradoPorVendedorNome}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                setModalOpen(true);
              }}
              className="w-full text-left px-3 py-2.5 bg-surface-2 hover:bg-surface-hover text-xs text-gold inline-flex items-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" /> Cadastrar novo cliente
            </button>
          </div>
        )}
      </div>

      <ClienteFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={(c) => onSelect(c)}
      />
    </>
  );
}
