import { useEffect, useMemo, useState } from "react";
import { Lock, Settings2, Sparkles, Truck, X } from "lucide-react";
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
    setDescontoPct,
    setJustificativa,
    setObservacaoInterna,
    setUsarReservada,
    setCondicaoSelecionadaId,
    desativar,
  } = useNegotiation();

  const [showSenha, setShowSenha] = useState(false);

  // Faixa atual
  const faixa = useMemo(
    () => detectarFaixa(bruto, ativo && usarReservada),
    [bruto, ativo, usarReservada],
  );

  // Condições disponíveis
  const condicoesDisponiveis = useMemo<CondicaoPagamento[]>(() => {
    if (!faixa) return [];
    if (ativo) return CONDICOES_PAGAMENTO; // master libera todas
    return CONDICOES_PAGAMENTO.filter(
      (c) => faixa.condicoesDisponiveis.includes(c.id) && bruto >= c.valorMinimo,
    );
  }, [faixa, ativo, bruto]);

  // Condição selecionada (revalida quando faixa muda)
  const condicao = useMemo(
    () => condicoesDisponiveis.find((c) => c.id === condicaoSelecionadaId) ?? null,
    [condicoesDisponiveis, condicaoSelecionadaId],
  );

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
      }),
    [bruto, ativo, usarReservada, descontoPct, condicao],
  );

  const negociacaoSemJustificativa =
    ativo && descontoPct > 0 && !justificativa;

  const podeFinalizar =
    !!faixa && !!condicao && !negociacaoSemJustificativa;

  const motivoBloqueio = !faixa
    ? `Pedido mínimo: ${formatBRL(2500)}. Adicione mais produtos.`
    : !condicao
      ? "Selecione uma condição de pagamento."
      : negociacaoSemJustificativa
        ? "Selecione uma justificativa para o desconto adicional."
        : null;

  useEffect(() => {
    onChange({ calculo, condicao, podeFinalizar, motivoBloqueio });
  }, [calculo, condicao, podeFinalizar, motivoBloqueio, onChange]);

  const prox = proximaFaixa(faixa);
  const faltaProx = prox ? prox.valorMin - bruto : 0;

  return (
    <div className="space-y-4">
      {/* Painel de faixa */}
      <div className="rounded-lg gold-border bg-surface p-5 space-y-3">
        {faixa ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
                  Faixa {faixa.id}
                </div>
                <div className="font-display text-2xl text-gold flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> {faixa.nome}
                </div>
              </div>
              {ativo && (
                <span className="rounded-full bg-gold/15 px-3 py-1 text-[10px] uppercase tracking-wider text-gold border border-gold/40">
                  Negociação
                </span>
              )}
            </div>

            <ul className="text-sm space-y-1.5">
              <Row label="Valor do pedido" value={formatBRL(bruto)} />
              <Row
                label={`Desconto Celebra (${faixa.descontoCelebra}%)`}
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
                  label={`Bônus PIX (${faixa.bonusPix}%)`}
                  value={`– ${formatBRL(calculo.bonusPixValor)}`}
                  accent
                />
              )}
            </ul>

            <div className="border-t border-border pt-3 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-text-secondary">
                  {calculo.aplicouPix ? "Valor com PIX" : "Valor final"}
                </span>
                <span className="font-display text-3xl text-gold">
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
              {faixa.frete === "CIF" ? (
                <span>
                  Frete <strong className="text-gold">CIF</strong> — Fetély entrega ✨
                </span>
              ) : (
                <span>
                  Frete <strong>FOB</strong> — por conta do lojista
                </span>
              )}
            </div>

            {prox && (
              <div>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted mb-1">
                  <span>Próxima: {prox.nome}</span>
                  <span>
                    {formatBRL(bruto)} / {formatBRL(prox.valorMin)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-gold transition-all"
                    style={{
                      width: `${Math.min(100, (bruto / prox.valorMin) * 100)}%`,
                    }}
                  />
                </div>
                {faltaProx > 0 && faltaProx <= prox.valorMin * 0.1 && (
                  <p className="mt-2 text-xs text-gold">
                    Adicione {formatBRL(faltaProx)} e ganhe mais{" "}
                    {prox.descontoCelebra - faixa.descontoCelebra}% de desconto
                    {prox.frete === "CIF" && faixa.frete === "FOB" ? " + frete grátis" : ""}.
                  </p>
                )}
                {faltaProx > prox.valorMin * 0.1 && (
                  <p className="mt-1.5 text-[11px] text-text-muted">
                    Faltam {formatBRL(faltaProx)} para a próxima faixa.
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
              Pedido mínimo: {formatBRL(2500)}
            </div>
            <p className="text-xs text-text-muted mt-1">
              Adicione mais produtos para prosseguir.
            </p>
          </div>
        )}
      </div>

      {/* Seletor de pagamento */}
      {faixa && (
        <div className="rounded-lg gold-border bg-surface p-5 space-y-3">
          <h3 className="text-xs uppercase tracking-[0.2em] text-gold-muted">
            Forma de pagamento
          </h3>
          <PaymentSelector
            condicoes={condicoesDisponiveis}
            todas={ativo ? CONDICOES_PAGAMENTO : null}
            selectedId={condicao?.id ?? null}
            onSelect={setCondicaoSelecionadaId}
          />
        </div>
      )}

      {/* Modo negociação ativo */}
      {ativo && faixa && (
        <div className="rounded-lg border border-gold/50 bg-gold/5 p-5 space-y-4">
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
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bloqueado = tentativas >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bloqueado) return;
    setBusy(true);
    const r = await tryActivate(senha);
    setBusy(false);
    if (r.ok) onClose();
    else setErro(r.erro ?? "Erro");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg gold-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gold">
            <Lock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Modo Negociação</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              Senha master
            </span>
            <input
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro(null);
              }}
              disabled={bloqueado || busy}
              autoFocus
              className="mt-1 w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm"
            />
          </label>
          {erro && <p className="text-xs text-stock-out">{erro}</p>}
          <p className="text-[11px] text-text-muted">
            Tentativas: {tentativas} / 3 — senha padrão inicial: <code>fetely2025</code>
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border py-2 text-xs uppercase tracking-wider hover:border-gold/50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={bloqueado || busy || !senha}
              className="flex-1 rounded-md bg-gold py-2 text-xs uppercase tracking-[0.18em] text-background hover:bg-gold-light disabled:opacity-40"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
