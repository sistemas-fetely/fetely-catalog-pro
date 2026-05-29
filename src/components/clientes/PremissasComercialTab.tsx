// V13 — Aba "Premissas Comerciais" dentro do modal de cliente.
// Editável por admin/master · readonly para vendedor.

import { useMemo } from "react";
import { Award, AlertTriangle } from "lucide-react";
import {
  emptyPremissas,
  type Cliente,
  type PremissasComerciais,
} from "@/types/cliente";
import { useAuth } from "@/store/authStore";
import { CONDICOES_PAGAMENTO, FAIXAS, calcularPedido } from "@/lib/commercial";
import { formatBRL } from "@/lib/format";
import { statusPremissas, diasParaExpirar } from "@/lib/premissas";

export function PremissasComercialTab({
  cliente,
  onChange,
}: {
  cliente: Cliente;
  onChange: (patch: Partial<Cliente>) => void;
}) {
  const roles = useAuth((s) => s.roles);
  const profile = useAuth((s) => s.profile);
  const podeEditar = roles.includes("admin") || roles.includes("master");
  const usuario = profile?.nome_completo ?? profile?.email ?? "—";

  const p: PremissasComerciais =
    cliente.premissasComerciais ?? emptyPremissas(usuario);

  const update = (patch: Partial<PremissasComerciais>) => {
    const novo: PremissasComerciais = {
      ...p,
      ...patch,
      atualizadoPor: usuario,
      atualizadoEm: new Date().toISOString(),
    };
    onChange({ premissasComerciais: novo });
  };

  const status = statusPremissas({ ...cliente, premissasComerciais: p });
  const dias = diasParaExpirar(p.vigenciaFim);

  // Preview do desconto sobre R$ 6.000
  const preview = useMemo(() => {
    return calcularPedido({ bruto: 6000, premissas: p.premissasAtivas ? p : null });
  }, [p]);

  const disabled = !podeEditar;

  return (
    <div className="space-y-4 pt-2">
      {!podeEditar && (
        <div className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
          <Award className="h-4 w-4" /> Condições homologadas — somente leitura para vendedor.
        </div>
      )}

      {status === "expirando" && dias !== null && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4" /> Premissas expiram em {dias} dia(s).
        </div>
      )}
      {status === "expirada" && (
        <div className="flex items-center gap-2 rounded-md border border-stock-out/50 bg-stock-out/10 px-3 py-2 text-xs text-stock-out">
          <AlertTriangle className="h-4 w-4" /> Premissas expiradas — regras gerais em vigor.
        </div>
      )}

      {/* BLOCO 1 — STATUS / VIGÊNCIA */}
      <Section title="Status & Vigência">
        <Toggle
          label="Premissas ativas"
          checked={p.premissasAtivas}
          disabled={disabled}
          onChange={(v) => update({ premissasAtivas: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vigência início">
            <input
              type="date"
              className="input"
              value={p.vigenciaInicio.slice(0, 10)}
              disabled={disabled}
              onChange={(e) => update({ vigenciaInicio: e.target.value })}
            />
          </Field>
          <Field label="Vigência fim (vazio = sem expiração)">
            <input
              type="date"
              className="input"
              value={p.vigenciaFim?.slice(0, 10) ?? ""}
              disabled={disabled}
              onChange={(e) => update({ vigenciaFim: e.target.value || null })}
            />
          </Field>
        </div>
        <p className="text-[11px] text-text-muted">
          Aprovado por <strong>{p.aprovadoPor}</strong> em{" "}
          {new Date(p.aprovadoEm).toLocaleDateString("pt-BR")}
        </p>
      </Section>

      {/* BLOCO 2 — DESCONTO HOMOLOGADO */}
      <Section title="Desconto homologado">
        <Toggle
          label="Aplicar desconto homologado"
          checked={p.temDescontoHomologado}
          disabled={disabled}
          onChange={(v) => update({ temDescontoHomologado: v })}
        />
        {p.temDescontoHomologado && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Percentual *">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={50}
                  className="input"
                  value={p.descontoHomologadoPercent}
                  disabled={disabled}
                  onChange={(e) =>
                    update({ descontoHomologadoPercent: parseFloat(e.target.value || "0") })
                  }
                />
              </Field>
              <Field label="Modalidade">
                <select
                  className="input"
                  value={p.descontoHomologadoSobrePos ? "acumula" : "substitui"}
                  disabled={disabled}
                  onChange={(e) =>
                    update({ descontoHomologadoSobrePos: e.target.value === "acumula" })
                  }
                >
                  <option value="substitui">Substitui desconto da faixa</option>
                  <option value="acumula">Acumula sobre faixa</option>
                </select>
              </Field>
            </div>
            <Field label="Observação">
              <input
                className="input"
                value={p.descontoHomologadoObs ?? ""}
                disabled={disabled}
                onChange={(e) => update({ descontoHomologadoObs: e.target.value })}
              />
            </Field>
            <div className="rounded-md bg-surface-2 border border-border p-3 text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-gold-muted">
                Preview · pedido de R$ 6.000
              </div>
              <div>
                Desconto: {preview.descontoCelebraPercentEfetivo}% →{" "}
                <strong className="text-gold">–{formatBRL(preview.descontoCelebraValor)}</strong>
              </div>
              <div>
                Valor final: <strong className="text-gold">{formatBRL(preview.total)}</strong>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* BLOCO 3 — FRETE */}
      <Section title="Frete">
        <Toggle
          label="Frete fixo (ignora faixa)"
          checked={p.freteFixo}
          disabled={disabled}
          onChange={(v) => update({ freteFixo: v })}
        />
        {p.freteFixo && (
          <>
            <Field label="Tipo de frete *">
              <select
                className="input"
                value={p.freteTipo ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  update({ freteTipo: (e.target.value || null) as "CIF" | "FOB" | null })
                }
              >
                <option value="">Selecione...</option>
                <option value="CIF">CIF — Fetély paga</option>
                <option value="FOB">FOB — Lojista paga</option>
              </select>
            </Field>
            <Field label="Observação">
              <input
                className="input"
                value={p.freteObs ?? ""}
                disabled={disabled}
                onChange={(e) => update({ freteObs: e.target.value })}
              />
            </Field>
          </>
        )}
      </Section>

      {/* BLOCO 4 — CONDIÇÕES PREFERENCIAIS */}
      <Section title="Condições de pagamento">
        <Toggle
          label="Limitar / pré-selecionar condições"
          checked={p.temCondicaoPreferencial}
          disabled={disabled}
          onChange={(v) => update({ temCondicaoPreferencial: v })}
        />
        {p.temCondicaoPreferencial && (
          <>
            <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-auto rounded-md border border-border bg-surface-2 p-2">
              {CONDICOES_PAGAMENTO.map((c) => {
                const checked = p.condicoesPermitidas.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:text-gold"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => {
                        const list = e.target.checked
                          ? [...p.condicoesPermitidas, c.id]
                          : p.condicoesPermitidas.filter((x) => x !== c.id);
                        update({ condicoesPermitidas: list });
                      }}
                    />
                    {c.descricao}
                  </label>
                );
              })}
            </div>
            <Field label="Condição preferencial (padrão no pedido)">
              <select
                className="input"
                value={p.condicaoPreferencialId ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  update({
                    condicaoPreferencialId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">— nenhuma —</option>
                {CONDICOES_PAGAMENTO.filter((c) =>
                  p.condicoesPermitidas.includes(c.id),
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Section>

      {/* BLOCO 5 — FAIXA FIXA */}
      <Section title="Faixa fixa">
        <Toggle
          label="Aplicar faixa fixa (ignora valor do pedido)"
          checked={p.temFaixaFixa}
          disabled={disabled}
          onChange={(v) => update({ temFaixaFixa: v })}
        />
        {p.temFaixaFixa && (
          <Field label="Faixa aplicada *">
            <select
              className="input"
              value={p.faixaFixaId ?? ""}
              disabled={disabled}
              onChange={(e) =>
                update({ faixaFixaId: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">Selecione...</option>
              {FAIXAS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({f.descontoCelebra}% · {f.frete})
                </option>
              ))}
            </select>
          </Field>
        )}
      </Section>

      {/* BLOCO 6 — PEDIDO MÍNIMO */}
      <Section title="Pedido mínimo personalizado">
        <Toggle
          label="Pedido mínimo diferente do padrão"
          checked={p.temPedidoMinimoPersonalizado}
          disabled={disabled}
          onChange={(v) => update({ temPedidoMinimoPersonalizado: v })}
        />
        {p.temPedidoMinimoPersonalizado && (
          <Field label="Valor mínimo (R$)">
            <input
              type="number"
              step="100"
              min={0}
              className="input"
              value={p.pedidoMinimoValor}
              disabled={disabled}
              onChange={(e) =>
                update({ pedidoMinimoValor: parseFloat(e.target.value || "0") })
              }
            />
          </Field>
        )}
      </Section>

      {/* BLOCO 7 — BÔNUS PIX */}
      <Section title="Bônus PIX personalizado">
        <Toggle
          label="Bônus PIX diferente do padrão da faixa"
          checked={p.bonusPixPersonalizado}
          disabled={disabled}
          onChange={(v) => update({ bonusPixPersonalizado: v })}
        />
        {p.bonusPixPersonalizado && (
          <Field label="Percentual bônus PIX">
            <input
              type="number"
              step="0.5"
              min={0}
              max={20}
              className="input"
              value={p.bonusPixPercent}
              disabled={disabled}
              onChange={(e) =>
                update({ bonusPixPercent: parseFloat(e.target.value || "0") })
              }
            />
          </Field>
        )}
      </Section>

      <p className="text-[11px] text-text-muted pt-2">
        Última atualização: {new Date(p.atualizadoEm).toLocaleDateString("pt-BR")} por{" "}
        {p.atualizadoPor}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--gold)]"
      />
      <span className={disabled ? "text-text-muted" : ""}>{label}</span>
    </label>
  );
}
