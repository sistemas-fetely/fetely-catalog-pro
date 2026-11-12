import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Loader2, MessageCircle, RefreshCw, Search, Store } from "lucide-react";
import { useAuth } from "@/store/authStore";
import { balcao } from "@/hooks/useBalcao";
import { EstoqueTab } from "@/components/balcao/EstoqueTab";
import { NovoPedidoTab } from "@/components/balcao/NovoPedidoTab";
import { CD_PADRAO, type PedidoDetalhe } from "@/components/balcao/types";
import { brl } from "@/lib/balcaoPedido";
export const Route = createFileRoute("/venda-b2c")({
  head: () => ({
    meta: [
      { title: "Venda B2C (Balcão) — Fetély" },
      { name: "description", content: "Lançamento de venda direta para consumidor final." },
      { property: "og:title", content: "Venda B2C (Balcão) — Fetély" },
      { property: "og:description", content: "Lançamento de venda direta para consumidor final." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VendaB2cPage,
});

type MeuPedido = {
  id: string;
  id_externo: string | null;
  recebido_em: string | null;
  estagio: string | null;
  situacao: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  valor_liquido: number | null;
  pagamento: string | null;
  pagamento_confirmado_em: string | null;
  link_pagamento: string | null;
  vendedor_nome?: string | null;
  eh_dono?: boolean;
  modal: string | null;
  frete_tipo: string | null;
  nf_numero: string | null;
  codigo_rastreio: string | null;
  rastreio_servico: string | null;
  cancelado_em: string | null;
};

function rotuloPagamento(p: string | null) {
  if (!p) return "—";
  if (p === "pix") return "PIX";
  if (p === "cartao") return "Cartão (link)";
  if (p === "cartao_maquininha") return "Maquininha";
  if (p === "bonificacao" || p === "sem_pagamento") return "Bonificação";
  return p;
}

const soDigitos = (v: string) => v.replace(/\D/g, "");
function whatsappUrl(telefone: string | null | undefined, mensagem: string) {
  const fone = soDigitos(telefone ?? "");
  return `https://wa.me/55${fone}?text=${encodeURIComponent(mensagem)}`;
}

function msgWhatsApp(nome: string, idExterno: string, total: number, link: string) {
  return `Olá ${nome}! Seu pedido ${idExterno} na Fetély ficou em ${brl(total)}. Pague por aqui: ${link}`;
}

function copiar(texto: string, rotulo = "Copiado") {
  navigator.clipboard
    .writeText(texto)
    .then(() => toast.success(rotulo))
    .catch(() => toast.error("Não foi possível copiar"));
}

function VendaB2cPage() {
  const [aba, setAba] = useState("novo");
  const [abrirPedidoId, setAbrirPedidoId] = useState<string | null>(null);
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Store className="h-5 w-5 text-gold" />
        <h1 className="font-display text-2xl text-text-primary">Venda B2C (Balcão)</h1>
      </div>
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:h-9 sm:w-auto">
          <TabsTrigger value="novo">Novo pedido</TabsTrigger>
          <TabsTrigger value="meus">Meus pedidos</TabsTrigger>
          <TabsTrigger value="todos">Todos os pedidos</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
        </TabsList>
        <TabsContent value="novo">
          <NovoPedidoTab onAbrirPedido={id => { setAbrirPedidoId(id); setAba("meus"); }} onFechar={() => setAba("meus")} />
        </TabsContent>
        <TabsContent value="meus">
          <MeusPedidosTab escopo="meus" abrirPedidoId={abrirPedidoId} onPedidoAberto={() => setAbrirPedidoId(null)} />
        </TabsContent>
        <TabsContent value="todos">
          <MeusPedidosTab escopo="todos" />
        </TabsContent>
        <TabsContent value="estoque">
          <EstoqueTab cdPadrao={CD_PADRAO} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Aba: Meus pedidos ============

type FiltroRapido = "todos" | "aguardando" | "pagos";

const SNCF_VENDEDOR = "SNCF";
const nomeVendedor = (p: MeuPedido) => p.vendedor_nome?.trim() || SNCF_VENDEDOR;

function MeusPedidosTab({ escopo, abrirPedidoId, onPedidoAberto }: { escopo: "meus" | "todos"; abrirPedidoId?: string | null; onPedidoAberto?: () => void }) {
  const todos = escopo === "todos";
  const [vendedorFiltro, setVendedorFiltro] = useState("__todos");
  const userId = useAuth(s => s.user?.id);
  const [detalhe, setDetalhe] = useState<PedidoDetalhe | null>(null);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroRapido>("todos");
  const [gerandoLinkId, setGerandoLinkId] = useState<string | null>(null);

  const { data, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["balcao-meus-pedidos", escopo, userId],
    queryFn: () => balcao<{ pedidos: MeuPedido[] }>("balcao_meus_pedidos", todos ? { dias: 90, escopo: "todos" } : { dias: 90 }),
    refetchInterval: 60_000,
    throwOnError: false,
    retry: false,
  });

  const pedidos = useMemo(() => data?.pedidos ?? [], [data]);

  const vendedores = useMemo(
    () => Array.from(new Set(pedidos.map(nomeVendedor))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pedidos],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (filtro === "aguardando" && (p.pagamento_confirmado_em || p.pagamento === "bonificacao" || p.pagamento === "sem_pagamento")) return false;
      if (filtro === "pagos" && !p.pagamento_confirmado_em) return false;
      if (todos && vendedorFiltro !== "__todos" && nomeVendedor(p) !== vendedorFiltro) return false;
      if (!termo) return true;
      return (
        (p.id_externo ?? "").toLowerCase().includes(termo) ||
        (p.cliente_nome ?? "").toLowerCase().includes(termo) ||
        (todos && nomeVendedor(p).toLowerCase().includes(termo))
      );
    });
  }, [pedidos, busca, filtro, todos, vendedorFiltro]);

  const gerarNovoLink = async (p: MeuPedido) => {
    setGerandoLinkId(p.id);
    try {
      const r = await balcao<{ url: string }>("balcao_link", {
        pedido_id: p.id,
        forcar_novo: true,
      });
      copiar(r.url, "Novo link copiado");
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link");
    } finally {
      setGerandoLinkId(null);
    }
  };

  const abrir = async (pedidoId: string) => {
    if (!userId) { toast.error("Faça login para abrir o pedido."); return; }
    setAbrindoId(pedidoId);
    try {
      const r = await balcao<PedidoDetalhe>("balcao_detalhe", { fop_profile_id: userId, pedido_id: pedidoId });
      setDetalhe(r);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao abrir pedido"); }
    finally { setAbrindoId(null); }
  };
  useEffect(() => {
    if (!abrirPedidoId || !userId) return;
    void abrir(abrirPedidoId);
    onPedidoAberto?.();
    // Only consume an id returned by the create flow; list fetching remains unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirPedidoId, userId]);
  if (detalhe) return <NovoPedidoTab key={detalhe.pedido.id} detalhe={detalhe} onVoltar={() => { setDetalhe(null); void refetch(); }} onSalvo={refetch} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-text-primary">
          {todos ? "Todos os pedidos" : "Meus pedidos"} (90 dias)
          <Button variant="ghost" size="sm" onClick={() => void refetch()} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              className="pl-9"
              placeholder={todos ? "Buscar por pedido, cliente ou vendedor" : "Buscar por pedido ou cliente"}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {todos && (
            <select
              aria-label="Filtrar por vendedor"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-text-primary"
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
            >
              <option value="__todos">Todos os vendedores</option>
              {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["aguardando", "Aguardando pagamento"],
                ["pagos", "Pagos"],
                ["todos", "Todos"],
              ] as [FiltroRapido, string][]
            ).map(([v, label]) => (
              <Button
                key={v}
                size="sm"
                variant={filtro === v ? "default" : "outline"}
                className={filtro === v ? "bg-gold text-background hover:bg-gold/90" : ""}
                onClick={() => setFiltro(v)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="space-y-2 rounded-md border border-border p-3 text-sm text-text-primary">
            <p>{error.message}</p>
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
              <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-text-secondary">Carregando…</p>
        ) : error && !data ? null : filtrados.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum pedido encontrado.</p>
        ) : (
          <div className="[&_td]:px-2 [&_th]:px-2">
            <Table className="min-w-[900px] xl:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  {todos && <TableHead>Vendedor</TableHead>}
                  <TableHead>Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => {
                  const pago = !!p.pagamento_confirmado_em;
                  const cancelado = !!p.cancelado_em;
                  const dono = p.eh_dono !== false;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="block whitespace-nowrap text-sm font-medium text-text-primary">
                          {p.id_externo ?? "—"}
                        </span>
                        <span className="whitespace-nowrap text-xs text-text-secondary">
                          {p.recebido_em
                            ? new Date(p.recebido_em).toLocaleDateString("pt-BR")
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-32 whitespace-normal break-words">
                        <span className="block text-sm text-text-primary">
                          {p.cliente_nome ?? "—"}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {p.cliente_telefone ?? ""}
                        </span>
                      </TableCell>
                      {todos && (
                        <TableCell className="min-w-24 whitespace-normal break-words text-xs text-text-primary">
                          {nomeVendedor(p)}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-sm text-text-primary">
                        {brl(p.valor_liquido)}
                      </TableCell>
                      <TableCell>
                        <span className="block text-xs text-text-secondary">
                          {rotuloPagamento(p.pagamento)}
                        </span>
                        {p.pagamento === "bonificacao" || p.pagamento === "sem_pagamento" ? (
                          <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-400">Bonificação</Badge>
                        ) : pago ? (
                          <span className="whitespace-nowrap text-xs text-emerald-400">
                            pago em{" "}
                            {new Date(p.pagamento_confirmado_em ?? "").toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400">aguardando</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words text-xs text-text-secondary">
                        {p.modal ?? "—"}
                        {p.frete_tipo ? ` · ${p.frete_tipo}` : ""}
                      </TableCell>
                      <TableCell>
                        {cancelado ? (
                          <Badge className="border-red-500/40 bg-red-500/10 text-red-400">
                            cancelado
                          </Badge>
                        ) : (
                          <span className="whitespace-normal text-xs text-text-secondary">
                            {p.situacao ?? p.estagio ?? "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {p.nf_numero ?? "—"}
                      </TableCell>
                      <TableCell>
                        {p.codigo_rastreio ? (
                          <button
                            className="flex items-center gap-1 break-all text-left text-xs text-gold hover:underline"
                            onClick={() => copiar(p.codigo_rastreio ?? "", "Rastreio copiado")}
                          >
                            {p.codigo_rastreio}
                            <Copy className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-xs text-text-secondary">—</span>
                        )}
                        {p.rastreio_servico && (
                          <span className="block text-[10px] text-text-secondary">
                            {p.rastreio_servico}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="w-24 align-top">
                        <Button variant="outline" size="sm" disabled={abrindoId !== null} onClick={() => void abrir(p.id)}>
                          {abrindoId === p.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Abrir
                        </Button>
                        {dono && !pago && !cancelado && (
                          <div className="mt-1 flex flex-col items-start gap-1">
                            {p.link_pagamento && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copiar(p.link_pagamento ?? "", "Link copiado")}
                                >
                                  <Copy className="mr-1 h-3 w-3" /> Link
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                  <a
                                    href={whatsappUrl(
                                      p.cliente_telefone,
                                      msgWhatsApp(
                                        p.cliente_nome ?? "",
                                        p.id_externo ?? "",
                                        p.valor_liquido ?? 0,
                                        p.link_pagamento,
                                      ),
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                                  </a>
                                </Button>
                              </>
                            )}
                            {p.pagamento === "cartao" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={gerandoLinkId === p.id}
                                onClick={() => void gerarNovoLink(p)}
                              >
                                {gerandoLinkId === p.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="mr-1 h-3 w-3" />
                                )}
                                Novo link
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
