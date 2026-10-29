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
import { useAuth } from "@/store/authStore";
import { balcao, salvarAlteracaoBalcao, type AlteracaoBalcao } from "@/hooks/useBalcao";
import { usePhotos, getProdutoPhoto } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { orderPayment } from "@/lib/bonificationPayment";

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
  /** Saldo do CD escolhido (SNCF novo); cai para disponivel_site_sp quando ausente. */
  disponivel?: number;
  /** CD que respondeu o saldo (informativo). */
  centro?: string;
  colecao: string | null;
  cor_nome: string | null;
};

type CdInfo = { codigo: string; rotulo: string; padrao: boolean };

const CD_PADRAO: CdInfo = { codigo: "SITE-SP", rotulo: "Site SP", padrao: true };

const saldoDo = (p: BalcaoProduto) => p.disponivel ?? p.disponivel_site_sp;

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

type MeioPagamento = "pix" | "cartao" | "cartao_maquininha" | "bonificacao";

const MEIO_LABEL: Record<MeioPagamento, string> = {
  pix: "PIX",
  cartao: "Cartão (link)",
  cartao_maquininha: "Cartão maquininha",
  bonificacao: "Bonificação",
};

const MEIO_LEGENDA: Record<MeioPagamento, string> = {
  pix: "QR/link · cliente paga pelo celular",
  cartao: "Link SafraPay · parcelas · confirma sozinho",
  cartao_maquininha: "Passa na loja · sem link · comprovante anexado no SNCF",
  bonificacao: "Influenciadora / ação de marketing · sem cobrança",
};

// Coluna "Pagamento" da aba Meus pedidos: meios conhecidos viram rótulo;
// qualquer outro valor vem como veio do SNCF.
function rotuloPagamento(p: string | null) {
  if (!p) return "—";
  if (p === "pix") return "PIX";
  if (p === "cartao") return "Cartão (link)";
  if (p === "cartao_maquininha") return "Maquininha";
  if (p === "bonificacao" || p === "sem_pagamento") return "Bonificação";
  return p;
}

type PedidoCriado = {
  pedido_id: string;
  id_externo: string;
  valor_total: number;
  link_pagamento: string | null;
  pix_copia_cola?: string | null;
  link_erro?: string | null;
  endereco_gravado_no_cadastro?: boolean;
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
  vendedor_nome?: string | null;
  eh_dono?: boolean;
  modal: string | null;
  frete_tipo: string | null;
  nf_numero: string | null;
  codigo_rastreio: string | null;
  rastreio_servico: string | null;
  cancelado_em: string | null;
};

type PedidoDetalhe = {
  pedido: {
    id: string; id_externo: string; estagio: string | null; situacao: string | null;
    valor_bruto: number; valor_frete: number; valor_liquido: number;
    frete_tipo: string | null; modal: string | null;
    endereco_entrega: Record<string, unknown> | null;
    itens: { sku: string; descricao: string; quantidade: number; valor_unitario: number }[];
    observacao: string | null; pagamento: MeioPagamento | "sem_pagamento"; link_pagamento: string | null;
    pagamento_confirmado_em: string | null; nf_numero: string | null;
    vendedor_nome: string | null; cancelado_em: string | null;
  };
  cliente: BalcaoCliente;
  permissoes: { eh_dono: boolean; editar_itens: boolean; trocar_meio: boolean; editar_cliente: boolean; motivo_bloqueio: string | null };
};

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

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

