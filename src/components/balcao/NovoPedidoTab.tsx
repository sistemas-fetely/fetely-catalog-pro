import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useAuth } from "@/store/authStore";
import { usePhotos } from "@/store/photoStore";
import { balcao, salvarAlteracaoBalcao, type AlteracaoBalcao } from "@/hooks/useBalcao";
import { fetchCEP, formatCPF as maskCpf, formatCEP as maskCep, digits as soDigitos } from "@/lib/documento";
import { brl, entregaImediata, exigeEnderecoEntrega, juntarObservacao, normalizarNsu, pendenciaBasica, prepararProximaVenda, selecionarModoEntrega, separarObservacao, somenteBalcao, type Pendencia } from "@/lib/balcaoPedido";
import { CD_PADRAO, FORM_VAZIO, type BalcaoCliente, type BalcaoProduto, type Beneficio, type CdInfo, type ClienteForm, type Cotacao, type Item, type MeioPagamento, type ModoEntrega, type PedidoCriado, type PedidoDetalhe } from "./types";
import { ClienteCard } from "./ClienteCard";
import { ItensCard } from "./ItensCard";
import { EntregaCard } from "./EntregaCard";
import { PagamentoCard } from "./PagamentoCard";
import { ResumoPedido } from "./ResumoPedido";
import { PedidoResultado } from "./PedidoResultado";

