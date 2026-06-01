import { useEffect, useMemo, useState } from "react";
import { Award, Lock, Settings2, Sparkles, Truck, X } from "lucide-react";
import {
  CONDICOES_PAGAMENTO,
  DESCONTO_MASTER_MAX,
  FAIXAS,
  JUSTIFICATIVAS_NEGOCIACAO,
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
import { getPremissasVigentes } from "@/lib/premissas";

export interface CommercialState {
  calculo: CalculoPedido;
  condicao: CondicaoPagamento | null;
  podeFinalizar: boolean;
  motivoBloqueio: string | null;
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
    liberarTodasCondicoes,
    setDescontoPct,
    setJustificativa,
    setObservacaoInterna,
    setUsarReservada,
    setCondicaoSelecionadaId,
    setFreteGratis,
    setLiberarTodasCondicoes,
    desativar,
  } = useNegotiation();

  const [showSenha, setShowSenha] = useState(false);

  // V13 — premissas vigentes do cliente atual (se houver)
  const clienteId = useOrder((s) => s.meta.clienteId);
  const cliente = useClientes((s) =>
    clienteId ? s.clientes.find((c) => c.id === clienteId) ?? null : null,
  );
  const premissas = useMemo(() => getPremissasVigentes(cliente), [cliente]);

  // Faixa atual — faixa fixa do cliente tem prioridade
  const faixa = useMemo(() => {
    if (premissas?.temFaixaFixa && premissas.faixaFixaId != null) {
      return FAIXAS.find((f) => f.id === premissas.faixaFixaId) ?? null;
    }
    const detectada = detectarFaixa(bruto, ativo && usarReservada);
    if (detectada) return detectada;
    // Negociação master ativa libera pedido abaixo do mínimo → usa a faixa
    // não-reservada de menor valor para apresentar condições e cálculos.
    if (ativo) {
      const menor = [...FAIXAS]
        .filter((f) => !f.requerSenhaMaster)
        .sort((a, b) => a.valorMin - b.valorMin)[0];
      return menor ?? null;
    }
    return null;
  }, [bruto, ativo, usarReservada, premissas]);

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

  // Condição selecionada
  const condicao = useMemo(
    () => condicoesDisponiveis.find((c) => c.id === condicaoSelecionadaId) ?? null,
    [condicoesDisponiveis, condicaoSelecionadaId],
  );

  // Pré-seleciona condição preferencial do cliente quando nada está selecionado
  useEffect(() => {
    if (!condicaoSelecionadaId && premissas?.condicaoPreferencialId) {
      const existe = condicoesDisponiveis.some(
        (c) => c.id === premissas.condicaoPreferencialId,
      );
      if (existe) setCondicaoSelecionadaId(premissas.condicaoPreferencialId);
    }
  }, [premissas, condicoesDisponiveis, condicaoSelecionadaId, setCondicaoSelecionadaId]);

  useEffect(() => {
    if (condicaoSelecionadaId && !condicao) setCondicaoSelecionadaId(null);
  }, [condicao, condicaoSelecionadaId, setCondicaoSelecionadaId]);

  const calculo = useMemo(
    () =>
      calcularPedido({
        bruto,
        usarReservada: ativo && usarReservada,
        descontoMasterPct: ativo ? descontoPct : 0,
        condicao,
        premissas,
        freteGratisOverride: ativo && freteGratis,
        ignorarPedidoMinimo: ativo,
      }),
    [bruto, ativo, usarReservada, descontoPct, condicao, premissas, freteGratis],
  );

  const pedidoMinimo = calculo.pedidoMinimoEfetivo ?? 2500;
  const abaixoDoMinimoLiberado = ativo && bruto < pedidoMinimo && !!calculo.faixa;

  const negociacaoSemJustificativa =
    ativo && (descontoPct > 0 || abaixoDoMinimoLiberado) && !justificativa;

  const podeFinalizar =
    !!calculo.faixa && !!condicao && !negociacaoSemJustificativa;

  const motivoBloqueio = !calculo.faixa
    ? `Pedido mínimo: ${formatBRL(pedidoMinimo)}. Adicione mais produtos ou ative a negociação master.`
    : !condicao
      ? "Selecione uma condição de pagamento."
      : negociacaoSemJustificativa
        ? "Selecione uma justificativa para a negociação master."
        : null;

  useEffect(() => {
    onChange({ calculo, condicao, podeFinalizar, motivoBloqueio });
  }, [calculo, condicao, podeFinalizar, motivoBloqueio, onChange]);

  const prox = premissas?.temFaixaFixa ? null : proximaFaixa(faixa);
  const faltaProx = prox ? prox.valorMin - bruto : 0;
  const descontoEfetivoPct = calculo.descontoCelebraPercentEfetivo ?? faixa?.descontoCelebra ?? 0;
  const bonusPixEfetivoPct = premissas?.bonusPixPersonalizado
    ? premissas.bonusPixPercent
    : faixa?.bonusPix ?? 0;
  const freteEfetivo = calculo.freteEfetivo ?? faixa?.frete;

  return (
    <div className="space-y-4">
      {/* Painel de faixa */}
      <div className="rounded-lg gold-border bg-surface p-4 sm:p-5 space-y-3">

        {faixa ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
                  {premissas ? "Condições homologadas" : `Faixa ${faixa.id}`}
                </div>
                <div className="font-display text-xl sm:text-2xl text-gold flex items-center gap-2">
                  {premissas ? (
                    <>
                      <Award className="h-4 w-4" /> Comerciais Homologadas
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> {faixa.nome}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {premissas && (
                  <span className="rounded-full bg-gold/20 px-3 py-1 text-[10px] uppercase tracking-wider text-gold border border-gold/50 inline-flex items-center gap-1">
                    🏅 Homologadas
                  </span>
                )}
                {ativo && (
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-[10px] uppercase tracking-wider text-gold border border-gold/40">
                    Negociação
                  </span>
                )}
              </div>
            </div>

            {premissas && (
              <p className="text-[11px] text-gold-muted">
                Faixa-base: {faixa.nome}
                {premissas.vigenciaFim
                  ? ` · vigência até ${new Date(premissas.vigenciaFim).toLocaleDateString("pt-BR")}`
                  : " · sem expiração"}
              </p>
            )}

            <ul className="text-sm space-y-1.5">
              <Row label="Valor do pedido" value={formatBRL(bruto)} />
              <Row
                label={
                  premissas?.temDescontoHomologado
                    ? `Desconto homologado (${descontoEfetivoPct}%${premissas.descontoHomologadoSobrePos ? " · acumula" : " · substitui"})`
                    : `Desconto Celebra (${descontoEfetivoPct}%)`
                }
                value={`– ${formatBRL(calculo.descontoCelebraValor)}`}
                accent
              />
              {ativo && descontoPct > 0 && (
                <Row
                  label={`Desconto negociação (${descontoPct}%)`}
                  value={`– ${formatBRL(calculo.descontoMasterValor)}`}
                  accent
                />
              )}
              {calculo.aplicouPix && (
                <Row
                  label={`Bônus PIX (${bonusPixEfetivoPct}%${premissas?.bonusPixPersonalizado ? " · personalizado" : ""})`}
                  value={`– ${formatBRL(calculo.bonusPixValor)}`}
                  accent
                />
              )}
            </ul>

            {/* Frete */}
            {calculo.freteBase != null && calculo.freteBase > 0 && (
              <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2 text-xs space-y-1">
                {calculo.freteGratisNegociado ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-text-secondary">
                      Frete — <span className="text-gold uppercase tracking-wider text-[10px]">Grátis (negociação)</span>
                    </span>
                    <span className="text-gold line-through opacity-70">{formatBRL(calculo.freteBase)}</span>
                  </div>
                ) : calculo.freteIsento ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-text-secondary">
                      Frete — <span className="text-gold uppercase tracking-wider text-[10px]">Isento (CIF)</span>
                    </span>
                    <span className="text-gold">{formatBRL(calculo.freteBase)}</span>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between">
                    <span className="text-text-secondary">
                      Frete FOB
                    </span>
                    <span className="text-text-primary">+ {formatBRL(calculo.freteValor ?? 0)}</span>
                  </div>
                )}
                {calculo.freteIsento && (
                  <p className="text-[10px] text-text-muted">
                    {calculo.freteGratisNegociado
                      ? "Frete removido na negociação master."
                      : "Frete não cobrado — Fetély entrega por conta da casa."}
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-text-secondary">
                  {calculo.aplicouPix ? "Valor com PIX" : "Valor final"}
                </span>
                <span className="font-display text-2xl sm:text-3xl text-gold">
                  {formatBRL(calculo.total)}
                </span>
              </div>
              {calculo.aplicouPix && (
                <div className="flex items-baseline justify-between text-xs text-text-muted">
                  <span>Sem PIX</span>
                  <span>{formatBRL(calculo.totalSemPix)}</span>
                </div>
              )}
            </div>


            <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
              <Truck className="h-4 w-4 text-gold" />
              {freteEfetivo === "CIF" ? (
                <span>
                  Frete <strong className="text-gold">CIF</strong>
                  {premissas?.freteFixo ? " — acordado (sempre)" : " — Fetély entrega ✨"}
                </span>
              ) : (
                <span>
                  Frete <strong>FOB</strong>
                  {premissas?.freteFixo ? " — acordado (sempre)" : " — por conta do lojista"}
                </span>
              )}
            </div>

            {prox && (
              <div className="relative overflow-hidden rounded-lg border border-gold/40 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-3 shadow-[0_0_20px_-8px_hsl(var(--gold)/0.5)]">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.15em] text-gold mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                    Próxima: {prox.nome}
                  </span>
                  <span className="text-text-primary font-bold tracking-normal normal-case text-sm">
                    {formatBRL(bruto)} <span className="text-text-muted font-normal">/ {formatBRL(prox.valorMin)}</span>
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-surface-2 overflow-hidden ring-1 ring-gold/20">
                  <div
                    className="h-full bg-gradient-to-r from-gold/70 via-gold to-gold/90 transition-all shadow-[0_0_12px_hsl(var(--gold)/0.7)]"
                    style={{
                      width: `${Math.min(100, (bruto / prox.valorMin) * 100)}%`,
                    }}
                  />
                </div>
                {faltaProx > 0 && faltaProx <= prox.valorMin * 0.1 && (
                  <p className="mt-2.5 text-sm font-medium text-gold">
                    ✦ Adicione <strong>{formatBRL(faltaProx)}</strong> e ganhe mais{" "}
                    <strong>{prox.descontoCelebra - faixa.descontoCelebra}% de desconto</strong>
                    {prox.frete === "CIF" && faixa.frete === "FOB" ? " + frete grátis" : ""}.
                  </p>
                )}
                {faltaProx > prox.valorMin * 0.1 && (
                  <p className="mt-2 text-xs text-text-muted">
                    Faltam <strong className="text-gold">{formatBRL(faltaProx)}</strong> para a próxima faixa.
                  </p>
                )}
              </div>
            )}
            {!prox && (
              <p className="text-xs text-gold text-center">
                ✦ Você está na faixa máxima.
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-2">
            <div className="text-sm text-stock-out">
              Pedido mínimo: {formatBRL(pedidoMinimo)}
            </div>
            <p className="text-xs text-text-muted mt-1">
              Adicione mais produtos para prosseguir.
            </p>
          </div>
        )}
      </div>

      {/* Seletor de pagamento */}
      {faixa && (
        <div className="rounded-lg gold-border bg-surface p-4 sm:p-5 space-y-3">
          <h3 className="text-xs uppercase tracking-[0.2em] text-gold-muted">
            Forma de pagamento
          </h3>
          <PaymentSelector
            condicoes={condicoesDisponiveis}
            todas={ativo && liberarTodasCondicoes ? CONDICOES_PAGAMENTO : null}
            selectedId={condicao?.id ?? null}
            onSelect={setCondicaoSelecionadaId}
          />
        </div>
      )}

      {/* Modo negociação ativo */}
      {ativo && faixa && (
        <div className="rounded-lg border border-gold/50 bg-gold/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gold">
              <Lock className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">
                Modo negociação ativo
              </span>
            </div>
            <button
              onClick={desativar}
              className="text-text-muted hover:text-stock-out"
              aria-label="Desativar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
              Desconto adicional ({descontoPct}%) — máx. {DESCONTO_MASTER_MAX}%
            </label>
            <input
              type="range"
              min={0}
              max={DESCONTO_MASTER_MAX}
              step={0.5}
              value={descontoPct}
              onChange={(e) => setDescontoPct(parseFloat(e.target.value))}
              className="w-full accent-[var(--gold)]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
              Justificativa {descontoPct > 0 && <span className="text-stock-out">*</span>}
            </label>
            <select
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {JUSTIFICATIVAS_NEGOCIACAO.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          {bruto >= 12000 && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={usarReservada}
                onChange={(e) => setUsarReservada(e.target.checked)}
                className="mt-0.5 accent-[var(--gold)]"
              />
              <span>
                Aplicar <strong className="text-gold">Faixa 5 — Reservada</strong> (25% fixo)
                <span className="block text-[11px] text-text-muted">
                  Sem bônus PIX nesta faixa.
                </span>
              </span>
            </label>
          )}

          <div className="rounded-md border border-gold/30 bg-background/30 p-3 space-y-2.5">
            <div className="text-[10px] uppercase tracking-wider text-gold-muted">
              Benefícios extras
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={freteGratis}
                onChange={(e) => setFreteGratis(e.target.checked)}
                className="mt-0.5 accent-[var(--gold)]"
              />
              <span>
                <strong className="text-gold">Frete grátis</strong> (CIF) — Fetély entrega
                <span className="block text-[11px] text-text-muted">
                  Força frete CIF mesmo nas faixas FOB.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={liberarTodasCondicoes}
                onChange={(e) => setLiberarTodasCondicoes(e.target.checked)}
                className="mt-0.5 accent-[var(--gold)]"
              />
              <span>
                <strong className="text-gold">Liberar todas as formas de pagamento</strong>
                <span className="block text-[11px] text-text-muted">
                  Ignora restrições de faixa e valor mínimo das condições.
                </span>
              </span>
            </label>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
              Observação interna (não vai no resumo do cliente)
            </label>
            <textarea
              value={observacaoInterna}
              onChange={(e) => setObservacaoInterna(e.target.value)}
              rows={2}
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
      )}

      {/* Botão modo negociação */}
      {!ativo && (
        <button
          onClick={() => setShowSenha(true)}
          className="w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-text-muted hover:text-gold py-2"
        >
          <Settings2 className="h-3 w-3" /> Modo Negociação
        </button>
      )}

      {showSenha && <MasterPasswordModal onClose={() => setShowSenha(false)} />}
    </div>
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

