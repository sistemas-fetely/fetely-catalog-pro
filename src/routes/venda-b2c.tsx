import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown, Copy, Loader2, MessageCircle, Plus, RefreshCw,
  Search, Store, Trash2, UserPlus,
} from "lucide-react";
import { balcao } from "@/hooks/useBalcao";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";

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

// ============ Tipos do contrato SNCF ============

type BalcaoCliente = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

type BalcaoProduto = {
  sku: string;
  cod_cadastro: string | null;
  ean: string | null;
  nome: string;
  preco_varejo: number;
  disponivel_site_sp: number;
  colecao: string | null;
  cor_nome: string | null;
};

type Item = BalcaoProduto & { quantidade: number };

type ModoEntrega = "retirada" | "sedex" | "pac" | "frete_fetely";

type OpcaoEntrega = {
  modo: ModoEntrega;
  ok: boolean;
  valor_itens: number;
  desconto_pedido: number;
  frete_cobrado: number;
  valor_total: number;
  prazo_dias: number | null;
  gratis: boolean;
  fonte: string | null;
  avisos: { sku?: string; aviso: string }[];
  erro?: string;
};

type Cotacao = {
  cotacao_id: string;
  valida_ate: string;
  correios_erro: string | null;
  opcoes: OpcaoEntrega[];
};

type BeneficioNivel = {
  tipo: "nenhum" | "pct" | "valor" | "gratis";
  valor?: number;
  motivo: string;
};

type Beneficio = { frete: BeneficioNivel; pedido: BeneficioNivel };

type PedidoCriado = {
  pedido_id: string;
  id_externo: string;
  valor_total: number;
  link_pagamento: string | null;
  pix_copia_cola?: string | null;
  link_erro?: string | null;
  avisos?: { sku?: string; aviso: string }[];
};

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
  modal: string | null;
  frete_tipo: string | null;
  nf_numero: string | null;
  codigo_rastreio: string | null;
  rastreio_servico: string | null;
  cancelado_em: string | null;
};

// ============ Helpers ============

const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const soDigitos = (v: string) => v.replace(/\D/g, "");

const maskCpf = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const MODO_LABEL: Record<ModoEntrega, string> = {
  retirada: "Retirada no Site SP",
  sedex: "SEDEX",
  pac: "PAC",
  frete_fetely: "Frete Fetély",
};

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

// Miniatura 40x40 do produto: foto do catálogo FOP, mesma fonte do ProductCard
// (photos store por coleção+sku, com fallback coleção+cor). Sem foto: placeholder.
function ProdutoThumb({
  colecao,
  corNome,
  sku,
  nome,
}: {
  colecao: string | null;
  corNome: string | null;
  sku: string;
  nome: string;
}) {
  const photos = usePhotos();
  const foto = colecao
    ? (getProdutoPhoto(photos, colecao, sku) ??
      getProdutoPhoto(photos, colecao, corNome ?? ""))
    : undefined;
  if (foto) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={foto}
        alt={nome}
        className="h-10 w-10 shrink-0 rounded object-cover"
      />
    );
  }
  return (
    <PhotoPlaceholder
      colecao={colecao ?? nome}
      label={nome}
      className="h-10 w-10 shrink-0 rounded"
      showIcon={false}
    />
  );
}

// ============ Página ============

function VendaB2cPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-40">
      <div className="mb-4 flex items-center gap-2">
        <Store className="h-5 w-5 text-gold" />
        <h1 className="font-display text-2xl text-text-primary">Venda B2C (Balcão)</h1>
      </div>
      <Tabs defaultValue="novo">
        <TabsList className="mb-4">
          <TabsTrigger value="novo">Novo pedido</TabsTrigger>
          <TabsTrigger value="meus">Meus pedidos</TabsTrigger>
        </TabsList>
        <TabsContent value="novo">
          <NovoPedidoTab />
        </TabsContent>
        <TabsContent value="meus">
          <MeusPedidosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Aba: Novo pedido ============

