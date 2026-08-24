import { useEffect, useMemo, useState } from "react";
import { syncFreteFromDb } from "@/lib/freteUf";
import { Award, ChevronDown, Gift, Lock, Settings2, Sparkles, X } from "lucide-react";
import {
  ACRESCIMO_ISENTO_IE_PERCENT,
  CONDICAO_BONIFICADO,
  CONDICAO_BONIFICADO_ID,
  CONDICOES_PAGAMENTO,
  DESCONTO_MASTER_MAX,
  DESCONTO_REP_MAX,
  FAIXAS,
  JUSTIFICATIVAS_NEGOCIACAO,
  MOTIVOS_BONIFICACAO,
  calcularPedido,
  detectarFaixa,
  proximaFaixa,
  type CalculoPedido,
  type CondicaoPagamento,
} from "@/lib/commercial";
import { useNegotiation } from "@/store/negotiationStore";
import { formatBRL } from "@/lib/format";
import { useOrder } from "@/store/orderStore";
import { useClientes } from "@/store/clienteStore";
import { useAuth } from "@/store/authStore";
import { getPremissasVigentes } from "@/lib/premissas";


export interface CommercialState {
  calculo: CalculoPedido;
  condicao: CondicaoPagamento | null;
  podeFinalizar: boolean;
  motivoBloqueio: string | null;
  /** Ajuste 1 — cálculo para COTAÇÃO (rascunho): ignora o pedido mínimo. */
  calculoCotacao: CalculoPedido;
  condicaoCotacao: CondicaoPagamento | null;
  podeSalvarCotacao: boolean;
  bonificado?: boolean;
  motivoBonificacao?: string;
}