const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function NovoPedidoTab({ detalhe, onVoltar, onSalvo, onAbrirPedido, onFechar }: {
  detalhe?: PedidoDetalhe; onVoltar?: () => void; onSalvo?: () => Promise<unknown>; onAbrirPedido?: (id: string) => void; onFechar?: () => void;
} = {}) {
  const userId = useAuth(s => s.user?.id);
  const [erros, setErros] = useState<Record<string, string>>({});
  const registrarErro = useCallback((area: string, erro: unknown, fallback: string) => {
    const mensagem = erro instanceof Error ? erro.message : fallback;
    setErros(prev => ({ ...prev, [area]: mensagem }));
    toast.error(mensagem);
  }, []);
  const limparErro = useCallback((area: string) => setErros(prev => ({ ...prev, [area]: "" })), []);
  const quoteSeq = useRef(0);
  const erroCotacao = useRef("");
  const cepSeq = useRef(0);
  const [buscandoCep, setBuscandoCep] = useState(false);
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
  const modoInicial: ModoEntrega = modoInicialRaw === "sedex" || modoInicialRaw === "pac" || modoInicialRaw === "frete_fetely" || modoInicialRaw === "balcao" ? modoInicialRaw : "retirada";
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
  const [balcaoPorCd, setBalcaoPorCd] = useState<Record<string, boolean>>({});
  // Retain the last quoted capability while recalculating or clearing the next sale.
  const modoBalcao = balcaoPorCd[cdSel] ?? (!!detalhe && modoInicial === "balcao");
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
          registrarErro("cd", e, "Erro ao carregar CDs");
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
  const [nsu, setNsu] = useState(String(enderecoOriginal.nsu ?? ""));
  const [maxParcelas, setMaxParcelas] = useState(1);
  const observacaoInicial = separarObservacao(detalhe?.pedido.observacao ?? "");
  const [observacao, setObservacao] = useState(observacaoInicial.observacao);
  const [expedicao, setExpedicao] = useState(observacaoInicial.expedicao);
  const observacaoCompleta = juntarObservacao(expedicao, observacao);

  // (f) Resultado
  const [criando, setCriando] = useState(false);
  const [criado, setCriado] = useState<PedidoCriado | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);

  // ----- busca de cliente (debounce 300ms, mín. 2 chars) -----
  useEffect(() => {
    const termo = buscaCliente.trim();
    if (termo.length < 2 || clienteSel) {
      setClientesAchados([]);
      setBuscandoCliente(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setBuscandoCliente(true);
      limparErro("cliente");
      try {
        const r = await balcao<{ clientes: BalcaoCliente[] }>("balcao_cliente_buscar", { termo });
        if (!cancelled) setClientesAchados(r.clientes ?? []);
      } catch (e) {
        if (!cancelled) { setClientesAchados([]); registrarErro("cliente", e, "Erro ao buscar cliente"); }
      } finally {
        if (!cancelled) setBuscandoCliente(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [buscaCliente, clienteSel]);

  // ----- busca de produto (debounce 300ms) -----
  useEffect(() => {
    const termo = buscaProduto.trim();
    if (termo.length < 2) {
      setProdutosAchados([]);
      setBuscandoProduto(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setBuscandoProduto(true);
      limparErro("itens");
      try {
        const r = await balcao<{ produtos: BalcaoProduto[] }>("balcao_produto_buscar", {
          termo,
          centro_codigo: cdSel,
        });
        if (!cancelled) setProdutosAchados(r.produtos ?? []);
      } catch (e) {
        if (!cancelled) { setProdutosAchados([]); registrarErro("itens", e, "Erro ao buscar produto"); }
      } finally {
        if (!cancelled) setBuscandoProduto(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [buscaProduto, cdSel]);

  // ViaCEP runs on blur; preserve number/complement and ignore older lookups.
  const formRef = useRef(form);
  formRef.current = form;
  const buscarCep = async () => {
    const cep = soDigitos(formRef.current.cep);
    if (cep.length !== 8) return;
    const seq = ++cepSeq.current;
    setBuscandoCep(true);
    limparErro("cep");
    try {
      const endereco = await fetchCEP(cep);
      if (seq !== cepSeq.current || soDigitos(formRef.current.cep) !== cep) return;
      setForm(f => ({ ...f, logradouro: endereco.logradouro || f.logradouro,
        bairro: endereco.bairro || f.bairro, cidade: endereco.cidade || f.cidade, uf: endereco.uf || f.uf }));
    } catch (e) {
      if (seq === cepSeq.current) registrarErro("cep", e, "Erro ao consultar CEP");
    } finally { if (seq === cepSeq.current) setBuscandoCep(false); }
  };
  const onCampo = (k: keyof ClienteForm, v: string) => setForm(f => ({ ...f, [k]: v }));

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
    queryKey: ["balcao", "bonif_motivos", userId],
    retry: false,
    throwOnError: false,
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
  useEffect(() => { if (motivosBonif.error) registrarErro("pagamento", motivosBonif.error, "Erro ao carregar motivos"); }, [motivosBonif.error, registrarErro]);
  const bonifOk = bonifAutorizado.trim().length >= 2 && !!bonifMotivo;
  const escolherMeio = (p: MeioPagamento) => {
    if (modoBalcao && p === "bonificacao") return;
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
    const seq = ++quoteSeq.current;
    setCalculando(true);
    erroCotacao.current = "";
    limparErro("entrega");
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
      if (seq !== quoteSeq.current) return null;
      setCotacao(c);
      const imediato = somenteBalcao(c.opcoes);
      setBalcaoPorCd(prev => prev[cdSel] === imediato ? prev : { ...prev, [cdSel]: imediato });
      setModoSel(atual => selecionarModoEntrega(c.opcoes, atual));
      if (imediato) setPagamento(atual => atual === "bonificacao" ? null : atual);
      return c;
    } catch (e) {
      if (seq === quoteSeq.current) { setCotacao(null); setModoSel(atual => atual === "balcao" ? atual : "retirada"); erroCotacao.current = e instanceof Error ? e.message : "Erro ao calcular entrega"; registrarErro("entrega", e, "Erro ao calcular entrega"); }
      return null;
    } finally {
      if (seq === quoteSeq.current) setCalculando(false);
    }
  }, [itens, enderecoAtual, clienteSel, beneficio, cdSel]);

  const itensKey = itens.map((i) => `${i.sku}:${i.quantidade}`).join("|");
  const cepKey = enderecoAtual?.cep ?? "";
  const benKey = JSON.stringify(beneficio);
  useEffect(() => {
    quoteSeq.current += 1;
    setCotacao(null);
    if (!podeItens || itens.length === 0 || itens.some(i => !Number.isInteger(i.quantidade) || i.quantidade <= 0)) {
      setCalculando(false);
      return;
    }
    setCalculando(true);
    const t = setTimeout(() => { void recotar(); }, 600);
    return () => { quoteSeq.current += 1; clearTimeout(t); };
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
    setItens(atual => atual.map(i => i.sku === sku ? { ...i, quantidade: Number.isFinite(qtd) ? qtd : 0 } : i));
  };
  const removerItem = (sku: string) => setItens(atual => atual.filter(i => i.sku !== sku));

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
          registrarErro("itens", e, "Erro ao atualizar saldo do CD");
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

  // Basic input validation only; stock, discounts and final pricing remain SNCF-owned.
  const cepValido = (enderecoAtual?.cep ?? "").length === 8;
  const emailObrigatorio = modoBalcao || pagamento === "cartao";
  const entregaOk = modoSel === "retirada" || (cotacao !== null && opcaoSel !== null && (modoBalcao || cepValido));
  const pendenciaCriacao = pendenciaBasica({ clienteSelecionado: clienteSel !== null, novoCliente: modoNovoCliente,
    form, cpf: detalhe ? form.cpf : clienteSel?.cpf ?? form.cpf, itens, modo: modoSel, cotando: calculando,
    entregaDisponivel: entregaOk, motivoBeneficioOk: motivoOk, pagamento,
    bonificacaoOk: !!detalhe || bonifOk, emailCartaoOk: !emailObrigatorio || !!clienteSel || form.email.trim().includes("@"), nsu });
  const podeCriar = !pendenciaCriacao && !criando;

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
  const pedidoMudou = !!detalhe && podeItens && (itensMudaram || entregaMudou || observacaoCompleta !== (detalhe.pedido.observacao ?? ""));
  const meioMudou = !!detalhe && !bonif && pagamento !== detalhe.pedido.pagamento;
  const temAlteracao = pedidoMudou || meioMudou || Object.keys(clientePatch).length > 0;
  const podeSalvarOriginal = podeEditar && temAlteracao && motivoAlteracao.trim().length >= 3 && !criando && (!pedidoMudou || (itens.length > 0 && (!entregaMudou || entregaOk) && !calculando && motivoOk));
  const pendenciaEdicao: Pendencia | null = !podeEditar ? null : !temAlteracao ?
    { card: "resumo", mensagem: "Nenhuma alteração para salvar" } : pedidoMudou && pendenciaCriacao ? pendenciaCriacao :
    calculando ? { card: "entrega", mensagem: "Aguarde a cotação da entrega" } :
    motivoAlteracao.trim().length < 3 ? { card: "resumo", campo: "balcao-motivo-alteracao", mensagem: "Informe o motivo da alteração (mín. 3 caracteres)" } : null;
  const podeSalvar = podeSalvarOriginal && !pendenciaEdicao;
  const pendencia = detalhe ? pendenciaEdicao : pendenciaCriacao;
  const focarPendencia = () => {
    if (!pendencia) return;
    if (pendencia.card === "beneficio") setBenAberto(true);
    requestAnimationFrame(() => {
      const card = document.getElementById(`balcao-card-${pendencia.card}`);
      card?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      const campo = pendencia.campo ? document.getElementById(pendencia.campo) : null;
      (campo ?? card?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)'))?.focus({ preventScroll: true });
    });
  };
  const salvarEdicao = async () => {
    if (!detalhe || !userId || !podeSalvar) return;
    setCriando(true);
    limparErro("salvar");
    try {
      let cot = cotacao;
      if ((pedidoMudou || (meioMudou && Object.keys(clientePatch).length > 0)) && modoSel !== "retirada") {
        cot = await recotar();
        if (!cot || !cot.opcoes.some(o => o.modo === modoSel && o.ok)) throw new Error(erroCotacao.current || "Não foi possível recalcular a entrega. Tente de novo.");
      }
      const entrega = modoSel === "balcao" ? entregaImediata(cdSel, pagamento, nsu) : modoSel === "retirada" ? { modo: modoSel, centro_codigo: cdSel, beneficio } : { modo: modoSel, centro_codigo: cdSel, cotacao_id: cot?.cotacao_id, endereco: enderecoAtual, beneficio };
      const r = await salvarAlteracaoBalcao({ fop_profile_id: userId, pedido_id: detalhe.pedido.id, motivo: motivoAlteracao, cliente: clientePatch, pedidoAlterado: pedidoMudou, meioAlterado: meioMudou, itens: itensPayload, entrega, observacao: observacaoCompleta, meio: pagamento as AlteracaoBalcao["meio"] });
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
      registrarErro("salvar", e, "Erro ao salvar pedido");
    } finally { setCriando(false); }
  };

  // ----- criar pedido -----
  const criarPedido = async () => {
    if (!podeCriar) return;
    setCriando(true);
    limparErro("salvar");
    try {
      // Recota se a cotação expirou
      let cot = cotacao;
      if (modoSel !== "retirada") {
        if (!cot || new Date(cot.valida_ate).getTime() < Date.now()) {
          cot = await recotar();
          if (!cot) throw new Error(erroCotacao.current || "Não foi possível recalcular a entrega. Tente de novo.");
        }
      }

      const clientePayload = clienteSel
        ? { parceiro_id: clienteSel.id, ...(modoSel === "balcao" ? { email: form.email.trim() } : {}) }
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

      if (exigeEnderecoEntrega(modoSel) && (!cot || !enderecoAtual)) {
        throw new Error("Informe o endereço e recalcule a entrega. Tente de novo.");
      }
      if (modoSel === "balcao" && (!cot || !somenteBalcao(cot.opcoes) || !cot.opcoes.some(o => o.modo === "balcao" && o.ok))) {
        throw new Error("A entrega precisa de uma cotação válida. Tente de novo.");
      }
      const entregaPayload =
        modoSel === "balcao" ? entregaImediata(cdSel, pagamento, nsu) : modoSel === "retirada"
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
        // bonificacao é o discriminador aceito pelo SNCF: ele grava
        // forma_solicitada=sem_pagamento e mantém seu cálculo de bonificação.
        ...(observacaoCompleta ? { observacao: observacaoCompleta } : {}),
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
      registrarErro("salvar", e, "Erro ao criar pedido");
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
      registrarErro("salvar", e, "Erro ao gerar link");
    } finally {
      setGerandoLink(false);
    }
  };

  const limparTudo = () => {
    const proxima = prepararProximaVenda(cdSel, modoBalcao);
    quoteSeq.current += 1;
    cepSeq.current += 1;
    setCalculando(false);
    setBuscandoCep(false);
    setBuscandoCliente(false);
    setBuscandoProduto(false);
    erroCotacao.current = "";
    setBuscaCliente("");
    setClientesAchados([]);
    setClienteSel(null);
    setModoNovoCliente(false);
    setForm(FORM_VAZIO);
    setBuscaProduto("");
    setProdutosAchados([]);
    setItens([]);
    setCotacao(null);
    setCdSel(proxima.centro_codigo);
    setModoSel(proxima.modo);
    setBenAberto(false);
    setBenPedidoTipo("nenhum");
    setBenPedidoValor("");
    setBenPedidoMotivo("");
    setBenFreteTipo("nenhum");
    setBenFreteValor("");
    setBenFreteMotivo("");
    setPagamento(proxima.pagamento);
    setNsu(proxima.nsu);
    setBonifAutorizado("");
    setBonifObs("");
    if (modoBalcao) setBonifMotivo("");
    setMaxParcelas(1);
    setObservacao("");
    setExpedicao("");
    setErros({});
    setCriado(null);
  };

  const total = opcaoSel?.valor_total ?? (detalhe && !pedidoMudou ? detalhe.pedido.valor_liquido : subtotalLocal);
  const pagamentoRefeito = detalhe && (meioMudou || Math.abs(total - detalhe.pedido.valor_liquido) > 0.005) ?
    `Pagamento será refeito: ${brl(detalhe.pedido.valor_liquido)} → ${brl(total)} · ${{ pix: "PIX", cartao: "Cartão link", cartao_maquininha: "Cartão maquininha", bonificacao: "Bonificação" }[pagamento ?? "pix"]}` : undefined;
  const submit = () => { if (pendencia) { focarPendencia(); return; } void (detalhe ? salvarEdicao() : criarPedido()); };
  if (criado) return <PedidoResultado criado={criado} pagamento={pagamento} clienteNome={clienteSel?.nome ?? form.nome}
    clienteTelefone={clienteSel?.telefone ?? form.telefone} modo={modoSel} cd={cdRotulo} opcao={opcaoSel} edicao={!!detalhe}
    resultadoEdicao={resultadoEdicao} totalAnterior={detalhe?.pedido.valor_liquido} gerandoLink={gerandoLink}
    onGerarLink={() => void gerarNovoLink()} onNovo={detalhe ? onVoltar : limparTudo}
    onAbrir={() => detalhe ? onVoltar?.() : onAbrirPedido?.(criado.pedido_id)} onFechar={onFechar ?? onVoltar ?? limparTudo} erro={erros.salvar} />;
  return <div data-balcao-evento={modoBalcao ? "true" : undefined} className="space-y-4 pb-32 lg:pb-0">
    {detalhe && <div className="space-y-2"><Button variant="outline" onClick={onVoltar}>Voltar para meus pedidos</Button>
      <h2 className="text-lg font-medium">{detalhe.pedido.id_externo}</h2>
      <p className="text-sm text-muted-foreground">{detalhe.pedido.situacao ?? detalhe.pedido.estagio} · {detalhe.pedido.pagamento} · Total {brl(detalhe.pedido.valor_liquido)}{detalhe.pedido.nf_numero ? ` · NF ${detalhe.pedido.nf_numero}` : ""}</p>
      {(detalhe.permissoes.motivo_bloqueio || !podeEditar) && <p role="status" className="rounded-md border p-3 text-sm">{detalhe.permissoes.motivo_bloqueio ?? "Pedido disponível somente para leitura"}</p>}
    </div>}
    {erros.salvar && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{erros.salvar}</p>}
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        {!detalhe && <Card className="rounded-lg"><CardHeader className="p-4 sm:p-6"><CardTitle className="text-base tracking-normal">CD</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <Select value={cdSel} onValueChange={codigo => { setCdSel(codigo); if (balcaoPorCd[codigo]) { setModoSel("balcao"); setPagamento(atual => atual === "bonificacao" ? null : atual); } else if (modoBalcao) setModoSel("retirada"); }} disabled={criando}><SelectTrigger aria-label="CD" className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{cds.map(c => <SelectItem key={c.codigo} value={c.codigo}>{c.rotulo}{c.padrao ? " (padrão)" : ""}</SelectItem>)}</SelectContent></Select>
          {erros.cd && <p role="alert" className="mt-2 text-sm text-destructive">{erros.cd}</p>}
        </CardContent></Card>}
        <ClienteCard cliente={clienteSel} novo={modoNovoCliente} edicao={!!detalhe} podeCliente={podeCliente} form={form} onCampo={onCampo}
          busca={buscaCliente} onBusca={setBuscaCliente} resultados={clientesAchados} buscando={buscandoCliente}
          onSelecionar={c => { setClienteSel(c); const preenchido = { ...FORM_VAZIO }; for (const k of Object.keys(preenchido) as (keyof ClienteForm)[]) preenchido[k] = c[k] ?? ""; preenchido.cpf = maskCpf(preenchido.cpf); preenchido.cep = maskCep(preenchido.cep); setForm(preenchido); setClientesAchados([]); }}
          onNovo={() => { setClienteSel(null); setForm(FORM_VAZIO); setModoNovoCliente(true); }}
          onTrocar={() => { setClienteSel(null); setForm(FORM_VAZIO); setBuscaCliente(""); }}
          onCancelar={() => { setModoNovoCliente(false); setForm(FORM_VAZIO); }} buscandoCep={buscandoCep} onCepBlur={() => void buscarCep()}
          emailObrigatorio={emailObrigatorio} modoBalcao={modoBalcao} disabled={criando} erro={erros.cliente} erroCep={erros.cep} />
        <ItensCard busca={buscaProduto} onBusca={setBuscaProduto} buscando={buscandoProduto} resultados={produtosAchados} itens={itens}
          cd={cdRotulo} disabled={!podeItens || criando} onAdicionar={adicionarItem} onQuantidade={setQtd} onRemover={removerItem} erro={erros.itens} />
        <EntregaCard form={form} onCampo={onCampo} onCepBlur={() => void buscarCep()} buscandoCep={buscandoCep}
          cotacao={cotacao} cotando={calculando} modo={modoSel} onModo={setModoSel} cd={cdRotulo} modoBalcao={modoBalcao} disabled={!podeItens || criando}
          enderecoDisabled={!!detalhe && !podeItens && !podeCliente || criando} erro={erros.entrega} erroCep={erros.cep} />
        <fieldset disabled={!podeItens || criando}>
      {/* (d) Benefício */}
      {!bonif && <Collapsible open={benAberto} onOpenChange={setBenAberto}>
        <Card id="balcao-card-beneficio" className="rounded-lg scroll-mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-between whitespace-normal p-4 text-left sm:p-6">
              <CardTitle className="flex items-center justify-between w-full text-base tracking-normal">
                Benefício {beneficioAtivo && <Badge className="ml-2">ativo</Badge>}
                <ChevronDown
                  className={`h-4 w-4 transition ${benAberto ? "rotate-180" : ""}`}
                />
              </CardTitle>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
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
                <div className="space-y-2">
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
                <p className="text-xs text-warning">
                  Informe o motivo (mín. 3 letras) para cada benefício ativo.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>}


        </fieldset>
        <PagamentoCard pagamento={pagamento} onPagamento={escolherMeio} onSairBonificacao={sairBonificacao} edicao={!!detalhe} modoBalcao={modoBalcao} nsu={nsu} onNsu={valor => setNsu(normalizarNsu(valor))}
          disabled={!podeMeio || criando || (!!detalhe && bonif)} parcelas={maxParcelas} onParcelas={setMaxParcelas}
          autorizado={bonifAutorizado} onAutorizado={setBonifAutorizado} motivo={bonifMotivo} onMotivo={setBonifMotivo}
          observacao={bonifObs} onObservacao={setBonifObs} motivos={motivosBonif.data ?? []} carregandoMotivos={motivosBonif.isLoading}
          erroMotivos={motivosBonif.error?.message} />
        <Card className="rounded-lg border-warning/50 bg-warning/10"><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base tracking-normal"><AlertTriangle className="h-4 w-4 text-warning" />Instrução para expedição</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <Textarea aria-label="Instrução para expedição" rows={3} value={expedicao} onChange={e => setExpedicao(e.target.value)} disabled={!podeItens || criando} placeholder="Ex.: enviar apenas a peça, embalar para presente… Aparece em destaque para a Mesa SP" />
        </CardContent></Card>
        <Card className="rounded-lg"><CardHeader className="p-4 sm:p-6"><CardTitle className="text-base tracking-normal">Observação</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <Textarea aria-label="Observação" rows={3} value={observacao} onChange={e => setObservacao(e.target.value)} disabled={!podeItens || criando} placeholder="Opcional" />
        </CardContent></Card>
      </div>
      <ResumoPedido cliente={clienteSel?.nome ?? form.nome} itens={itens} valorItens={opcaoSel?.valor_itens ?? subtotalLocal}
        desconto={opcaoSel?.desconto_pedido ?? 0} motivoDesconto={benPedidoMotivo} frete={opcaoSel?.frete_cobrado ?? (detalhe && !entregaMudou ? detalhe.pedido.valor_frete : null)}
        modo={modoSel} cd={cdRotulo} total={total} pagamento={pagamento} parcelas={maxParcelas} pendencia={pendencia} onPendencia={focarPendencia}
        onSubmit={submit} disabled={detalhe ? !podeSalvar : !podeCriar} enviando={criando} edicao={!!detalhe} somenteLeitura={!!detalhe && !podeEditar}
        motivo={motivoAlteracao} onMotivo={setMotivoAlteracao} pagamentoRefeito={pagamentoRefeito} />
    </div>
  </div>;
}