const maskCep = (v: string) => soDigitos(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

const MODO_LABEL: Record<ModoEntrega, string> = {
  retirada: "Retirada no balcão",
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
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 pb-40">
      <div className="mb-4 flex items-center gap-2">
        <Store className="h-5 w-5 text-gold" />
        <h1 className="font-display text-2xl text-text-primary">Venda B2C (Balcão)</h1>
      </div>
      <Tabs defaultValue="novo">
        <TabsList className="mb-4">
          <TabsTrigger value="novo">Novo pedido</TabsTrigger>
          <TabsTrigger value="meus">Meus pedidos</TabsTrigger>
          <TabsTrigger value="todos">Todos os pedidos</TabsTrigger>
        </TabsList>
        <TabsContent value="novo">
          <NovoPedidoTab />
        </TabsContent>
        <TabsContent value="meus">
          <MeusPedidosTab escopo="meus" />
        </TabsContent>
        <TabsContent value="todos">
          <MeusPedidosTab escopo="todos" />
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

function NovoPedidoTab({ detalhe, onVoltar, onSalvo }: {
  detalhe?: PedidoDetalhe; onVoltar?: () => void; onSalvo?: () => Promise<unknown>;
} = {}) {
  const userId = useAuth(s => s.user?.id);
  const podeItens = !detalhe || detalhe.permissoes.editar_itens;
  const podeCliente = !detalhe || detalhe.permissoes.editar_cliente;
  const podeMeio = !detalhe || detalhe.permissoes.trocar_meio;
  const podeEditar = !!detalhe && (podeItens || podeCliente || podeMeio);
  const enderecoOriginal = objeto(detalhe?.pedido.endereco_entrega);
  const enderecoCampos = Object.keys(objeto(enderecoOriginal.endereco)).length ? objeto(enderecoOriginal.endereco) : enderecoOriginal;
  const beneficioOriginal = objeto(enderecoOriginal.beneficio);
  const freteOriginal = objeto(enderecoOriginal.frete);
  const benP = objeto(beneficioOriginal.pedido ?? enderecoOriginal.desconto);
  const benF = objeto(beneficioOriginal.frete ?? freteOriginal.beneficio);
  const formInicial = { ...FORM_VAZIO };
  for (const k of Object.keys(formInicial) as (keyof typeof FORM_VAZIO)[]) {
    formInicial[k] = String((k in enderecoCampos ? enderecoCampos[k] : undefined) ?? detalhe?.cliente[k] ?? "");
  }
  formInicial.cpf = maskCpf(formInicial.cpf);
  formInicial.cep = maskCep(formInicial.cep);
  const cdInicial = String(enderecoOriginal.centro_codigo ?? freteOriginal.centro_codigo ?? CD_PADRAO.codigo);
  const modoInicialRaw = String(enderecoOriginal.modo ?? enderecoOriginal.modal ?? detalhe?.pedido.modal ?? "retirada").toLowerCase();
  const modoInicial: ModoEntrega = modoInicialRaw === "sedex" || modoInicialRaw === "pac" || modoInicialRaw === "frete_fetely" ? modoInicialRaw : "retirada";
  const [motivoAlteracao, setMotivoAlteracao] = useState("");
  const [resultadoEdicao, setResultadoEdicao] = useState<Record<string, unknown> | null>(null);
  const [clienteBase, setClienteBase] = useState(formInicial);
  // (a) Cliente
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesAchados, setClientesAchados] = useState<BalcaoCliente[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteSel, setClienteSel] = useState<BalcaoCliente | null>(detalhe?.cliente ?? null);
  const [modoNovoCliente, setModoNovoCliente] = useState(false);
  const [form, setForm] = useState(formInicial);

  // (b) Itens
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosAchados, setProdutosAchados] = useState<BalcaoProduto[]>([]);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [itens, setItens] = useState<Item[]>(() => detalhe?.pedido.itens.map(i => ({ sku: i.sku, nome: i.descricao, quantidade: i.quantidade, preco_varejo: i.valor_unitario, cod_cadastro: null, ean: null, disponivel_site_sp: 0, colecao: null, cor_nome: null })) ?? []);

  // (b0) CD de origem (Site SP / Show Room) — vem do SNCF; fallback Site SP
  const [cds, setCds] = useState<CdInfo[]>([CD_PADRAO]);
  const [cdSel, setCdSel] = useState<string>(cdInicial);
  const cdRotulo = cds.find((c) => c.codigo === cdSel)?.rotulo ?? CD_PADRAO.rotulo;

  // Fotos do catálogo (mesma fonte do catálogo): garante o store carregado nesta rota.
  const photos = usePhotos();
  useEffect(() => {
    if (!photos.loaded && !photos.loading) void photos.fetchAll();
  }, [photos.loaded, photos.loading, photos.fetchAll]);

  // ----- CDs disponíveis (uma vez; falha mantém Site SP e avisa) -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await balcao<{ cds: CdInfo[] }>("balcao_cds");
        if (cancelled) return;
        const lista = r.cds ?? [];
        if (lista.length > 0) {
          setCds(lista);
          const padrao = lista.find((c) => c.padrao);
          if (padrao && !detalhe) setCdSel(padrao.codigo);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(
            `${e instanceof Error ? e.message : "Erro ao carregar CDs"} — usando ${CD_PADRAO.rotulo}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // (c) Entrega
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [modoSel, setModoSel] = useState<ModoEntrega>(modoInicial);

  // (d) Benefício
  const [benAberto, setBenAberto] = useState(false);
  const [benPedidoTipo, setBenPedidoTipo] = useState<"nenhum" | "pct" | "valor">(benP.tipo === "pct" || benP.tipo === "valor" ? benP.tipo : "nenhum");
  const [benPedidoValor, setBenPedidoValor] = useState(String(benP.valor ?? ""));
  const [benPedidoMotivo, setBenPedidoMotivo] = useState(String(benP.motivo ?? ""));
  const [benFreteTipo, setBenFreteTipo] = useState<"nenhum" | "pct" | "valor" | "gratis">(benF.tipo === "pct" || benF.tipo === "valor" || benF.tipo === "gratis" ? benF.tipo : "nenhum");
  const [benFreteValor, setBenFreteValor] = useState(String(benF.valor ?? ""));
  const [benFreteMotivo, setBenFreteMotivo] = useState(String(benF.motivo ?? ""));

  // (e) Pagamento
  const [pagamento, setPagamento] = useState<MeioPagamento | null>(detalhe?.pedido.pagamento === "sem_pagamento" ? "bonificacao" : detalhe?.pedido.pagamento ?? "pix");
  const [maxParcelas, setMaxParcelas] = useState(1);
  const [observacao, setObservacao] = useState(detalhe?.pedido.observacao ?? "");

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
        const r = await balcao<{ produtos: BalcaoProduto[] }>("balcao_produto_buscar", {
          termo,
          centro_codigo: cdSel,
        });
        setProdutosAchados(r.produtos ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao buscar produto");
      } finally {
        setBuscandoProduto(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [buscaProduto, cdSel]);

  // ----- CEP → ViaCEP (endereço de entrega compartilhado) -----
  useEffect(() => {
    const cep = soDigitos(form.cep);
    if (cep.length !== 8 || (detalhe && soDigitos(formInicial.cep) === cep)) return;
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
    if (clienteSel || modoNovoCliente) {
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

  // ----- bonificação (regra e desconto pertencem ao SNCF) -----
  const bonif = pagamento === "bonificacao";
  const [bonifAutorizado, setBonifAutorizado] = useState("");
  const [bonifMotivo, setBonifMotivo] = useState("");
  const [bonifObs, setBonifObs] = useState("");
  const motivosBonif = useQuery({
    queryKey: ["balcao", "bonif_motivos"],
    enabled: bonif && !detalhe,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const r = await balcao<{ motivos: { codigo: string; nome: string; padrao?: boolean }[] }>("balcao_bonif_motivos", {});
      return r.motivos ?? [];
    },
  });
  useEffect(() => {
    if (bonifMotivo || !motivosBonif.data?.length) return;
    const m = motivosBonif.data.find((x) => x.padrao) ?? motivosBonif.data.find((x) => x.codigo === "brinde") ?? motivosBonif.data[0];
    setBonifMotivo(m.codigo);
  }, [motivosBonif.data, bonifMotivo]);
  const bonifOk = bonifAutorizado.trim().length >= 2 && !!bonifMotivo;
  const escolherMeio = (p: MeioPagamento) => {
    setPagamento(p);
    if (p === "bonificacao") {
      setBenPedidoTipo("nenhum");
      setBenFreteTipo("nenhum");
      setBenAberto(false);
    }
  };
  const sairBonificacao = () => setPagamento(null);

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
        centro_codigo: cdSel,
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
        if (detalhe) return atual;
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
  }, [itens, enderecoAtual, clienteSel, beneficio, cdSel]);

  const itensKey = itens.map((i) => `${i.sku}:${i.quantidade}`).join("|");
  const cepKey = enderecoAtual?.cep ?? "";
  const benKey = JSON.stringify(beneficio);
  useEffect(() => {
    if (!podeItens || itens.length === 0) {
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
        const item = copia[ix];
        if (!item) return atual;
        copia[ix] = { ...item, quantidade: item.quantidade + 1 };
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

  // ----- trocar o CD com itens na lista: refaz o saldo de cada item -----
  // (a entrega recalcula sozinha, porque recotar depende de cdSel)
  useEffect(() => {
    if (!podeItens || itens.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const atualizados = await Promise.all(
          itens.map(async (i) => {
            const r = await balcao<{ produtos: BalcaoProduto[] }>("balcao_produto_buscar", {
              termo: i.sku,
              centro_codigo: cdSel,
            });
            const p = r.produtos?.find((x) => x.sku === i.sku);
            return p ? { ...p, preco_varejo: detalhe ? i.preco_varejo : p.preco_varejo, quantidade: i.quantidade } : i;
          }),
        );
        if (!cancelled) setItens(atualizados);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Erro ao atualizar saldo do CD");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // intencional: reage só à troca de CD; itens entram por adicionarItem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdSel]);

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
    clienteOk && itens.length > 0 && entregaOk && motivoOk && pagamento !== null && !criando && !calculando;

  const normalizarCampo = (k: string, v: string) => ["cpf", "cep", "telefone"].includes(k) ? soDigitos(v) : v.trim();
  const clientePatch: Record<string, string> = {};
  if (detalhe && podeCliente) for (const k of Object.keys(form) as (keyof typeof form)[]) {
    if (normalizarCampo(k, form[k]) !== normalizarCampo(k, clienteBase[k])) clientePatch[k] = normalizarCampo(k, form[k]);
  }
  const itensPayload = itens.map(i => ({ sku: i.sku, quantidade: i.quantidade }));
  const itensMudaram = !!detalhe && JSON.stringify(itensPayload) !== JSON.stringify(detalhe.pedido.itens.map(i => ({ sku: i.sku, quantidade: i.quantidade })));
  const enderecoMudou = Object.keys(FORM_VAZIO).slice(4).some(k => normalizarCampo(k, form[k as keyof typeof form]) !== normalizarCampo(k, formInicial[k as keyof typeof form]));
  const benInicial = { frete: { tipo: benF.tipo ?? "nenhum", ...(benF.valor != null ? { valor: Number(benF.valor) } : {}), motivo: benF.motivo ?? "" }, pedido: { tipo: benP.tipo ?? "nenhum", ...(benP.valor != null ? { valor: Number(benP.valor) } : {}), motivo: benP.motivo ?? "" } };
  const entregaMudou = !!detalhe && (modoSel !== modoInicial || cdSel !== cdInicial || enderecoMudou || JSON.stringify(beneficio) !== JSON.stringify(benInicial));
  const pedidoMudou = !!detalhe && podeItens && (itensMudaram || entregaMudou || observacao !== (detalhe.pedido.observacao ?? ""));
  const meioMudou = !!detalhe && !bonif && pagamento !== detalhe.pedido.pagamento;
  const temAlteracao = pedidoMudou || meioMudou || Object.keys(clientePatch).length > 0;
  const podeSalvar = podeEditar && temAlteracao && motivoAlteracao.trim().length >= 3 && !criando && (!pedidoMudou || (itens.length > 0 && (!entregaMudou || entregaOk) && !calculando && motivoOk));
  const salvarEdicao = async () => {
    if (!detalhe || !userId || !podeSalvar) return;
    setCriando(true);
    try {
      let cot = cotacao;
      if ((pedidoMudou || (meioMudou && Object.keys(clientePatch).length > 0)) && modoSel !== "retirada") {
        cot = await recotar();
        if (!cot || !cot.opcoes.some(o => o.modo === modoSel && o.ok)) throw new Error("Não foi possível recalcular a entrega. Tente de novo.");
      }
      const entrega = modoSel === "retirada" ? { modo: modoSel, centro_codigo: cdSel, beneficio } : { modo: modoSel, centro_codigo: cdSel, cotacao_id: cot?.cotacao_id, endereco: enderecoAtual, beneficio };
      const r = await salvarAlteracaoBalcao({ fop_profile_id: userId, pedido_id: detalhe.pedido.id, motivo: motivoAlteracao, cliente: clientePatch, pedidoAlterado: pedidoMudou, meioAlterado: meioMudou, itens: itensPayload, entrega, observacao, meio: pagamento as AlteracaoBalcao["meio"] });
      setResultadoEdicao(r);
      setCriado({ pedido_id: detalhe.pedido.id, id_externo: detalhe.pedido.id_externo, valor_total: Number(r.valor_total ?? detalhe.pedido.valor_liquido), link_pagamento: typeof r.link_pagamento === "string" ? r.link_pagamento : null, pix_copia_cola: typeof r.pix_copia_cola === "string" ? r.pix_copia_cola : null, link_erro: typeof r.link_erro === "string" ? r.link_erro : null, avisos: Array.isArray(r.avisos) ? r.avisos as PedidoCriado["avisos"] : [] });
      toast.success("Pedido atualizado");
      await onSalvo?.();
    } catch (e) {
      // Cliente pode ter sido salvo antes de uma falha comercial: releia a base sem perder o formulário.
      try {
        const atual = await balcao<PedidoDetalhe>("balcao_detalhe", { fop_profile_id: userId, pedido_id: detalhe.pedido.id });
        setClienteBase(prev => { const next = { ...prev }; for (const k of Object.keys(clientePatch) as (keyof typeof prev)[]) next[k] = atual.cliente[k] ?? ""; return next; });
      } catch { /* o erro original deve continuar visível */ }
      await onSalvo?.();
      toast.error(e instanceof Error ? e.message : "Erro ao salvar pedido");
    } finally { setCriando(false); }
  };

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

      if (modoSel !== "retirada" && (!cot || !enderecoAtual)) {
        throw new Error("Informe o endereço e recalcule a entrega. Tente de novo.");
      }
      const entregaPayload =
        modoSel === "retirada"
          ? { modo: "retirada", centro_codigo: cdSel, beneficio }
          : {
              modo: modoSel,
              centro_codigo: cdSel,
              cotacao_id: cot?.cotacao_id,
              endereco: enderecoAtual,
              beneficio,
            };

      const r = await balcao<PedidoCriado & { ok: true }>("balcao_criar", {
        cliente: clientePayload,
        itens: itens.map((i) => ({ sku: i.sku, quantidade: i.quantidade })),
        entrega: entregaPayload,
        pagamento,
        // O discriminador bonificacao mantém a regra/desconto existente do SNCF;
        // a forma de cobrança é enviada separadamente, sem pagamento.
        ...(bonif ? { forma_solicitada: orderPayment({ bonificado: true }, ""), condicao_solicitada: "Pedido bonificado" } : {}),
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
        ...(pagamento === "cartao" ? { max_parcelas: maxParcelas } : {}),
        ...(pagamento === "bonificacao"
          ? { bonificacao: { autorizado_por: bonifAutorizado.trim(), motivo: bonifMotivo, observacao: bonifObs.trim() || null } }
          : {}),
      });

      setCriado({
        pedido_id: r.pedido_id,
        id_externo: r.id_externo,
        valor_total: r.valor_total,
        link_pagamento: r.link_pagamento ?? null,
        pix_copia_cola: r.pix_copia_cola ?? null,
        link_erro: r.link_erro ?? null,
        endereco_gravado_no_cadastro: r.endereco_gravado_no_cadastro === true,
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
    setBonifAutorizado("");
    setBonifObs("");
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
          <CardTitle className="text-text-primary">{detalhe ? "Pedido atualizado" : "Pedido criado"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-lg font-semibold text-gold">{criado.id_externo}</span>
            <span className="text-text-primary">{brl(criado.valor_total)}</span>
          </div>

          {detalhe && resultadoEdicao && (resultadoEdicao.pagamento_refeito === true || criado.link_pagamento || criado.pix_copia_cola) && (
            <p role="status" className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-text-primary">
              Total mudou de {brl(Number(resultadoEdicao.valor_anterior ?? detalhe.pedido.valor_liquido))} para {brl(criado.valor_total)} — envie o novo link/PIX ao cliente
            </p>
          )}
          {criado.endereco_gravado_no_cadastro && (
            <p className="text-sm text-text-secondary">Endereço salvo no cadastro do cliente</p>
          )}

          {bonif && (
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm text-sky-400">
              Pedido bonificado criado — segue para faturamento
            </div>
          )}

          {pagamento === "cartao_maquininha" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
              Aguardando comprovante da maquininha — passe o cartão e anexe o comprovante no SNCF ›
              Pedidos Site SP para liberar o pedido.
            </div>
          )}

          {!bonif && pagamento !== "cartao_maquininha" && criado.link_pagamento && (
            <div className="space-y-2">
              <Label>Link de pagamento</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={criado.link_pagamento} className="flex-1" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => criado.link_pagamento && copiar(criado.link_pagamento, "Link copiado")}
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

          {!bonif && criado.pix_copia_cola && (
            <div className="space-y-2">
              <Label>PIX copia e cola</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={criado.pix_copia_cola} className="flex-1 font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={() => criado.pix_copia_cola && copiar(criado.pix_copia_cola, "Código PIX copiado")}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copiar
                </Button>
              </div>
            </div>
          )}

          {!bonif && pagamento !== "cartao_maquininha" && criado.link_erro && (
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

          <Button onClick={detalhe ? onVoltar : limparTudo} variant="outline">
            {detalhe ? "Voltar para meus pedidos" : "Novo pedido"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {detalhe && <div className="space-y-2">
        <Button variant="outline" onClick={onVoltar}>Voltar para meus pedidos</Button>
        <h2 className="text-lg font-medium text-text-primary">{detalhe.pedido.id_externo}</h2>
        <p className="text-sm text-text-secondary">{detalhe.pedido.situacao ?? detalhe.pedido.estagio} · {rotuloPagamento(detalhe.pedido.pagamento)} · Total {brl(detalhe.pedido.valor_liquido)}{detalhe.pedido.nf_numero ? ` · NF ${detalhe.pedido.nf_numero}` : ""}</p>
        {(detalhe.permissoes.motivo_bloqueio || !podeEditar) && <p role="status" className="rounded-md border border-border p-3 text-sm text-text-primary">{detalhe.permissoes.motivo_bloqueio ?? "Pedido disponível somente para leitura"}</p>}
      </div>}
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
                          setForm({
                            ...FORM_VAZIO,
                            ...(soDigitos(c.cep ?? "").length > 0 ? {
                              cep: maskCep(c.cep ?? ""),
                              logradouro: c.logradouro ?? "",
                              numero: c.numero ?? "",
                              complemento: c.complemento ?? "",
                              bairro: c.bairro ?? "",
                              cidade: c.cidade ?? "",
                              uf: c.uf ?? "",
                            } : {}),
                          });
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
              <Button variant="outline" size="sm" onClick={() => { setForm(FORM_VAZIO); setModoNovoCliente(true); }}>
                <UserPlus className="mr-1 h-4 w-4" /> Cadastrar novo cliente
              </Button>
            </>
          )}

          {clienteSel && !detalhe && (
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
                    setForm(FORM_VAZIO);
                    setBuscaCliente("");
                  }}
                >
                  Trocar
                </Button>
              </div>
            </div>
          )}

          {(detalhe || (modoNovoCliente && !clienteSel)) && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <fieldset disabled={!podeCliente || criando} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="balcao-cliente-nome">Nome *</Label>
                  <Input
                    id="balcao-cliente-nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="balcao-cliente-cpf">CPF{detalhe ? "" : " *"}</Label>
                  <Input
                    inputMode="numeric"
                    id="balcao-cliente-cpf"
                    disabled={!!detalhe?.cliente.cpf}
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="balcao-cliente-telefone">Telefone</Label>
                  <Input
                    id="balcao-cliente-telefone"
                    inputMode="tel"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="balcao-cliente-email">
                    E-mail{emailObrigatorio ? " * (obrigatório no cartão)" : ""}
                  </Label>
                  <Input
                    id="balcao-cliente-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </fieldset>
              {!detalhe && <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setModoNovoCliente(false)}>
                  Voltar para busca
                </Button>
                {modoNovoCliente && !novoClienteValido && (
                  <p className="self-center text-xs text-amber-400">
                    Preencha nome e CPF{emailObrigatorio ? " (e e-mail, obrigatório no cartão)" : ""}.
                  </p>
                )}
              </div>}
            </div>
          )}

          <fieldset disabled={!!detalhe && !podeItens && !podeCliente || criando}><section className="space-y-3 border-t border-border pt-4" aria-labelledby="balcao-endereco-titulo">
            <h2 id="balcao-endereco-titulo" className="text-sm font-medium text-text-primary">Endereço de entrega</h2>
            {clienteSel && !soDigitos(clienteSel.cep ?? "") && (
              <p className="text-xs text-text-secondary">Cliente sem endereço no cadastro — informe para cotar a entrega</p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="balcao-entrega-cep">CEP</Label>
                  <Input
                    id="balcao-entrega-cep"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) =>
                      setForm({ ...form, cep: maskCep(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="balcao-entrega-logradouro">Logradouro</Label>
                  <Input
                    id="balcao-entrega-logradouro"
                      value={form.logradouro}
                    onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="balcao-entrega-numero">Número</Label>
                  <Input
                    id="balcao-entrega-numero"
                      value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="balcao-entrega-complemento">Complemento</Label>
                  <Input
                    id="balcao-entrega-complemento"
                      value={form.complemento}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="balcao-entrega-bairro">Bairro</Label>
                  <Input
                    id="balcao-entrega-bairro"
                      value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="balcao-entrega-cidade">Cidade</Label>
                    <Input
                      id="balcao-entrega-cidade"
                      value={form.cidade}
                      onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="balcao-entrega-uf">UF</Label>
                    <Input
                      maxLength={2}
                      id="balcao-entrega-uf"
                      value={form.uf}
                      onChange={(e) =>
                        setForm({ ...form, uf: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>
            </div>
          </section></fieldset>
        </CardContent>
      </Card>

      <fieldset disabled={!podeItens || criando} className="space-y-6">
      {/* (b0) CD de origem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-text-primary">CD</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={cdSel} onValueChange={setCdSel}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Selecione o CD" />
            </SelectTrigger>
            <SelectContent>
              {cds.map((c) => (
                <SelectItem key={c.codigo} value={c.codigo}>
                  {c.rotulo}
                  {c.padrao ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                        {p.cod_cadastro ?? "—"} · SKU {p.sku} · saldo {cdRotulo}: {saldoDo(p)}
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
                    {i.quantidade > saldoDo(i) && (
                      <Badge className="mt-1 border-amber-500/40 bg-amber-500/10 text-amber-400">
                        sem saldo no {cdRotulo}
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
                Sem CEP válido no endereço — disponível apenas retirada no balcão.
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
      {!bonif && <Collapsible open={benAberto} onOpenChange={setBenAberto}>
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
      </Collapsible>}

      </fieldset>
      {/* (e) Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-text-primary">Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bonif ? <div className="space-y-2">
            <p className="text-sm text-text-secondary">Sem pagamento — bonificação</p>
            {!detalhe && <Button variant="outline" disabled={criando} onClick={sairBonificacao}>Alterar condição</Button>}
          </div> : <div className="flex flex-wrap gap-2">
            {(detalhe && !bonif ? (["pix", "cartao", "cartao_maquininha"] as const) : detalhe ? (["bonificacao"] as const) : (["pix", "cartao", "cartao_maquininha", "bonificacao"] as const)).map((p) => (
              <Button
                key={p}
                variant={pagamento === p ? "default" : "outline"}
                className={pagamento === p ? "bg-gold text-background hover:bg-gold/90" : ""}
                disabled={!podeMeio || criando || (!!detalhe && bonif)}
                onClick={() => escolherMeio(p)}
              >
                {MEIO_LABEL[p]}
              </Button>
            ))}
          </div>}
          {!bonif && <p className="text-xs text-text-secondary">{pagamento ? MEIO_LEGENDA[pagamento] : "Selecione a forma de pagamento"}</p>}

          {!detalhe && bonif && (
            <div className="space-y-3 rounded-md border border-sky-500/40 bg-sky-500/5 p-3">
              <p className="text-sm text-sky-400">
                Pedido sem cobrança. Preço de tabela com desconto de bonificação; frete por conta da Fetely. Segue direto para faturamento.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bonif-autorizado">Autorizado por *</Label>
                  <Input id="bonif-autorizado" value={bonifAutorizado} onChange={(e) => setBonifAutorizado(e.target.value)} disabled={criando} />
                </div>
                <div>
                  <Label>Motivo *</Label>
                  <Select value={bonifMotivo} onValueChange={setBonifMotivo} disabled={criando || motivosBonif.isLoading}>
                    <SelectTrigger aria-label="Motivo da bonificação">
                      <SelectValue placeholder={motivosBonif.isLoading ? "Carregando…" : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(motivosBonif.data ?? []).map((m) => (
                        <SelectItem key={m.codigo} value={m.codigo}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {motivosBonif.error && <p className="mt-1 text-xs text-red-400">{(motivosBonif.error as Error).message}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="bonif-obs">Observação da bonificação</Label>
                <Textarea id="bonif-obs" rows={2} value={bonifObs} onChange={(e) => setBonifObs(e.target.value)} disabled={criando} />
              </div>
            </div>
          )}

          {!detalhe && pagamento === "cartao" && (
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
            <Label htmlFor="balcao-observacao">Observação</Label>
            <Textarea
              id="balcao-observacao"
              disabled={!podeItens || criando}
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {detalhe && podeEditar && <div className="space-y-2">
        <Label htmlFor="balcao-motivo-alteracao">Motivo da alteração *</Label>
        <Textarea id="balcao-motivo-alteracao" value={motivoAlteracao} onChange={e => setMotivoAlteracao(e.target.value)} disabled={criando} rows={2} />
      </div>}
      {/* (f) Resumo fixo */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
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
            {bonif ? "Prévia: " : "Total: "}{brl(opcaoSel ? opcaoSel.valor_total : subtotalLocal)}
            {bonif && <span className="ml-1 text-xs font-normal text-text-secondary">(valor final calculado pelo SNCF)</span>}
          </span>
          <Button
            className="ml-auto bg-gold text-background hover:bg-gold/90"
            disabled={detalhe ? !podeSalvar : !podeCriar || (bonif && !bonifOk)}
            onClick={detalhe ? salvarEdicao : criarPedido}
          >
            {criando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {detalhe ? (podeEditar ? "Salvar alterações" : "Somente leitura") : bonif ? "Criar pedido bonificado" : pagamento === "cartao_maquininha" ? "Criar pedido" : "Criar pedido e gerar link"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Aba: Meus pedidos ============

type FiltroRapido = "todos" | "aguardando" | "pagos";

const SNCF_VENDEDOR = "SNCF";
const nomeVendedor = (p: MeuPedido) => p.vendedor_nome?.trim() || SNCF_VENDEDOR;

function MeusPedidosTab({ escopo }: { escopo: "meus" | "todos" }) {
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
                            {new Date(p.pagamento_confirmado_em!).toLocaleDateString("pt-BR")}
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