export function CartCommercialPanel({
  bruto,
  onChange,
}: {
  bruto: number;
  onChange: (s: CommercialState) => void;
}) {
  const {
    ativo,
    descontoPct,
    justificativa,
    observacaoInterna,
    usarReservada,
    condicaoSelecionadaId,
    freteGratis,
    freteAjusteModo,
    freteAjusteQtd,
    liberarTodasCondicoes,
    setDescontoPct,
    setJustificativa,
    setObservacaoInterna,
    setUsarReservada,
    setCondicaoSelecionadaId,
    setFreteGratis,
    setFreteAjusteModo,
    setFreteAjusteQtd,
    setLiberarTodasCondicoes,
    ativarSemSenha,
    desativar,
  } = useNegotiation();

  const [showSenha, setShowSenha] = useState(false);
  // Descontos não são aplicados automaticamente — o vendedor habilita cada um
  const [aplicarCelebra, setAplicarCelebra] = useState(false);
  const [aplicarNegociacao, setAplicarNegociacao] = useState(false);
  const [aplicarPix, setAplicarPix] = useState(false);
  



  // Pedido bonificado (só visível para internos/admin/master)
  const roles = useAuth((s) => s.roles);
  const profile = useAuth((s) => s.profile);
  const canBonificar =
    roles.includes("admin") ||
    roles.includes("master") ||
    (roles.includes("vendedor") && (profile?.tipo_vendedor ?? "interno") === "interno");
  // Representante (ou qualquer vendedor não admin/master): entra no modo
  // negociação sem senha, respeitando o teto de desconto próprio.
  const isRepresentante = !roles.includes("admin") && !roles.includes("master");
  const tetoDesconto = isRepresentante ? DESCONTO_REP_MAX : DESCONTO_MASTER_MAX;
  const descontoPctEfetivo = Math.min(descontoPct, tetoDesconto);
  const [bonificado, setBonificado] = useState(false);
  const [motivoBonif, setMotivoBonif] = useState<string>("");
  const [motivoOutroTxt, setMotivoOutroTxt] = useState<string>("");
  useEffect(() => { if (!canBonificar && bonificado) setBonificado(false); }, [canBonificar, bonificado]);

  // Tabela de frete FOB por UF: sincroniza com o banco (fonte oficial) e
  // re-renderiza para o cálculo refletir eventuais atualizações do admin.
  const [, setFreteTick] = useState(0);
  useEffect(() => {
    void syncFreteFromDb().then(() => setFreteTick((n) => n + 1));
  }, []);
  const motivoBonificacaoFinal =
    motivoBonif === "outro" ? (motivoOutroTxt.trim() ? `outro: ${motivoOutroTxt.trim()}` : "") : motivoBonif;

  // V13 — premissas vigentes do cliente atual (se houver)
  const clienteId = useOrder((s) => s.meta.clienteId);
  const metaUf = useOrder((s) => s.meta.uf);
  const cliente = useClientes((s) =>
    clienteId ? s.clientes.find((c) => c.id === clienteId) ?? null : null,
  );
  const premissas = useMemo(() => getPremissasVigentes(cliente), [cliente]);

  // V20 — UF de destino: endereço de entrega (se diferente) > endereço principal > meta
  const ufDestino = useMemo<string | undefined>(() => {
    if (cliente) {
      if (cliente.enderecoEntregaIgual) return cliente.estado?.toUpperCase() || undefined;
      return (cliente.entregaEstado || cliente.estado || "").toUpperCase() || undefined;
    }
    return metaUf ? metaUf.toUpperCase() : undefined;
  }, [cliente, metaUf]);

  // Faixa atual — faixa fixa do cliente tem prioridade
  const faixa = useMemo(() => {
    if (premissas?.temFaixaFixa && premissas.faixaFixaId != null) {
      return FAIXAS.find((f) => f.id === premissas.faixaFixaId) ?? null;
    }
    const detectada = detectarFaixa(bruto, ativo && usarReservada);
    if (detectada) return detectada;
    // Negociação master ativa libera pedido abaixo do mínimo → usa a faixa
    // não-reservada de menor valor para apresentar condições e cálculos.
    if (ativo || bonificado) {
      const menor = [...FAIXAS]
        .filter((f) => !f.requerSenhaMaster)
        .sort((a, b) => a.valorMin - b.valorMin)[0];
      return menor ?? null;
    }
    return null;
  }, [bruto, ativo, usarReservada, premissas, bonificado]);

  // Condições disponíveis
  const condicoesDisponiveis = useMemo<CondicaoPagamento[]>(() => {
    if (!faixa) return [];
    if (ativo && liberarTodasCondicoes) return CONDICOES_PAGAMENTO; // master libera todas
    // V13 — premissas com condições preferenciais sobrepõem a faixa
    if (premissas?.temCondicaoPreferencial && premissas.condicoesPermitidas.length > 0) {
      return CONDICOES_PAGAMENTO.filter((c) =>
        premissas.condicoesPermitidas.includes(c.id),
      );
    }
    return CONDICOES_PAGAMENTO.filter(
      (c) => faixa.condicoesDisponiveis.includes(c.id) && bruto >= c.valorMinimo,
    );
  }, [faixa, ativo, liberarTodasCondicoes, bruto, premissas]);

  // Condição selecionada — bonificado força a condição sentinela
  const condicao = useMemo(() => {
    if (bonificado) return CONDICAO_BONIFICADO;
    return condicoesDisponiveis.find((c) => c.id === condicaoSelecionadaId) ?? null;
  }, [condicoesDisponiveis, condicaoSelecionadaId, bonificado]);

  // Pré-seleciona condição preferencial do cliente quando nada está selecionado
  useEffect(() => {
    if (bonificado) return;
    if (!condicaoSelecionadaId && premissas?.condicaoPreferencialId) {
      const existe = condicoesDisponiveis.some(
        (c) => c.id === premissas.condicaoPreferencialId,
      );
      if (existe) setCondicaoSelecionadaId(premissas.condicaoPreferencialId);
    }
  }, [premissas, condicoesDisponiveis, condicaoSelecionadaId, setCondicaoSelecionadaId, bonificado]);

  useEffect(() => {
    if (bonificado) return;
    if (condicaoSelecionadaId && !condicao) setCondicaoSelecionadaId(null);
  }, [condicao, condicaoSelecionadaId, setCondicaoSelecionadaId, bonificado]);

  // V21 — acréscimo por isenção de Inscrição Estadual (puxa do cadastro do cliente)
  const clienteIsentoIE = !!cliente?.isentoIE;
  const [aplicarIsentoIE, setAplicarIsentoIE] = useState(false);
  useEffect(() => {
    setAplicarIsentoIE(clienteIsentoIE);
  }, [clienteIsentoIE, clienteId]);


  const calculo = useMemo(
    () =>
      calcularPedido({
        bruto,
        usarReservada: ativo && usarReservada,
        descontoMasterPct: ativo ? descontoPctEfetivo : 0,
        condicao,
        premissas,
        freteGratisOverride: ativo && freteGratis,
        ignorarPedidoMinimo: ativo || bonificado,
        uf: ufDestino,
        aplicarDescontoCelebra: aplicarCelebra,
        aplicarDescontoNegociacao: aplicarNegociacao,
        aplicarBonusPix: aplicarPix,
        aplicarAcrescimoIsentoIE: aplicarIsentoIE,
        freteAjusteModo,
        freteAjusteQtd: ativo ? freteAjusteQtd : 0,
      }),
    [bruto, ativo, usarReservada, descontoPct, condicao, premissas, freteGratis, freteAjusteModo, freteAjusteQtd, ufDestino, bonificado, aplicarCelebra, aplicarNegociacao, aplicarPix, aplicarIsentoIE],
  );


  // Ajuste 1 — cálculo paralelo para COTAÇÃO: ignora o pedido mínimo,
  // permitindo salvar rascunho em qualquer valor.
  const calculoCotacao = useMemo(
    () =>
      calcularPedido({
        bruto,
        usarReservada: ativo && usarReservada,
        descontoMasterPct: ativo ? descontoPctEfetivo : 0,
        condicao,
        premissas,
        freteGratisOverride: ativo && freteGratis,
        ignorarPedidoMinimo: true,
        uf: ufDestino,
        aplicarDescontoCelebra: aplicarCelebra,
        aplicarDescontoNegociacao: aplicarNegociacao,
        aplicarBonusPix: aplicarPix,
        aplicarAcrescimoIsentoIE: aplicarIsentoIE,
        freteAjusteModo,
        freteAjusteQtd: ativo ? freteAjusteQtd : 0,
      }),
    [bruto, ativo, usarReservada, descontoPctEfetivo, condicao, premissas, freteGratis, freteAjusteModo, freteAjusteQtd, ufDestino, aplicarCelebra, aplicarNegociacao, aplicarPix, aplicarIsentoIE],
  );

  const condicaoCotacao = useMemo<CondicaoPagamento | null>(() => {
    if (condicao) return condicao;
    const f = calculoCotacao.faixa;
    const elegiveis = f
      ? CONDICOES_PAGAMENTO.filter((c) => f.condicoesDisponiveis.includes(c.id))
      : CONDICOES_PAGAMENTO;
    return elegiveis[0] ?? CONDICOES_PAGAMENTO[0] ?? null;
  }, [condicao, calculoCotacao.faixa]);

  const podeSalvarCotacao = !!calculoCotacao.faixa && !!condicaoCotacao;

  const pedidoMinimo = calculo.pedidoMinimoEfetivo ?? 1500;
  const abaixoDoMinimoLiberado = ativo && bruto < pedidoMinimo && !!calculo.faixa;

  const negociacaoSemJustificativa =
    ativo && (descontoPct > 0 || abaixoDoMinimoLiberado) && !justificativa;

  const bonificadoSemMotivo = bonificado && !motivoBonificacaoFinal;

  const podeFinalizar =
    !!calculo.faixa && !!condicao && !negociacaoSemJustificativa && !bonificadoSemMotivo;

  const motivoBloqueio = !calculo.faixa
    ? `Pedido mínimo: ${formatBRL(pedidoMinimo)}. Adicione mais produtos, ative a negociação master ou marque como pedido bonificado.`
    : !condicao
      ? "Selecione uma condição de pagamento."
      : bonificadoSemMotivo
        ? "Selecione (ou descreva) o motivo da bonificação."
        : negociacaoSemJustificativa
          ? "Selecione uma justificativa para a negociação master."
          : null;

  useEffect(() => {
    onChange({
      calculo,
      condicao,
      podeFinalizar,
      motivoBloqueio,
      calculoCotacao,
      condicaoCotacao,
      podeSalvarCotacao,
      bonificado,
      motivoBonificacao: bonificado ? motivoBonificacaoFinal : undefined,
    });
  }, [calculo, condicao, podeFinalizar, motivoBloqueio, onChange, bonificado, motivoBonificacaoFinal, calculoCotacao, condicaoCotacao, podeSalvarCotacao]);

  const prox = premissas?.temFaixaFixa ? null : proximaFaixa(faixa);
  const faltaProx = prox ? prox.valorMin - bruto : 0;
  const descontoEfetivoPct = calculo.descontoCelebraPercentEfetivo ?? faixa?.descontoCelebra ?? 0;
  const bonusPixEfetivoPct = premissas?.bonusPixPersonalizado
    ? premissas.bonusPixPercent
    : faixa?.bonusPix ?? 0;
  const freteEfetivo = calculo.freteEfetivo ?? faixa?.frete;


  // ==== UI enxuta ====
  const [showAvancado, setShowAvancado] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const ajustesAtivos =
    (aplicarIsentoIE ? 1 : 0) +
    (bonificado ? 1 : 0) +
    (ativo && descontoPct > 0 ? 1 : 0) +
    (ativo && freteGratis ? 1 : 0) +
    (ativo && !!freteAjusteQtd ? 1 : 0) +
    (ativo && usarReservada ? 1 : 0) +
    (ativo && liberarTodasCondicoes ? 1 : 0);

  useEffect(() => {
    if (ajustesAtivos > 0) setShowAvancado(true);
  }, [ajustesAtivos > 0]);

  const conteudo = (
    <div className="space-y-3">
      {/* ---------- RESUMO ---------- */}
      <div className="rounded-lg gold-border bg-surface p-4 space-y-3">
        {faixa ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
                  {premissas ? "Condições homologadas" : `Faixa ${faixa.id}`}
                </div>
                <div className="font-display text-xl text-gold flex items-center gap-2 truncate">
                  {premissas ? <Award className="h-4 w-4 shrink-0" /> : <Sparkles className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{premissas ? "Comerciais Homologadas" : faixa.nome}</span>
                </div>
              </div>
              {ativo && (
                <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gold border border-gold/40">
                  Negociação
                </span>
              )}
            </div>

            {/* Descontos como chips */}
            <div className="flex flex-wrap gap-1.5">
              <Chip
                on={aplicarCelebra}
                onClick={() => setAplicarCelebra(!aplicarCelebra)}
                label={`Celebra ${descontoEfetivoPct}%`}
                valor={aplicarCelebra ? `– ${formatBRL(calculo.descontoCelebraValor)}` : undefined}
              />
              <Chip
                on={aplicarPix}
                onClick={() => setAplicarPix(!aplicarPix)}
                label={`Bônus PIX ${bonusPixEfetivoPct}%`}
                valor={calculo.aplicouPix ? `– ${formatBRL(calculo.bonusPixValor)}` : undefined}
              />
              {ativo && (
                <Chip
                  on={aplicarNegociacao}
                  onClick={() => setAplicarNegociacao(!aplicarNegociacao)}
                  label={`Negociação ${descontoPctEfetivo}%`}
                  valor={
                    aplicarNegociacao && descontoPct > 0
                      ? `– ${formatBRL(calculo.descontoMasterValor)}`
                      : undefined
                  }
                />
              )}
            </div>

            {/* Linhas — só o que existe */}
            <ul className="text-sm space-y-1">
              <Row label="Valor do pedido" value={formatBRL(bruto)} />
              {(calculo.freteValor ?? 0) > 0 && (
                <Row
                  label={`Frete ${freteEfetivo}${calculo.fretePercent ? ` · ${calculo.fretePercent}%` : ""}`}
                  value={`+ ${formatBRL(calculo.freteValor ?? 0)}`}
                />
              )}
              {calculo.freteIsento && (
                <Row
                  label="Frete"
                  value={calculo.freteGratisNegociado ? "Grátis (negociação)" : "Isento (CIF)"}
                  accent
                />
              )}
              {aplicarIsentoIE && (
                <Row
                  label={`Acréscimo isento de IE (${ACRESCIMO_ISENTO_IE_PERCENT}%)`}
                  value={`+ ${formatBRL(calculo.acrescimoIsentoIEValor ?? 0)}`}
                />
              )}
              {bonificado && <Row label="Pedido bonificado" value="Sem cobrança" accent />}
            </ul>

            <div className="border-t border-border pt-2.5 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-text-secondary">
                {calculo.aplicouPix ? "Valor com PIX" : "Valor final"}
              </span>
              <span className="font-display text-2xl text-gold">{formatBRL(calculo.total)}</span>
            </div>

            {prox && (
              <div className="rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gold mb-1.5">
                  <span>Próxima: {prox.nome}</span>
                  <span className="normal-case tracking-normal text-text-muted">
                    faltam <strong className="text-gold">{formatBRL(faltaProx)}</strong>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-gold transition-all"
                    style={{ width: `${Math.min(100, (bruto / prox.valorMin) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-2 space-y-1">
            <div className="text-sm text-stock-out">Pedido mínimo: {formatBRL(pedidoMinimo)}</div>
            <p className="text-xs text-text-muted">
              Adicione produtos, ative a negociação ou salve como{" "}
              <strong className="text-gold">cotação (rascunho)</strong>.
            </p>
          </div>
        )}
      </div>

      {/* ---------- PAGAMENTO ---------- */}
      {faixa && !bonificado && (
        <div className="rounded-lg gold-border bg-surface p-4 space-y-2.5">
          <h3 className="text-xs uppercase tracking-[0.2em] text-gold-muted">Forma de pagamento</h3>
          <PaymentSelector
            condicoes={condicoesDisponiveis}
            todas={ativo && liberarTodasCondicoes ? CONDICOES_PAGAMENTO : null}
            selectedId={condicao?.id ?? null}
            onSelect={setCondicaoSelecionadaId}
          />
        </div>
      )}

      {/* ---------- AJUSTES AVANÇADOS ---------- */}
      <div className="rounded-lg gold-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAvancado((v) => !v)}
          className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 text-left hover:bg-surface-2/60"
        >
          <Settings2 className="h-4 w-4 text-gold shrink-0" />
          <span className="min-w-0 text-xs uppercase tracking-[0.2em] text-gold-muted truncate">
            Ajustes avançados
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {ajustesAtivos > 0 && (
              <span className="rounded-full bg-gold/20 border border-gold/50 px-2 py-0.5 text-[10px] text-gold">
                {ajustesAtivos}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-text-muted transition-transform ${showAvancado ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        {showAvancado && (
          <div className="border-t border-border p-4 space-y-3">
            {/* Negociação */}
            {!ativo ? (
              <button
                onClick={() => (isRepresentante ? ativarSemSenha() : setShowSenha(true))}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-gold/40 py-2 text-[11px] uppercase tracking-wider text-gold hover:bg-gold/10"
              >
                <Lock className="h-3 w-3" />
                {isRepresentante ? "Abrir negociação" : "Abrir negociação (senha master)"}
              </button>
            ) : (
              <div className="rounded-md border border-gold/40 bg-gold/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gold">
                    Negociação ativa
                  </span>
                  <button onClick={desativar} className="text-text-muted hover:text-stock-out" aria-label="Desativar">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
                    Desconto adicional {descontoPctEfetivo}% — máx. {tetoDesconto}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={tetoDesconto}
                    step={0.5}
                    value={descontoPct}
                    onChange={(e) => setDescontoPct(parseFloat(e.target.value))}
                    className="w-full accent-[var(--gold)]"
                  />
                </div>

                <select
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Justificativa…</option>
                  {JUSTIFICATIVAS_NEGOCIACAO.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>

                <div className="grid gap-2 text-sm">
                  <Toggle
                    checked={freteGratis}
                    onChange={setFreteGratis}
                    label="Frete grátis (CIF)"
                  />
                  {bruto >= 12000 && (
                    <Toggle
                      checked={usarReservada}
                      onChange={setUsarReservada}
                      label="Faixa Reservada — 25% fixo (sem PIX)"
                    />
                  )}
                  <Toggle
                    checked={liberarTodasCondicoes}
                    onChange={setLiberarTodasCondicoes}
                    label="Liberar todas as formas de pagamento"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted shrink-0">
                    Frete ±
                  </span>
                  <select
                    value={freteAjusteModo}
                    onChange={(e) => setFreteAjusteModo(e.target.value as "percent" | "valor")}
                    className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="percent">%</option>
                    <option value="valor">R$</option>
                  </select>
                  <input
                    type="number"
                    step={freteAjusteModo === "percent" ? 1 : 10}
                    value={freteAjusteQtd === 0 ? "" : freteAjusteQtd}
                    placeholder="0"
                    onChange={(e) => setFreteAjusteQtd(parseFloat(e.target.value))}
                    disabled={freteGratis}
                    className="min-w-0 flex-1 bg-surface-2 border border-border rounded-md px-2 py-1.5 text-sm disabled:opacity-50"
                  />
                </div>

                <textarea
                  value={observacaoInterna}
                  onChange={(e) => setObservacaoInterna(e.target.value)}
                  rows={2}
                  placeholder="Observação interna (não vai para o cliente)"
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm resize-none"
                />
              </div>
            )}

            {/* Acréscimo IE */}
            <Toggle
              checked={aplicarIsentoIE}
              onChange={setAplicarIsentoIE}
              label={`Acréscimo isento de IE (${ACRESCIMO_ISENTO_IE_PERCENT}%)`}
              hint={
                clienteIsentoIE
                  ? "Cliente isento de IE — sugerido automaticamente."
                  : "Cliente possui IE. Marque só se devido."
              }
              valor={aplicarIsentoIE ? `+ ${formatBRL(calculo.acrescimoIsentoIEValor ?? 0)}` : undefined}
            />

            {/* Bonificado */}
            {canBonificar && (
              <div className="space-y-2">
                <Toggle
                  checked={bonificado}
                  onChange={setBonificado}
                  label="Pedido bonificado"
                  hint="Ignora mínimo. Não conta em meta, pace nem comissão."
                  icon={<Gift className="h-3.5 w-3.5 text-purple-300" />}
                />
                {bonificado && (
                  <div className="pl-6 space-y-2">
                    <select
                      value={motivoBonif}
                      onChange={(e) => setMotivoBonif(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Motivo da bonificação…</option>
                      {MOTIVOS_BONIFICACAO.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                    {motivoBonif === "outro" && (
                      <input
                        type="text"
                        value={motivoOutroTxt}
                        onChange={(e) => setMotivoOutroTxt(e.target.value)}
                        placeholder="Descreva o motivo…"
                        maxLength={200}
                        className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- AVISO ÚNICO ---------- */}
      {motivoBloqueio && (
        <p className="rounded-md border border-stock-out/40 bg-stock-out/5 px-3 py-2 text-xs text-stock-out">
          {motivoBloqueio}
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">{conteudo}</div>

      {/* Mobile — resumo fixo + drawer */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          className="sticky bottom-2 z-30 w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg gold-border bg-surface px-4 py-3 text-left shadow-lg"
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gold-muted truncate">
              {faixa ? (premissas ? "Homologadas" : faixa.nome) : "Abaixo do mínimo"}
              {ajustesAtivos > 0 ? ` · ${ajustesAtivos} ajuste(s)` : ""}
            </span>
            <span className="block font-display text-xl text-gold">{formatBRL(calculo.total)}</span>
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted">
            Detalhes
          </span>
        </button>
        {showDrawer && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-gold-muted">
                Resumo comercial
              </span>
              <button onClick={() => setShowDrawer(false)} className="text-text-muted hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{conteudo}</div>
            <div className="border-t border-border p-4">
              <button
                onClick={() => setShowDrawer(false)}
                className="w-full rounded-md bg-gold py-2.5 text-xs uppercase tracking-wider text-background font-semibold"
              >
                Aplicar e voltar
              </button>
            </div>
          </div>
        )}
      </div>

      {showSenha && <MasterPasswordModal onClose={() => setShowSenha(false)} />}
    </>
  );
}

function Chip({
  on,
  onClick,
  label,
  valor,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  valor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] transition ${
        on
          ? "border-gold bg-gold/15 text-gold"
          : "border-border text-text-muted hover:border-gold/40 hover:text-text-primary"
      }`}
    >
      {label}
      {on && valor ? <span className="ml-1.5 font-medium">{valor}</span> : null}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  valor,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  valor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-3.5 w-3.5 accent-[var(--gold,#c9a227)]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {hint && <span className="block text-[10px] text-text-muted">{hint}</span>}
      </span>
      {valor && <span className="shrink-0 text-xs text-text-primary">{valor}</span>}
    </label>
  );
}


function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <li className="flex items-baseline justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={accent ? "text-gold" : "text-text-primary"}>{value}</span>
    </li>
  );
}

function PaymentSelector({
  condicoes,
  todas,
  selectedId,
  onSelect,
}: {
  condicoes: CondicaoPagamento[];
  todas: CondicaoPagamento[] | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [tab, setTab] = useState<"pix" | "boleto" | "cartao">("pix");
  const pool = todas ?? condicoes;
  const filtered = pool.filter((c) => c.tipo === tab);
  const disponiveisIds = new Set(condicoes.map((c) => c.id));

  return (
    <>
      <div className="flex gap-1 bg-surface-2 p-1 rounded-md">
        {(["pix", "boleto", "cartao"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 text-[11px] uppercase tracking-wider rounded ${
              tab === t ? "bg-gold text-background" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t === "pix" ? "PIX" : t === "boleto" ? "Boleto" : "Cartão"}
          </button>
        ))}
      </div>
      <ul className="space-y-1.5">
        {filtered.length === 0 && (
          <li className="text-xs text-text-muted py-2">Nenhuma opção nesta categoria.</li>
        )}
        {filtered.map((c) => {
          const disponivel = disponiveisIds.has(c.id);
          const isPix = c.tipo === "pix";
          return (
            <li key={c.id}>
              <label
                className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 cursor-pointer transition ${
                  selectedId === c.id
                    ? "border-gold bg-gold/10"
                    : disponivel
                      ? "border-border hover:border-gold/40"
                      : "border-gold/30 bg-gold/5"
                }`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="condicao"
                    checked={selectedId === c.id}
                    onChange={() => onSelect(c.id)}
                    className="accent-[var(--gold)]"
                  />
                  <span className={!disponivel ? "text-gold" : ""}>{c.descricao}</span>
                </span>
                {isPix && (
                  <span className="text-[10px] uppercase tracking-wider text-gold">
                    +bônus
                  </span>
                )}
                {!disponivel && (
                  <span className="text-[10px] uppercase tracking-wider text-gold/80">
                    Master
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {tab === "pix" && (
        <p className="text-[11px] text-gold">✦ Recomendado: aplica bônus adicional.</p>
      )}
    </>
  );
}

function MasterPasswordModal({ onClose }: { onClose: () => void }) {
  const tryActivate = useNegotiation((s) => s.tryActivate);
  const tentativas = useNegotiation((s) => s.tentativas);
  const alterarSenha = useNegotiation((s) => s.alterarSenha);
  const [mode, setMode] = useState<"login" | "change">("login");
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bloqueado = tentativas >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    if (mode === "login") {
      if (bloqueado) return;
      setBusy(true);
      const r = await tryActivate(senha);
      setBusy(false);
      if (r.ok) onClose();
      else setErro(r.erro ?? "Erro");
    } else {
      if (novaSenha !== confirmSenha) return setErro("As senhas novas não coincidem.");
      setBusy(true);
      const r = await alterarSenha(senha, novaSenha);
      setBusy(false);
      if (r.ok) {
        setInfo("Senha master atualizada.");
        setSenha("");
        setNovaSenha("");
        setConfirmSenha("");
        setMode("login");
      } else setErro(r.erro ?? "Erro");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg gold-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gold">
            <Lock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.2em]">
              {mode === "login" ? "Modo Negociação" : "Alterar senha master"}
            </span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              {mode === "login" ? "Senha master" : "Senha atual"}
            </span>
            <input
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro(null);
              }}
              disabled={(mode === "login" && bloqueado) || busy}
              autoFocus
              className="mt-1 w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
            />
          </label>
          {mode === "change" && (
            <>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">
                  Nova senha (mín. 8)
                </span>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">
                  Confirmar nova senha
                </span>
                <input
                  type="password"
                  value={confirmSenha}
                  onChange={(e) => setConfirmSenha(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
          {erro && <p className="text-xs text-stock-out">{erro}</p>}
          {info && <p className="text-xs text-gold">{info}</p>}
          {mode === "login" && (
            <p className="text-[11px] text-text-muted">
              Tentativas: {tentativas} / 3 — padrão inicial: <code>fetely2025</code>
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "change" : "login");
                setErro(null);
                setInfo(null);
              }}
              className="text-[11px] uppercase tracking-wider text-text-muted hover:text-gold"
            >
              {mode === "login" ? "Alterar senha" : "Voltar"}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wider hover:border-gold/50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={(mode === "login" && bloqueado) || busy || !senha}
              className="rounded-md bg-gold px-4 py-2 text-xs uppercase tracking-[0.18em] text-background hover:bg-gold-light disabled:opacity-40"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

