import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Heart, Search, ShoppingBag, ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { PRODUCTS, CATEGORIES } from "@/data/products";
import type { Product } from "@/types";
import { formatBRL, isValidMultiple } from "@/lib/format";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { StockBadge } from "@/components/ui/StockBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { fetchCNPJ, formatCNPJ, isValidCNPJLength, onlyDigits } from "@/lib/cnpj";
import { toast } from "sonner";
import { SEGMENTO_LABEL, type SegmentoCliente } from "@/types/preSelecao";
import { buildPreSelecao, encodePreSelecao, itemFromProductQty } from "@/lib/preSelecao";
import { usePreSelecao } from "@/store/preSelecaoStore";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  v: z.string().optional(),
});

export const Route = createFileRoute("/pre-selecao")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Fetély — Catálogo de Pré-seleção" },
      { name: "description", content: "Marque os produtos de seu interesse antes da reunião com nosso time." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreSelecaoPage,
});

type CartMap = Record<string, number>; // sku → qty (0 = ♡ interesse sem qtd)

function PreSelecaoPage() {
  const { v } = Route.useSearch();
  const [cart, setCart] = useState<CartMap>({});
  const [busca, setBusca] = useState("");
  const [colecaoAtiva, setColecaoAtiva] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmado, setConfirmado] = useState<{ id: string; link: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const produtos = useMemo(
    () => PRODUCTS.filter((p) => p.ativo !== false && p.precoVarejo > 0),
    [],
  );

  const colecoesPorCategoria = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const cat of CATEGORIES) {
      m[cat] = Array.from(new Set(produtos.filter((p) => p.categoria === cat).map((p) => p.colecao)));
    }
    return m;
  }, [produtos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (colecaoAtiva && p.colecao !== colecaoAtiva) return false;
      if (!q) return true;
      const bag = `${p.nomeComercial} ${p.colecao} ${p.grupo} ${p.corNome}`.toLowerCase();
      return bag.includes(q);
    });
  }, [produtos, colecaoAtiva, busca]);

  const resumo = useMemo(() => {
    const skus = Object.keys(cart).filter((sku) => cart[sku] !== undefined);
    let unidades = 0;
    let varejo = 0;
    let interessesSemQtd = 0;
    for (const sku of skus) {
      const p = produtos.find((x) => x.sku === sku);
      if (!p) continue;
      const q = cart[sku];
      if (q === 0) interessesSemQtd++;
      unidades += q;
      varejo += q * p.precoVarejo;
    }
    return { totalItens: skus.length, unidades, varejo, interessesSemQtd };
  }, [cart, produtos]);

  function setQty(sku: string, q: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (q < 0) delete next[sku];
      else next[sku] = q;
      return next;
    });
  }

  function toggleInteresse(sku: string) {
    setCart((prev) => {
      const next = { ...prev };
      if (sku in next) delete next[sku];
      else next[sku] = 0;
      return next;
    });
  }

  function selecionarColecao(c: string | null) {
    setColecaoAtiva(c);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canSubmit = resumo.totalItens > 0;

  const Sidebar = (
    <aside className="w-full h-full overflow-y-auto bg-surface border-r border-border p-4">
      <button
        onClick={() => selecionarColecao(null)}
        className={cn(
          "w-full text-left px-3 py-2 rounded-md text-sm mb-4",
          colecaoAtiva === null ? "bg-gold/15 text-gold" : "text-text-secondary hover:bg-surface-hover",
        )}
      >
        Todos os produtos
      </button>
      {CATEGORIES.map((cat) => (
        <div key={cat} className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-muted mb-2 px-3">{cat}</div>
          <ul className="space-y-0.5">
            {colecoesPorCategoria[cat]?.map((col) => (
              <li key={col}>
                <button
                  onClick={() => selecionarColecao(col)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-md text-sm",
                    colecaoAtiva === col
                      ? "bg-gold/15 text-gold"
                      : "text-text-primary hover:bg-surface-hover",
                  )}
                >
                  {col}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 h-16 flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden text-text-secondary hover:text-gold p-1" aria-label="Coleções">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] bg-surface border-r border-border">
              {Sidebar}
            </SheetContent>
          </Sheet>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-display text-xl sm:text-2xl tracking-[0.2em] truncate">FETÉLY</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.3em] text-gold-muted">
              Catálogo de Pré-seleção
            </span>
          </div>
          <div className="ml-auto flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produtos, coleções..."
              className="pl-9 h-9 bg-surface-2"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 mx-auto max-w-[1400px] w-full">
        <div className="hidden md:block w-64 shrink-0">{Sidebar}</div>

        <main className="flex-1 px-4 md:px-6 py-6 pb-32">
          <div className="mb-6">
            <h1 className="font-display text-3xl md:text-4xl">
              {colecaoAtiva ?? "Nossa Coleção"}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Marque os produtos e quantidades de interesse. Nosso time entrará em contato com a proposta.
            </p>
          </div>

          {filtrados.length === 0 ? (
            <div className="text-center py-20 text-text-secondary text-sm">
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtrados.map((p) => (
                <ProdutoCard
                  key={p.sku}
                  p={p}
                  qty={cart[p.sku]}
                  onQty={(q) => setQty(p.sku, q)}
                  onInteresse={() => toggleInteresse(p.sku)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Summary bar */}
      <div className={cn(
        "fixed bottom-0 inset-x-0 z-40 border-t border-gold/40 bg-background/95 backdrop-blur",
        !canSubmit && "opacity-90",
      )}>
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              <Heart className="inline h-4 w-4 text-gold mr-1.5" />
              {resumo.totalItens} {resumo.totalItens === 1 ? "item selecionado" : "itens selecionados"} · {resumo.unidades} un.
              {resumo.interessesSemQtd > 0 && (
                <span className="text-text-secondary"> · {resumo.interessesSemQtd} sem qtd</span>
              )}
            </div>
            <div className="text-xs text-text-secondary">
              Valor de referência (varejo): <span className="text-gold font-medium">{formatBRL(resumo.varejo)}</span>
            </div>
          </div>
          <Button
            disabled={!canSubmit}
            onClick={() => setModalOpen(true)}
            className="bg-gold hover:bg-gold-light text-background shrink-0"
          >
            Enviar interesse
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DadosEmpresaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        cart={cart}
        produtos={produtos}
        vendedor={v ?? null}
        onDone={(pre) => {
          setModalOpen(false);
          const link = `${window.location.origin}/reunioes/importar#${encodePreSelecao(pre)}`;
          setConfirmado({ id: pre.id, link });
          setCart({});
        }}
      />

      {confirmado && (
        <ConfirmacaoDialog id={confirmado.id} link={confirmado.link} onClose={() => setConfirmado(null)} />
      )}
    </div>
  );
}

function ProdutoCard({
  p,
  qty,
  onQty,
  onInteresse,
}: {
  p: Product;
  qty: number | undefined;
  onQty: (q: number) => void;
  onInteresse: () => void;
}) {
  const selected = qty !== undefined;
  const isInterest = qty === 0;

  return (
    <div className={cn(
      "rounded-lg border bg-surface p-3 flex flex-col gap-3 transition",
      selected ? "border-gold/60 shadow-[0_0_0_1px_rgba(201,168,76,0.3)]" : "border-border hover:border-gold/30",
    )}>
      <div className="aspect-square rounded-md bg-surface-2 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-3xl text-gold-muted/40 uppercase tracking-widest">
            {p.colecao.slice(0, 2)}
          </span>
        </div>
        {selected && (
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-gold text-background grid place-items-center">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gold-muted">{p.colecao}</div>
        <div className="text-sm font-medium leading-tight line-clamp-2">{p.nomeComercial}</div>
        <div className="text-xs text-text-secondary mt-0.5">
          {p.corNome}{p.tamanhoNumero && ` · ${p.tamanhoNumero}`}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gold">{formatBRL(p.precoVarejo)}</div>
          <div className="text-[10px] text-text-muted">/ un varejo</div>
        </div>
        <StockBadge status={p.statusEstoque} />
      </div>
      <div className="text-[10px] text-text-muted">
        Caixa com {p.multiplos} un.
      </div>
      {isInterest ? (
        <div className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs text-gold text-center">
          <Heart className="inline h-3.5 w-3.5 mr-1" fill="currentColor" />
          Interesse marcado (qtd a definir)
        </div>
      ) : (
        <QuantityInput
          value={qty ?? 0}
          onChange={onQty}
          multiplos={p.multiplos}
          compact
        />
      )}
      <button
        onClick={onInteresse}
        className={cn(
          "text-[11px] uppercase tracking-wider py-1.5 rounded-md border transition",
          isInterest
            ? "border-gold/50 text-gold hover:bg-gold/10"
            : "border-border text-text-secondary hover:border-gold/40 hover:text-gold",
        )}
      >
        <Heart className="inline h-3 w-3 mr-1" fill={isInterest ? "currentColor" : "none"} />
        {isInterest ? "Remover interesse" : "Tenho interesse"}
      </button>
    </div>
  );
}

function DadosEmpresaModal({
  open,
  onOpenChange,
  cart,
  produtos,
  vendedor,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cart: CartMap;
  produtos: Product[];
  vendedor: string | null;
  onDone: (pre: ReturnType<typeof buildPreSelecao>) => void;
}) {
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoCargo, setContatoCargo] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoWhatsapp, setContatoWhatsapp] = useState("");
  const [cidadeEstado, setCidadeEstado] = useState("");
  const [segmento, setSegmento] = useState<SegmentoCliente>("boutique_decoracao");
  const [observacao, setObservacao] = useState("");
  const [aceitaNewsletter, setAceitaNewsletter] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const adicionar = usePreSelecao((s) => s.adicionar);
  const hydrate = usePreSelecao((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  async function buscarCnpj() {
    if (!isValidCNPJLength(cnpj)) {
      toast.error("Informe um CNPJ válido");
      return;
    }
    setBuscando(true);
    try {
      const data = await fetchCNPJ(cnpj);
      setRazaoSocial(data.razaoSocial);
      setNomeFantasia(data.nomeFantasia || data.razaoSocial);
      setContatoEmail((p) => p || data.email);
      setContatoWhatsapp((p) => p || data.telefone);
      setCidadeEstado(`${data.municipio} / ${data.uf}`);
      toast.success("Dados encontrados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar CNPJ");
    } finally {
      setBuscando(false);
    }
  }

  function validar(): string | null {
    if (!isValidCNPJLength(cnpj)) return "CNPJ inválido";
    if (!razaoSocial.trim()) return "Razão social obrigatória";
    if (!nomeFantasia.trim()) return "Nome fantasia obrigatório";
    if (!contatoNome.trim()) return "Nome do contato obrigatório";
    if (!contatoEmail.trim()) return "E-mail obrigatório";
    if (!contatoWhatsapp.trim()) return "WhatsApp obrigatório";
    return null;
  }

  async function enviar() {
    const err = validar();
    if (err) { toast.error(err); return; }

    setEnviando(true);
    try {
      const itens = Object.entries(cart).map(([sku, q]) => {
        const p = produtos.find((x) => x.sku === sku)!;
        return itemFromProductQty(p, q);
      });

      const pre = buildPreSelecao({
        vendedorId: vendedor,
        vendedorNome: null,
        cnpj: formatCNPJ(cnpj),
        razaoSocial,
        nomeFantasia,
        contatoNome,
        contatoCargo: contatoCargo || undefined,
        contatoEmail,
        contatoWhatsapp,
        cidadeEstado,
        segmento,
        observacao: observacao || undefined,
        aceitaNewsletter,
        itens,
      });

      // Salva no localStorage local (útil se cliente/vendedor for a mesma máquina)
      adicionar(pre);
      onDone(pre);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Antes de enviar</DialogTitle>
          <DialogDescription>
            Precisamos de algumas informações para personalizar nossa proposta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>CNPJ *</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              <Button type="button" variant="outline" onClick={buscarCnpj} disabled={buscando || !isValidCNPJLength(cnpj)}>
                {buscando ? "..." : "Buscar"}
              </Button>
            </div>
          </div>

          <div>
            <Label>Razão Social *</Label>
            <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Nome Fantasia *</Label>
            <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Nome do contato *</Label>
            <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Cargo / função</Label>
            <Input value={contatoCargo} onChange={(e) => setContatoCargo(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>E-mail *</Label>
            <Input type="email" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>WhatsApp *</Label>
            <Input value={contatoWhatsapp} onChange={(e) => setContatoWhatsapp(e.target.value)} className="mt-1" placeholder="(11) 99999-9999" />
          </div>

          <div className="md:col-span-2">
            <Label>Cidade / Estado</Label>
            <Input value={cidadeEstado} onChange={(e) => setCidadeEstado(e.target.value)} className="mt-1" />
          </div>

          <div className="md:col-span-2">
            <Label>Segmento *</Label>
            <select
              value={segmento}
              onChange={(e) => setSegmento(e.target.value as SegmentoCliente)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {Object.entries(SEGMENTO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <Label>Observação (opcional)</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="mt-1" rows={3} />
          </div>

          <label className="md:col-span-2 flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={aceitaNewsletter}
              onChange={(e) => setAceitaNewsletter(e.target.checked)}
              className="accent-gold"
            />
            Tenho interesse em receber novidades e lançamentos
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            onClick={enviar}
            disabled={enviando}
            className="bg-gold hover:bg-gold-light text-background"
          >
            {enviando ? "Enviando..." : "Enviar pré-seleção ✦"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmacaoDialog({ id, link, onClose }: { id: string; link: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md text-center">
        <div className="text-4xl text-gold">✦</div>
        <DialogTitle className="font-display text-2xl text-center">Pré-seleção enviada!</DialogTitle>
        <p className="text-sm text-text-secondary">
          Nossa equipe já recebeu sua lista. Em breve entraremos em contato.
        </p>
        <div className="rounded-md bg-surface-2 py-2 text-sm">
          Protocolo: <span className="font-semibold text-gold">#{id}</span>
        </div>
        <p className="text-[11px] text-text-muted">Válido por 72 horas</p>
        <details className="text-left text-xs text-text-muted">
          <summary className="cursor-pointer">Link de sincronização (compartilhe com o vendedor)</summary>
          <div className="mt-2 break-all bg-surface-2 p-2 rounded text-[10px]">{link}</div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
          >
            Copiar link
          </Button>
        </details>
        <div className="text-xs text-text-secondary pt-2">
          Fetély — Celebre o que importa. 🌟
        </div>
      </DialogContent>
    </Dialog>
  );
}
