import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Copy, X, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { useDuplicacao } from "@/store/duplicacaoStore";
import { useOrder } from "@/store/orderStore";
import { useClientes } from "@/store/clienteStore";

export function FilaDuplicacaoBar() {
  const ativo = useDuplicacao((s) => s.ativo);
  const fila = useDuplicacao((s) => s.fila);
  const origem = useDuplicacao((s) => s.origem);
  const pular = useDuplicacao((s) => s.pular);
  const cancelar = useDuplicacao((s) => s.cancelar);
  const finalizar = useDuplicacao((s) => s.finalizar);
  const clearCart = useOrder((s) => s.clearCart);
  const setCartItems = useOrder((s) => s.addBulk);
  const setMeta = useOrder((s) => s.setMeta);
  const clientes = useClientes((s) => s.clientes);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  if (!ativo || !origem) return null;

  const total = fila.length;
  const concluidos = fila.filter((f) => f.status !== "pendente").length;
  const atual = fila.find((f) => f.status === "pendente");

  const carregarProximo = () => {
    const prox = fila.find((f) => f.status === "pendente");
    if (!prox) {
      finalizar();
      toast.success("Fila concluída");
      navigate({ to: "/orders" });
      return;
    }
    const c = clientes.find((x) => x.id === prox.clienteId);
    if (!c) {
      pular(prox.clienteId);
      return;
    }
    clearCart();
    setCartItems(origem.itens.map((i) => ({ product: i.product, quantity: i.quantity })));
    setMeta({
      clienteId: c.id,
      cliente: c.razaoSocial,
      nomeFantasia: c.nomeFantasia,
      cnpj: c.cnpjFormatado,
      email: c.contatoEmail,
      telefone: c.contatoTelefone,
      municipio: c.cidade,
      uf: c.estado,
      cep: c.cep,
    });
    if (pathname !== "/cart") navigate({ to: "/cart" });
  };

  return (
    <div className="fixed top-16 inset-x-0 z-40 border-b border-gold/40 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 shadow-md">
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <Copy className="h-4 w-4 text-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-gold">
            Fila de duplicação · {concluidos}/{total}
          </div>
          <div className="text-xs text-text-secondary truncate">
            Origem: <span className="text-text-primary">{origem.refLabel}</span>
            {atual && <> · Próximo: <span className="text-text-primary">{atual.clienteNome}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {atual && pathname !== "/cart" && (
            <button
              onClick={carregarProximo}
              className="rounded-md bg-gold px-3 py-1.5 text-[10px] uppercase tracking-wider text-background hover:bg-gold-light"
            >
              Revisar agora →
            </button>
          )}
          {atual && (
            <button
              onClick={() => { pular(atual.clienteId); setTimeout(carregarProximo, 50); }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
            >
              <SkipForward className="h-3 w-3" /> Pular
            </button>
          )}
          {!atual && (
            <button
              onClick={() => { finalizar(); navigate({ to: "/orders" }); }}
              className="rounded-md bg-gold px-3 py-1.5 text-[10px] uppercase tracking-wider text-background hover:bg-gold-light"
            >
              Concluir
            </button>
          )}
          <button
            onClick={() => { if (confirm("Cancelar a fila de duplicação?")) cancelar(); }}
            className="text-text-muted hover:text-stock-out p-1"
            title="Cancelar fila"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
