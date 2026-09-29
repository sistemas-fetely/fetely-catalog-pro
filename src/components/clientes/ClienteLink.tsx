import { create } from "zustand";
import { toast } from "sonner";
import { useClientes } from "@/store/clienteStore";
import { ClienteFormModal } from "./ClienteFormModal";
import type { Cliente } from "@/types/cliente";

interface PopupState {
  cliente: Cliente | null;
  open: (c: Cliente) => void;
  close: () => void;
}

export const useClientePopup = create<PopupState>((set) => ({
  cliente: null,
  open: (c) => set({ cliente: c }),
  close: () => set({ cliente: null }),
}));

function resolveCliente(
  clientes: Cliente[],
  { clienteId, cnpj, nome }: { clienteId?: string | null; cnpj?: string | null; nome?: string | null },
) {
  if (clienteId) {
    const c = clientes.find((x) => x.id === clienteId);
    if (c) return c;
  }
  const digits = (cnpj ?? "").replace(/\D/g, "");
  if (digits) {
    const c = clientes.find((x) => x.cnpj === digits || (x.cpf ?? "") === digits);
    if (c) return c;
  }
  const n = (nome ?? "").trim().toLowerCase();
  if (n) {
    return clientes.find(
      (x) => x.razaoSocial?.trim().toLowerCase() === n || x.nomeFantasia?.trim().toLowerCase() === n,
    );
  }
  return undefined;
}

export function ClienteLink({
  clienteId,
  cnpj,
  nome,
  className = "",
}: {
  clienteId?: string | null;
  cnpj?: string | null;
  nome?: string | null;
  className?: string;
}) {
  const open = useClientePopup((s) => s.open);
  const label = nome || "—";
  if (!nome) return <span className={className}>—</span>;
  return (
    <button
      type="button"
      title="Ver cadastro do cliente"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const c = resolveCliente(useClientes.getState().clientes, { clienteId, cnpj, nome });
        if (c) open(c);
        else toast.error("Cadastro do cliente não encontrado.");
      }}
      className={`text-left underline-offset-2 hover:underline hover:text-gold cursor-pointer ${className}`}
    >
      {label}
    </button>
  );
}

/** Montado uma vez no layout raiz. */
export function ClientePopupHost() {
  const cliente = useClientePopup((s) => s.cliente);
  const close = useClientePopup((s) => s.close);
  return (
    <ClienteFormModal
      open={!!cliente}
      onOpenChange={(v) => !v && close()}
      initial={cliente}
    />
  );
}