const FORM_VAZIO = {
  nome: "",
  cpf: "",
  telefone: "",
  email: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

function NovoPedidoTab() {
  // (a) Cliente
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesAchados, setClientesAchados] = useState<BalcaoCliente[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteSel, setClienteSel] = useState<BalcaoCliente | null>(null);
  const [modoNovoCliente, setModoNovoCliente] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);

  // (b) Itens
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosAchados, setProdutosAchados] = useState<BalcaoProduto[]>([]);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);

  // Fotos do catálogo (mesma fonte do catálogo): garante o store carregado nesta rota.
  const photos = usePhotos();
  useEffect(() => {
    if (!photos.loaded && !photos.loading) void photos.fetchAll();
  }, [photos.loaded, photos.loading, photos.fetchAll]);

  // (c) Entrega
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [modoSel, setModoSel] = useState<ModoEntrega>("retirada");

  // (d) Benefício
  const [benAberto, setBenAberto] = useState(false);
  const [benPedidoTipo, setBenPedidoTipo] = useState<"nenhum" | "pct" | "valor">("nenhum");
  const [benPedidoValor, setBenPedidoValor] = useState("");
  const [benPedidoMotivo, setBenPedidoMotivo] = useState("");
  const [benFreteTipo, setBenFreteTipo] = useState<"nenhum" | "pct" | "valor" | "gratis">("nenhum");
  const [benFreteValor, setBenFreteValor] = useState("");
  const [benFreteMotivo, setBenFreteMotivo] = useState("");

  // (e) Pagamento
  const [pagamento, setPagamento] = useState<"pix" | "cartao">("pix");
  const [maxParcelas, setMaxParcelas] = useState(1);
  const [observacao, setObservacao] = useState("");

  // (f) Resultado
  const [criando, setCriando] = useState(false);
  const [criado, setCriado] = useState<PedidoCriado | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);

  // ----- busca de cliente (debounce 300ms, mín. 2 chars) -----
  useEffect(() => {
    const termo = buscaCliente.trim();
    if (termo.length < 2 || clienteSel) {
      setClientesAchados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscandoCliente(true);
      try {
        const r = await balcao<{ clientes: BalcaoCliente[] }>("balcao_cliente_buscar", { termo });
        setClientesAchados(r.clientes ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao buscar cliente");
      } finally {
        setBuscandoCliente(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [buscaCliente, clienteSel]);

  // ----- busca de produto (debounce 300ms) -----
  useEffect(() => {
    const termo = buscaProduto.trim();
    if (termo.length < 2) {
      setProdutosAchados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscandoProduto(true);
      try {
        const r = await balcao<{ produtos: BalcaoProduto[] }>("balcao_produto_buscar", { termo });
        setProdutosAchados(r.produtos ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao buscar produto");
      } finally {
        setBuscandoProduto(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [buscaProduto]);

  // ----- CEP → ViaCEP (cliente novo) -----
  useEffect(() => {
    const cep = soDigitos(form.cep);
    if (cep.length !== 8) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const j = await r.json();
        if (cancelled || j?.erro) return;
        setForm((f) => ({
          ...f,
          logradouro: j.logradouro ?? f.logradouro,
          bairro: j.bairro ?? f.bairro,
          cidade: j.localidade ?? f.cidade,
          uf: j.uf ?? f.uf,
        }));
      } catch {
        /* CEP sem preenchimento automático — segue manual */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.cep]);

  const enderecoAtual = useMemo(() => {
    if (clienteSel) {
      return {
        cep: soDigitos(clienteSel.cep ?? ""),
        logradouro: clienteSel.logradouro ?? "",
        numero: clienteSel.numero ?? "",
        complemento: clienteSel.complemento ?? "",
        bairro: clienteSel.bairro ?? "",
        cidade: clienteSel.cidade ?? "",
        uf: clienteSel.uf ?? "",
      };
    }
    if (modoNovoCliente) {
      return {
        cep: soDigitos(form.cep),
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
      };
    }
    return null;
  }, [clienteSel, modoNovoCliente, form]);

  const beneficio: Beneficio = useMemo(
    () => ({
      frete: {
        tipo: benFreteTipo,
        ...(benFreteTipo === "pct" || benFreteTipo === "valor"
          ? { valor: Number(benFreteValor) || 0 }
          : {}),
        motivo: benFreteMotivo,
      },
      pedido: {
        tipo: benPedidoTipo,
        ...(benPedidoTipo === "pct" || benPedidoTipo === "valor"
          ? { valor: Number(benPedidoValor) || 0 }
          : {}),
        motivo: benPedidoMotivo,
      },
    }),
    [benFreteTipo, benFreteValor, benFreteMotivo, benPedidoTipo, benPedidoValor, benPedidoMotivo],
  );

  const beneficioAtivo = benPedidoTipo !== "nenhum" || benFreteTipo !== "nenhum";
  const motivoOk =
    (!beneficioAtivo ||
      ((benPedidoTipo === "nenhum" || benPedidoMotivo.trim().length >= 3) &&
        (benFreteTipo === "nenhum" || benFreteMotivo.trim().length >= 3)));

  // ----- cálculo de entrega (debounce 600ms sobre itens + CEP + benefício) -----
  const recotar = useCallback(async (): Promise<Cotacao | null> => {
    if (itens.length === 0) {
      setCotacao(null);
      return null;
    }
    setCalculando(true);
    try {
      const cep = enderecoAtual?.cep ?? "";
      const r = await balcao<Cotacao & { ok: true }>("balcao_calcular", {
        itens: itens.map((i) => ({ sku: i.sku, quantidade: i.quantidade })),
        ...(clienteSel ? { cliente: { parceiro_id: clienteSel.id } } : {}),
        ...(cep.length === 8 && enderecoAtual ? { endereco: enderecoAtual } : {}),
        beneficio,
      });
      const c: Cotacao = {
        cotacao_id: r.cotacao_id,
        valida_ate: r.valida_ate,
        correios_erro: r.correios_erro ?? null,
        opcoes: r.opcoes ?? [],
      };
      setCotacao(c);
      setModoSel((atual) => {
        const aindaOk = c.opcoes.some((o) => o.modo === atual && o.ok);
        if (aindaOk) return atual;
        const primeira = c.opcoes.find((o) => o.ok);
        return primeira?.modo ?? "retirada";
      });
      return c;
    } catch (e) {
      setCotacao(null);
      toast.error(e instanceof Error ? e.message : "Erro ao calcular entrega");
      return null;
    } finally {
      setCalculando(false);
    }
  }, [itens, enderecoAtual, clienteSel, beneficio]);

  const itensKey = itens.map((i) => `${i.sku}:${i.quantidade}`).join("|");
  const cepKey = enderecoAtual?.cep ?? "";
  const benKey = JSON.stringify(beneficio);
  useEffect(() => {
    if (itens.length === 0) {
      setCotacao(null);
      return;
    }
    const t = setTimeout(() => {
      void recotar();
    }, 600);
    return () => clearTimeout(t);
    // recotar muda de identidade junto com essas chaves
  }, [itensKey, cepKey, benKey, recotar, itens.length]);

  // ----- ações de itens -----
  const adicionarItem = (p: BalcaoProduto) => {
    setItens((atual) => {
      const ix = atual.findIndex((i) => i.sku === p.sku);
      if (ix >= 0) {
        const copia = [...atual];
        copia[ix] = { ...copia[ix]!, quantidade: copia[ix]!.quantidade + 1 };
        return copia;
      }
      return [...atual, { ...p, quantidade: 1 }];
    });
    setBuscaProduto("");
    setProdutosAchados([]);
  };

  const setQtd = (sku: string, qtd: number) => {
    setItens((atual) =>
      qtd <= 0
        ? atual.filter((i) => i.sku !== sku)
        : atual.map((i) => (i.sku === sku ? { ...i, quantidade: qtd } : i)),
    );
  };

  // ----- totais -----
  const subtotalLocal = itens.reduce((s, i) => s + i.preco_varejo * i.quantidade, 0);
  const opcaoSel = cotacao?.opcoes.find((o) => o.modo === modoSel && o.ok) ?? null;

  // ----- validações -----
  const cepValido = (enderecoAtual?.cep ?? "").length === 8;
  const emailObrigatorio = pagamento === "cartao";
  const novoClienteValido =
    form.nome.trim().length >= 2 &&
    soDigitos(form.cpf).length === 11 &&
    (!emailObrigatorio || form.email.trim().includes("@"));
  const clienteOk = clienteSel !== null || (modoNovoCliente && novoClienteValido);
  const entregaOk = modoSel === "retirada" || (cotacao !== null && opcaoSel !== null && cepValido);
  const podeCriar =
    clienteOk && itens.length > 0 && entregaOk && motivoOk && !criando && !calculando;

  // ----- criar pedido -----
  const criarPedido = async () => {
    if (!podeCriar) return;
    setCriando(true);
    try {
      // Recota se a cotação expirou
      let cot = cotacao;
      if (modoSel !== "retirada") {
        if (!cot || new Date(cot.valida_ate).getTime() < Date.now()) {
          cot = await recotar();
          if (!cot) throw new Error("Não foi possível recalcular a entrega. Tente de novo.");
        }
      }

      const clientePayload = clienteSel
        ? { parceiro_id: clienteSel.id }
        : {
            nome: form.nome.trim(),
            cpf: soDigitos(form.cpf),
            telefone: soDigitos(form.telefone),
            email: form.email.trim(),
            cep: soDigitos(form.cep),
            logradouro: form.logradouro,
            numero: form.numero,
            complemento: form.complemento,
            bairro: form.bairro,
            cidade: form.cidade,
            uf: form.uf,
          };

      const entregaPayload =
        modoSel === "retirada"
          ? { modo: "retirada", beneficio }
          : { modo: modoSel, cotacao_id: cot!.cotacao_id, endereco: enderecoAtual, beneficio };

      const r = await balcao<PedidoCriado & { ok: true }>("balcao_criar", {
        cliente: clientePayload,
        itens: itens.map((i) => ({ sku: i.sku, quantidade: i.quantidade })),
        entrega: entregaPayload,
        pagamento,
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
        ...(pagamento === "cartao" ? { max_parcelas: maxParcelas } : {}),
      });

      setCriado({
        pedido_id: r.pedido_id,
        id_externo: r.id_externo,
        valor_total: r.valor_total,
        link_pagamento: r.link_pagamento ?? null,
        pix_copia_cola: r.pix_copia_cola ?? null,
        link_erro: r.link_erro ?? null,
        avisos: r.avisos ?? [],
      });
      toast.success(`Pedido ${r.id_externo} criado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar pedido");
    } finally {
      setCriando(false);
    }
  };

  const gerarNovoLink = async () => {
    if (!criado) return;
    setGerandoLink(true);
    try {
      const r = await balcao<{ url: string; meio?: string }>("balcao_link", {
        pedido_id: criado.pedido_id,
        forcar_novo: true,
        ...(pagamento === "cartao" ? { max_parcelas: maxParcelas } : {}),
      });
      setCriado({ ...criado, link_pagamento: r.url, link_erro: null });
      toast.success("Novo link gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link");
    } finally {
      setGerandoLink(false);
    }
  };

  const limparTudo = () => {
    setBuscaCliente("");
    setClientesAchados([]);
    setClienteSel(null);
    setModoNovoCliente(false);
    setForm(FORM_VAZIO);
    setBuscaProduto("");
    setProdutosAchados([]);
    setItens([]);
    setCotacao(null);
    setModoSel("retirada");
    setBenAberto(false);
    setBenPedidoTipo("nenhum");
    setBenPedidoValor("");
    setBenPedidoMotivo("");
    setBenFreteTipo("nenhum");
    setBenFreteValor("");
    setBenFreteMotivo("");
    setPagamento("pix");
    setMaxParcelas(1);
    setObservacao("");
    setCriado(null);
  };

  // ----- painel de sucesso -----
  if (criado) {
    const nomeCliente = clienteSel?.nome ?? form.nome;
    const foneCliente = clienteSel?.telefone ?? form.telefone;
    return (
      <Card className="border-gold/40">
        <CardHeader>
          <CardTitle className="text-text-primary">Pedido criado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-lg font-semibold text-gold">{criado.id_externo}</span>
            <span className="text-text-primary">{brl(criado.valor_total)}</span>
          </div>

          {criado.link_pagamento && (
            <div className="space-y-2">
              <Label>Link de pagamento</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={criado.link_pagamento} className="flex-1" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copiar(criado.link_pagamento!, "Link copiado")}
                  >
                    <Copy className="mr-1 h-4 w-4" /> Copiar
                  </Button>
                  <Button asChild className="bg-gold text-background hover:bg-gold/90">
                    <a
                      href={whatsappUrl(
                        foneCliente,
                        msgWhatsApp(nomeCliente, criado.id_externo, criado.valor_total, criado.link_pagamento),
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {criado.pix_copia_cola && (
            <div className="space-y-2">
              <Label>PIX copia e cola</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={criado.pix_copia_cola} className="flex-1 font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={() => copiar(criado.pix_copia_cola!, "Código PIX copiado")}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copiar
                </Button>
              </div>
            </div>
          )}

          {criado.link_erro && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              {criado.link_erro}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={gerarNovoLink} disabled={gerandoLink}>
                  {gerandoLink && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Gerar link de novo
                </Button>
              </div>
            </div>
          )}

          {criado.avisos && criado.avisos.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-amber-400">
              {criado.avisos.map((a, i) => (
                <li key={i}>{a.aviso}</li>
              ))}
            </ul>
          )}

          <Button onClick={limparTudo} variant="outline">
            Novo pedido
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* (a) Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-text-primary">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!clienteSel && !modoNovoCliente && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome, CPF ou telefone"
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                />
              </div>
              {buscandoCliente && (
                <p className="text-xs text-text-secondary">Buscando…</p>
              )}
              {clientesAchados.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {clientesAchados.map((c) => (
                    <li key={c.id}>
                      <button
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface-hover"
                        onClick={() => {
                          setClienteSel(c);
                          setClientesAchados([]);
                        }}
                      >
                        <span className="text-sm text-text-primary">{c.nome}</span>
                        <span className="text-xs text-text-secondary">
                          {c.cpf ? maskCpf(c.cpf) : "sem CPF"}
                          {c.telefone ? ` · ${c.telefone}` : ""}
                          {c.cidade ? ` · ${c.cidade}/${c.uf}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" size="sm" onClick={() => setModoNovoCliente(true)}>
                <UserPlus className="mr-1 h-4 w-4" /> Cadastrar novo cliente
              </Button>
            </>
          )}

          {clienteSel && (
            <div className="rounded-md border border-gold/30 bg-gold/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">{clienteSel.nome}</p>
                  <p className="text-xs text-text-secondary">
                    {clienteSel.cpf ? maskCpf(clienteSel.cpf) : "sem CPF"}
                    {clienteSel.telefone ? ` · ${clienteSel.telefone}` : ""}
                    {clienteSel.email ? ` · ${clienteSel.email}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {[clienteSel.logradouro, clienteSel.numero, clienteSel.complemento]
                      .filter(Boolean)
                      .join(", ")}
                    {clienteSel.bairro ? ` — ${clienteSel.bairro}` : ""}
                    {clienteSel.cidade ? ` · ${clienteSel.cidade}/${clienteSel.uf}` : ""}
                    {clienteSel.cep ? ` · CEP ${clienteSel.cep}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setClienteSel(null);
                    setBuscaCliente("");
                  }}
                >
                  Trocar
                </Button>
              </div>
            </div>
          )}

          {modoNovoCliente && !clienteSel && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CPF *</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    inputMode="tel"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>
                    E-mail{emailObrigatorio ? " * (obrigatório no cartão)" : ""}
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) =>
                      setForm({ ...form, cep: soDigitos(e.target.value).slice(0, 8) })
                    }
                  />
                </div>
                <div>
                  <Label>Logradouro</Label>
                  <Input
                    value={form.logradouro}
                    onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={form.complemento}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Cidade</Label>
                    <Input
                      value={form.cidade}
                      onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input
                      maxLength={2}
                      value={form.uf}
                      onChange={(e) =>
                        setForm({ ...form, uf: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setModoNovoCliente(false)}>
                  Voltar para busca
                </Button>
                {modoNovoCliente && !novoClienteValido && (
                  <p className="self-center text-xs text-amber-400">
                    Preencha nome e CPF{emailObrigatorio ? " (e e-mail, obrigatório no cartão)" : ""}.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* (b) Itens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-text-primary">Itens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              className="pl-9"
              placeholder="Buscar produto por nome, código ou SKU"
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
            />
          </div>
          {buscandoProduto && <p className="text-xs text-text-secondary">Buscando…</p>}
          {produtosAchados.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {produtosAchados.map((p) => (
                <li key={p.sku}>
                  <button
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-hover"
                    onClick={() => adicionarItem(p)}
                  >
                    <ProdutoThumb
                      colecao={p.colecao}
                      corNome={p.cor_nome}
                      sku={p.sku}
                      nome={p.nome}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-text-primary">{p.nome}</span>
                      <span className="block text-xs text-text-secondary">
                        {p.cod_cadastro ?? "—"} · SKU {p.sku} · saldo Site SP: {p.disponivel_site_sp}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-gold">{brl(p.preco_varejo)}</span>
                      <Plus className="h-4 w-4 text-text-secondary" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {itens.length > 0 && (
            <ul className="space-y-2">
              {itens.map((i) => (
                <li
                  key={i.sku}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
                >
                  <ProdutoThumb colecao={i.colecao} corNome={i.cor_nome} sku={i.sku} nome={i.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{i.nome}</p>
                    <p className="text-xs text-text-secondary">
                      {i.cod_cadastro ?? i.sku} · {brl(i.preco_varejo)}
                    </p>
                    {i.quantidade > i.disponivel_site_sp && (
                      <Badge className="mt-1 border-amber-500/40 bg-amber-500/10 text-amber-400">
                        sem saldo no Site SP
                      </Badge>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={i.quantidade}
                    onChange={(e) => setQtd(i.sku, Math.max(0, Number(e.target.value) || 0))}
                  />
                  <span className="w-24 text-right text-sm text-text-primary">
                    {brl(i.preco_varejo * i.quantidade)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQtd(i.sku, 0)}
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {itens.length === 0 && (
            <p className="text-xs text-text-secondary">Nenhum item adicionado.</p>
          )}
        </CardContent>
      </Card>

      {/* (c) Entrega */}
      {itens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-text-primary">
              Entrega
              {calculando && <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!cepValido && (
              <p className="text-xs text-text-secondary">
                Sem CEP válido no endereço — disponível apenas retirada no Site SP.
              </p>
            )}
            {cotacao?.correios_erro && (
              <p className="text-xs text-amber-400">Correios: {cotacao.correios_erro}</p>
            )}
            {cotacao && cotacao.opcoes.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {cotacao.opcoes.map((o) => {
                  const selecionada = modoSel === o.modo && o.ok;
                  return (
                    <button
                      key={o.modo}
                      disabled={!o.ok}
                      onClick={() => o.ok && setModoSel(o.modo)}
                      className={`rounded-md border p-3 text-left transition ${
                        selecionada
                          ? "border-gold bg-gold/10"
                          : o.ok
                            ? "border-border hover:border-gold/50"
                            : "cursor-not-allowed border-border opacity-50"
                      }`}
                    >
                      <p className="text-sm font-medium text-text-primary">{MODO_LABEL[o.modo]}</p>
                      {o.ok ? (
                        <>
                          <p className="text-xs text-text-secondary">
                            Frete: {o.gratis ? "grátis" : brl(o.frete_cobrado)}
                          </p>
                          <p className="text-sm text-gold">{brl(o.valor_total)}</p>
                          {o.prazo_dias != null && (
                            <p className="text-xs text-text-secondary">
                              até {o.prazo_dias} dia{o.prazo_dias === 1 ? "" : "s"}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-red-400">{o.erro ?? "indisponível"}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              !calculando && (
                <p className="text-xs text-text-secondary">Calculando opções de entrega…</p>
              )
            )}
            {cotacao?.opcoes.some((o) => o.avisos?.length) && (
              <ul className="list-disc pl-5 text-xs text-amber-400">
                {cotacao.opcoes
                  .flatMap((o) => o.avisos ?? [])
                  .map((a, i) => (
                    <li key={i}>{a.aviso}</li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* (d) Benefício */}
      <Collapsible open={benAberto} onOpenChange={setBenAberto}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <CardTitle className="flex items-center justify-between text-base text-text-primary">
                Benefício {beneficioAtivo && <Badge className="ml-2">ativo</Badge>}
                <ChevronDown
                  className={`h-4 w-4 transition ${benAberto ? "rotate-180" : ""}`}
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-text-primary">Desconto no pedido</p>
                  <Select
                    value={benPedidoTipo}
                    onValueChange={(v) => setBenPedidoTipo(v as typeof benPedidoTipo)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      <SelectItem value="pct">Percentual (%)</SelectItem>
                      <SelectItem value="valor">Valor (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                  {benPedidoTipo !== "nenhum" && (
                    <>
                      <Input
                        type="number"
                        min={0}
                        placeholder={benPedidoTipo === "pct" ? "% de desconto" : "R$ de desconto"}
                        value={benPedidoValor}
                        onChange={(e) => setBenPedidoValor(e.target.value)}
                      />
                      <Input
                        placeholder="Motivo (obrigatório, mín. 3 letras)"
                        value={benPedidoMotivo}
                        onChange={(e) => setBenPedidoMotivo(e.target.value)}
                      />
                    </>
                  )}
                </div>
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-text-primary">Benefício no frete</p>
                  <Select
                    value={benFreteTipo}
                    onValueChange={(v) => setBenFreteTipo(v as typeof benFreteTipo)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      <SelectItem value="pct">Percentual (%)</SelectItem>
                      <SelectItem value="valor">Valor (R$)</SelectItem>
                      <SelectItem value="gratis">Frete grátis</SelectItem>
                    </SelectContent>
                  </Select>
                  {(benFreteTipo === "pct" || benFreteTipo === "valor") && (
                    <Input
                      type="number"
                      min={0}
                      placeholder={benFreteTipo === "pct" ? "% no frete" : "R$ no frete"}
                      value={benFreteValor}
                      onChange={(e) => setBenFreteValor(e.target.value)}
                    />
                  )}
                  {benFreteTipo !== "nenhum" && (
                    <Input
                      placeholder="Motivo (obrigatório, mín. 3 letras)"
                      value={benFreteMotivo}
                      onChange={(e) => setBenFreteMotivo(e.target.value)}
                    />
                  )}
                </div>
              </div>
              {beneficioAtivo && !motivoOk && (
                <p className="text-xs text-amber-400">
                  Informe o motivo (mín. 3 letras) para cada benefício ativo.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* (e) Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-text-primary">Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(["pix", "cartao"] as const).map((p) => (
              <Button
                key={p}
                variant={pagamento === p ? "default" : "outline"}
                className={pagamento === p ? "bg-gold text-background hover:bg-gold/90" : ""}
                onClick={() => setPagamento(p)}
              >
                {p === "pix" ? "PIX" : "Cartão"}
              </Button>
            ))}
          </div>
          {pagamento === "cartao" && (
            <div className="max-w-40">
              <Label>Parcelas</Label>
              <Select value={String(maxParcelas)} onValueChange={(v) => setMaxParcelas(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* (f) Resumo fixo */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
          <span className="text-xs text-text-secondary">
            Itens: {brl(opcaoSel ? opcaoSel.valor_itens : subtotalLocal)}
          </span>
          <span className="text-xs text-text-secondary">
            Desconto: {brl(opcaoSel?.desconto_pedido ?? 0)}
          </span>
          <span className="text-xs text-text-secondary">
            Frete ({MODO_LABEL[modoSel]}):{" "}
            {opcaoSel ? (opcaoSel.gratis ? "grátis" : brl(opcaoSel.frete_cobrado)) : "—"}
          </span>
          <span className="text-sm font-semibold text-gold">
            Total: {brl(opcaoSel ? opcaoSel.valor_total : subtotalLocal)}
          </span>
          <Button
            className="ml-auto bg-gold text-background hover:bg-gold/90"
            disabled={!podeCriar}
            onClick={criarPedido}
          >
            {criando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Criar pedido e gerar link
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Aba: Meus pedidos ============

type FiltroRapido = "todos" | "aguardando" | "pagos";

function MeusPedidosTab() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroRapido>("todos");
  const [gerandoLinkId, setGerandoLinkId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["balcao-meus-pedidos"],
    queryFn: () => balcao<{ pedidos: MeuPedido[] }>("balcao_meus_pedidos", { dias: 90 }),
    refetchInterval: 60_000,
  });

  const pedidos = useMemo(() => data?.pedidos ?? [], [data]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (filtro === "aguardando" && p.pagamento_confirmado_em) return false;
      if (filtro === "pagos" && !p.pagamento_confirmado_em) return false;
      if (!termo) return true;
      return (
        (p.id_externo ?? "").toLowerCase().includes(termo) ||
        (p.cliente_nome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [pedidos, busca, filtro]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-text-primary">
          Meus pedidos (90 dias)
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
              placeholder="Buscar por pedido ou cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
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

        {isLoading ? (
          <p className="text-sm text-text-secondary">Carregando…</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum pedido encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => {
                  const pago = !!p.pagamento_confirmado_em;
                  const cancelado = !!p.cancelado_em;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="block text-sm font-medium text-text-primary">
                          {p.id_externo ?? "—"}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {p.recebido_em
                            ? new Date(p.recebido_em).toLocaleDateString("pt-BR")
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="block text-sm text-text-primary">
                          {p.cliente_nome ?? "—"}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {p.cliente_telefone ?? ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-text-primary">
                        {brl(p.valor_liquido)}
                      </TableCell>
                      <TableCell>
                        <span className="block text-xs uppercase text-text-secondary">
                          {p.pagamento ?? "—"}
                        </span>
                        {pago ? (
                          <span className="text-xs text-emerald-400">
                            pago em{" "}
                            {new Date(p.pagamento_confirmado_em!).toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400">aguardando</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {p.modal ?? "—"}
                        {p.frete_tipo ? ` · ${p.frete_tipo}` : ""}
                      </TableCell>
                      <TableCell>
                        {cancelado ? (
                          <Badge className="border-red-500/40 bg-red-500/10 text-red-400">
                            cancelado
                          </Badge>
                        ) : (
                          <span className="text-xs text-text-secondary">
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
                            className="flex items-center gap-1 text-xs text-gold hover:underline"
                            onClick={() => copiar(p.codigo_rastreio!, "Rastreio copiado")}
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
                      <TableCell>
                        {!pago && !cancelado && (
                          <div className="flex flex-col gap-1">
                            {p.link_pagamento && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copiar(p.link_pagamento!, "Link copiado")}
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
