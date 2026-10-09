// CRM Parte 4 — a Rodada: a gestão atualiza em sequência as oportunidades de um representante (ou de todos).
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Copy, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fmtData, hojeISO, diasEntre, resumoComercial, type CrmLead, type CrmRound, type RoundDetalhe } from "@/lib/crm";
import {
  FASES, DESCOBERTAS, faltaParaAvancar, proximaFase, sugerirTarefa, pesoFila, fichaCompleta, addDias,
  type Fase, type Sugestao,
} from "@/lib/crmFases";
import {
  type Ctx, type Patch, infoLead, nomeRep, Chip, Selo, FaseChip, CamposFase, NaoVaiAgora, ProximaAtividade, Marca,
  aplicarAtualizacao, textoTarefa, resumoFicha,
} from "./shared";

export type PresetRodada = "segunda" | "sexta" | null;
const TODOS = "__todos";
const FASES_RODADA: Fase[] = ["0", "1", "2", "3", "4", "5", "6"];

/** Filtros dos lembretes de segunda e sexta. */
export function filtraPreset(ctx: Ctx, l: CrmLead, preset: PresetRodada, hoje = hojeISO()): boolean {
  if (!preset) return true;
  const i = infoLead(ctx, l, hoje);
  if (preset === "segunda") {
    const ultVisita = ctx.atividades.filter((a) => a.lead_id === l.id && a.tipo === "Visita").map((a) => a.data).sort().pop();
    const semVisita30 = !ultVisita || diasEntre(ultVisita, hoje) > 30;
    const recompra = i.fase === "6" && !!l.pago_em && diasEntre(l.pago_em, hoje) >= 30;
    return i.nivel === "SQL" || (i.classe === "A" && semVisita30) || recompra;
  }
  return (i.fase === "2" && !fichaCompleta(l))
    || (i.fase === "3" && !!l.catalogo_enviado_em && diasEntre(l.catalogo_enviado_em, hoje) >= 2 && !l.toque_d2_feito)
    || (i.fase === "4" && !l.valor_estimado)
    || (i.fase === "X" && !l.motivo_nao_agora);
}

export function Rodada({ ctx, preset: presetInicial, onClose }: { ctx: Ctx; preset: PresetRodada; onClose: () => void }) {
  const hoje = hojeISO();
  const [rodada, setRodada] = useState<CrmRound | null>(null);
  const [concluida, setConcluida] = useState(false);
  const [rep, setRep] = useState<string>(TODOS);
  const [soAlerta, setSoAlerta] = useState(false);
  const [soA, setSoA] = useState(false);
  const [faseF, setFaseF] = useState<string>("todas");
  const [preset, setPreset] = useState<PresetRodada>(presetInicial);
  const [iniciando, setIniciando] = useState(false);
  const leadMap = useMemo(() => new Map(ctx.leads.map((l) => [l.id, l])), [ctx.leads]);

  const abertos = (repId: string | null) => ctx.leads.filter((l) => {
    const f = infoLead(ctx, l, hoje).fase;
    return (preset ? true : f !== "X") && (!repId || l.representante_id === repId);
  });
  const emAndamento = ctx.rodadas.filter((r) => !r.concluida_em && r.feita_por === ctx.userId);

  async function iniciar() {
    const repId = rep === TODOS ? null : rep;
    const fila = abertos(repId).filter((l) => {
      const i = infoLead(ctx, l, hoje);
      if (!filtraPreset(ctx, l, preset, hoje)) return false;
      if (soAlerta && !i.alertas.length) return false;
      if (soA && i.classe !== "A") return false;
      if (faseF !== "todas" && i.fase !== faseF) return false;
      return true;
    }).sort((a, b) => {
      if (!repId) { const r = nomeRep(ctx, a.representante_id).localeCompare(nomeRep(ctx, b.representante_id)); if (r) return r; }
      const ia = infoLead(ctx, a, hoje), ib = infoLead(ctx, b, hoje);
      const p = pesoFila(ia.alertas.length > 0, ia.prio) - pesoFila(ib.alertas.length > 0, ib.prio);
      if (p) return p;
      return (a.rede_grupo ?? "~").localeCompare(b.rede_grupo ?? "~") || a.nome_conta.localeCompare(b.nome_conta);
    });
    if (!fila.length) return toast.error("Nenhuma oportunidade com esses filtros.");
    setIniciando(true);
    const { data, error } = await supabase.from("crm_rounds").insert({
      representante_id: repId, feita_por: ctx.userId, total_leads: fila.length, lead_ids: fila.map((l) => l.id),
      filtros: { soAlerta, soA, fase: faseF, preset },
    }).select().single();
    setIniciando(false);
    if (error) return toast.error(`Não foi possível iniciar: ${error.message}`);
    setRodada(data as unknown as CrmRound);
  }

  async function concluir() {
    if (!rodada) return;
    const { data, error } = await supabase.from("crm_rounds").update({ concluida_em: new Date().toISOString() }).eq("id", rodada.id).select().single();
    if (error) return toast.error(error.message);
    setRodada(data as unknown as CrmRound); setConcluida(true);
    await ctx.recarregar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl h-[96vh] sm:h-[92vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>Rodada{rodada ? ` — ${rodada.representante_id ? nomeRep(ctx, rodada.representante_id) : "todos os representantes"}` : ""}</DialogTitle>
          <DialogDescription>{!rodada ? "Escolha quem você vai atualizar agora." : concluida ? "Resumo da rodada." : "Toque numa linha para atualizar. Salvar é por linha: se sair, a rodada continua de onde parou."}</DialogDescription>
        </DialogHeader>

        {!rodada && (
          <div className="space-y-4">
            {emAndamento.length > 0 && (
              <div className="rounded-md border border-gold/50 p-3 space-y-2">
                <div className="text-sm font-medium text-text-primary">Rodadas em andamento</div>
                {emAndamento.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{r.representante_id ? nomeRep(ctx, r.representante_id) : "Todos"} · {new Date(r.iniciada_em).toLocaleDateString("pt-BR")} · {r.salvos.length} de {r.total_leads}</span>
                    <Button size="sm" onClick={() => setRodada(r)}>Retomar</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <Label>Representante</Label>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {[{ id: TODOS, nome: "Todos os representantes" }, ...ctx.representantes].map((r) => {
                  const ls = abertos(r.id === TODOS ? null : r.id);
                  const al = ls.filter((l) => infoLead(ctx, l, hoje).alertas.length).length;
                  return (
                    <button key={r.id} type="button" onClick={() => setRep(r.id)}
                      className={cn("w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left", rep === r.id && "bg-gold/10")}>
                      <span className={cn(rep === r.id && "font-medium text-text-primary")}>{r.nome}</span>
                      <span className="text-xs text-text-secondary whitespace-nowrap">{ls.length} abertas{al > 0 && <span className="text-destructive"> · {al} com alerta</span>}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip ativo={soAlerta} onClick={() => setSoAlerta(!soAlerta)}>Só com alerta</Chip>
              <Chip ativo={soA} onClick={() => setSoA(!soA)}>Só classe A</Chip>
              <Select value={faseF} onValueChange={setFaseF}>
                <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todas">Todas as fases</SelectItem>{FASES_RODADA.map((f) => <SelectItem key={f} value={f}>{f} · {FASES[f].nome}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={preset ?? "nenhum"} onValueChange={(v) => setPreset(v === "nenhum" ? null : (v as PresetRodada))}>
                <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem roteiro</SelectItem>
                  <SelectItem value="segunda">Segunda: montar a rota</SelectItem>
                  <SelectItem value="sexta">Sexta: fechar as devolutivas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-11" disabled={iniciando} onClick={() => void iniciar()}>{iniciando ? "Iniciando…" : "Começar a rodada"}</Button>
          </div>
        )}

        {rodada && !concluida && <Fila ctx={ctx} rodada={rodada} setRodada={setRodada} leadMap={leadMap} onConcluir={concluir} />}
        {rodada && concluida && <Resumo ctx={ctx} rodada={rodada} leadMap={leadMap} onFechar={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Fila({ ctx, rodada, setRodada, leadMap, onConcluir }: { ctx: Ctx; rodada: CrmRound; setRodada: (r: CrmRound) => void; leadMap: Map<string, CrmLead>; onConcluir: () => void }) {
  const hoje = hojeISO();
  const ordem = [...rodada.lead_ids.filter((id) => !rodada.pulados.includes(id) || rodada.salvos.includes(id)), ...rodada.pulados.filter((id) => !rodada.salvos.includes(id))]
    .filter((id) => leadMap.has(id));
  const primeiraPendente = ordem.find((id) => !rodada.salvos.includes(id)) ?? null;
  const [aberta, setAberta] = useState<string | null>(primeiraPendente);
  const salvos = rodada.salvos.length;
  let repAnterior = "";

  async function registrar(leadId: string, det: RoundDetalhe | null) {
    const salvosN = det ? [...new Set([...rodada.salvos, leadId])] : rodada.salvos;
    const pulados = det ? rodada.pulados.filter((x) => x !== leadId) : [...new Set([...rodada.pulados, leadId])];
    const detalhes = det ? [...rodada.detalhes, det] : rodada.detalhes;
    const cont = (a: RoundDetalhe["acao"]) => detalhes.filter((x) => x.acao === a).length;
    const { data, error } = await supabase.from("crm_rounds").update({
      salvos: salvosN, pulados, detalhes: detalhes as never, atualizados: salvosN.length,
      avancos: cont("avanco"), sem_novidade: cont("sem_novidade"), encerrados: cont("encerrado"),
    }).eq("id", rodada.id).select().single();
    if (error) { toast.error(error.message); return; }
    const r = data as unknown as CrmRound;
    setRodada(r);
    const prox = ordem.find((id) => id !== leadId && !r.salvos.includes(id) && (!det ? true : true) && !(id === leadId)) ?? null;
    setAberta(prox);
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 bg-background pb-2 space-y-1">
        <div className="flex items-center justify-between text-sm"><span className="font-medium text-text-primary">{salvos} de {rodada.total_leads} atualizadas</span>
          <Button size="sm" variant={salvos >= ordem.length ? "default" : "outline"} onClick={onConcluir}>Concluir rodada</Button></div>
        <Progress value={(salvos / Math.max(1, rodada.total_leads)) * 100} />
      </div>
      <div className="space-y-1.5">
        {ordem.map((id) => {
          const l = leadMap.get(id)!;
          const i = infoLead(ctx, l, hoje);
          const salvo = rodada.salvos.includes(id), pulado = rodada.pulados.includes(id) && !salvo;
          const cab = !rodada.representante_id && l.representante_id !== repAnterior ? nomeRep(ctx, l.representante_id) : null;
          repAnterior = l.representante_id;
          return (
            <div key={id}>
              {cab && <div className="pt-3 pb-1 text-xs uppercase tracking-wide text-gold">{cab}</div>}
              <div className={cn("rounded-md border", salvo ? "border-green-600/40 bg-green-600/5" : "border-border", aberta === id && "ring-1 ring-gold")}>
                <button type="button" className="w-full flex items-center gap-2 px-3 py-2.5 text-left" onClick={() => setAberta(aberta === id ? null : id)}>
                  {salvo ? <Check className="h-4 w-4 text-green-600 shrink-0" /> : aberta === id ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-text-primary truncate">{l.nome_conta}</span>
                      <Selo tom="gold">{i.classe}</Selo><FaseChip fase={i.fase} />
                      {l.rede_grupo && <Selo>rede {l.rede_grupo}</Selo>}
                      {pulado && <Selo>pulada</Selo>}
                    </div>
                    <div className="text-xs text-text-secondary truncate">{textoTarefa(i.tarefa)}</div>
                  </div>
                  {i.alertas.length > 0 && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                </button>
                {aberta === id && !salvo && (
                  <LinhaRodada key={id} ctx={ctx} lead={l} rodada={rodada} onSalvo={(det) => registrar(id, det)} onPular={() => registrar(id, null)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LinhaRodada({ ctx, lead, rodada, onSalvo, onPular }: { ctx: Ctx; lead: CrmLead; rodada: CrmRound; onSalvo: (d: RoundDetalhe) => Promise<void>; onPular: () => Promise<void> }) {
  const hoje = hojeISO();
  const [d, setD] = useState<Patch>({});
  const ef = { ...lead, ...d } as CrmLead;
  const i = infoLead(ctx, lead, hoje);
  const fase = i.fase ?? "0";
  const [acaoTarefa, setAcaoTarefa] = useState<"Feita" | "Cancelada" | "remarcar" | null>(null);
  const [remarcar, setRemarcar] = useState(addDias(hoje, 7));
  const [modo, setModo] = useState<"avancou" | "sem" | "nao">("sem");
  const [desc, setDesc] = useState<string[]>([]);
  const [descTexto, setDescTexto] = useState("");
  const [prox, setProx] = useState<Sugestao>(() => sugerirTarefa(fase, lead, hoje));
  const [tocado, setTocado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const set = (p: Patch) => setD((x) => ({ ...x, ...p }));
  const temPedido = resumoComercial(ctx.comercial, ef.cliente_id).pedidos.length > 0;
  const pf = proximaFase(fase);
  const falta = modo === "avancou" ? (pf ? faltaParaAvancar(fase, ef, { temPedido }) : ["fase final"]) : modo === "nao" ? faltaParaAvancar("X", ef, { temPedido }) : [];
  const usaRemarcar = acaoTarefa === "remarcar" && modo === "sem";

  function toggleDesc(c: string) {
    const on = desc.includes(c);
    setDesc(on ? desc.filter((x) => x !== c) : [...desc, c]);
    if (on) return;
    if (c === "Pediu preço") set({ em_que_pe_ficou: "Pediu preço" });
    if (c === "Quer amostra") set({ amostra: true });
    if (c === "Vai ao comitê") set({ comite: true });
    if (c === "Abriu loja nova") set({ numero_lojas: (lead.numero_lojas ?? 0) + 1 });
  }

  async function salvar(atalho = false) {
    setSalvando(true);
    try {
      const novaFase = atalho ? null : modo === "avancou" ? pf : modo === "nao" ? "X" : null;
      const descobertas = atalho ? [] : desc;
      const novoDesc = descobertas.length || descTexto.trim()
        ? [lead.descobertas, `${new Date().toLocaleDateString("pt-BR")}: ${[...descobertas, descTexto.trim()].filter(Boolean).join(" · ")}`].filter(Boolean).join("\n")
        : undefined;
      const patch: Patch = atalho ? {} : { ...d, ...(novoDesc ? { descobertas: novoDesc } : {}) };
      const temTarefa = !!i.tarefa;
      const tarefaAtual = atalho ? (temTarefa ? { remarcar: addDias(hoje, 7) } : undefined)
        : usaRemarcar ? { remarcar } : modo === "nao" ? "Cancelada" as const : (acaoTarefa === "Cancelada" ? "Cancelada" as const : "Feita" as const);
      const proxima = atalho ? (temTarefa ? null : { tipo: "Ligar" as const, vence_em: addDias(hoje, 7), responsavel: "Representante" as const })
        : usaRemarcar || modo === "nao" ? null : (modo === "avancou" && pf && !tocado ? sugerirTarefa(pf, ef, hoje) : prox);
      const partes = [
        i.tarefa && (atalho ? `Tarefa remarcada +7d` : usaRemarcar ? `Tarefa remarcada para ${fmtData(remarcar)}` : acaoTarefa ? `Tarefa ${i.tarefa.tipo}: ${acaoTarefa === "Feita" ? "feita" : "não feita"}` : null),
        novaFase === "X" ? `Não vai agora: ${ef.motivo_nao_agora} · retomar ${fmtData(ef.retomar_em)}` : novaFase ? `Avançou: ${FASES[fase].nome} → ${FASES[novaFase].nome}` : "Sem novidade",
        fase === "2" && novaFase ? resumoFicha(ef) : null,
        descobertas.length || descTexto.trim() ? `Descobriu: ${[...descobertas, descTexto.trim()].filter(Boolean).join(", ")}` : null,
        proxima ? `Próxima: ${proxima.tipo} ${fmtData(proxima.vence_em)} (${proxima.responsavel})` : null,
      ].filter(Boolean).join(" · ");
      await aplicarAtualizacao(ctx, lead, {
        patch, novaFase, tarefaAtual, proxima,
        atividade: { tipo: "Ligação", resultado: `Rodada — ${partes}`, round_id: rodada.id },
      });
      await onSalvo({
        lead_id: lead.id, loja: lead.nome_conta, rep_id: lead.representante_id,
        acao: novaFase === "X" ? "encerrado" : novaFase ? "avanco" : "sem_novidade",
        de: FASES[fase].nome, para: novaFase ? FASES[novaFase].nome : undefined,
        motivo: novaFase === "X" ? ef.motivo_nao_agora ?? undefined : undefined, descobertas: [...descobertas, descTexto.trim()].filter(Boolean),
      });
      await ctx.recarregar();
    } catch (e) {
      toast.error(`Não foi possível salvar: ${(e as Error).message}`);
    } finally { setSalvando(false); }
  }

  const bloco = "text-[11px] uppercase tracking-wide text-text-secondary";
  return (
    <div className="border-t border-border px-3 py-3 space-y-4">
      <div className="space-y-1.5">
        <div className={bloco}>1. O que foi feito</div>
        {i.tarefa ? (
          <>
            <div className="text-sm text-text-primary">{textoTarefa(i.tarefa)}</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip ativo={acaoTarefa === "Feita"} onClick={() => setAcaoTarefa("Feita")}>Feita</Chip>
              <Chip ativo={acaoTarefa === "Cancelada"} onClick={() => setAcaoTarefa("Cancelada")}>Não feita</Chip>
              <Chip ativo={acaoTarefa === "remarcar"} onClick={() => setAcaoTarefa("remarcar")}>Remarcar</Chip>
              {acaoTarefa === "remarcar" && <Input type="date" className="w-40 h-9" value={remarcar} onChange={(e) => setRemarcar(e.target.value)} />}
            </div>
          </>
        ) : <div className="text-xs text-text-secondary">Sem tarefa aberta.</div>}
        {fase === "1" && <Marca checked={ef.visita_confirmada} onChange={(v) => set({ visita_confirmada: v })}>Confirmado na véspera</Marca>}
        {fase === "3" && (
          <div>
            <Marca checked={!!ef.catalogo_enviado_em} onChange={(v) => set({ catalogo_enviado_em: v ? hoje : null })}>Catálogo enviado</Marca>
            <Marca checked={ef.toque_d2_feito} onChange={(v) => set({ toque_d2_feito: v })}>Toque D+2</Marca>
            <Marca checked={ef.toque_d5_feito} onChange={(v) => set({ toque_d5_feito: v })}>Toque D+5</Marca>
          </div>
        )}
        {fase === "4" && (
          <div>
            <Marca checked={ef.amostra} onChange={(v) => set({ amostra: v })}>Amostra</Marca>
            <Marca checked={ef.cadastro_fornecedor} onChange={(v) => set({ cadastro_fornecedor: v })}>Cadastro de fornecedor</Marca>
            <Marca checked={ef.comite} onChange={(v) => set({ comite: v })}>Comitê</Marca>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className={bloco}>2. O que avançou</div>
        <div className="grid grid-cols-3 gap-1.5">
          {([["avancou", "Avançou"], ["sem", "Sem novidade"], ["nao", "Não vai agora"]] as const).map(([k, r]) => (
            <Button key={k} type="button" variant={modo === k ? "default" : "outline"} className="h-11 text-xs sm:text-sm px-1" onClick={() => setModo(k)}>{r}</Button>
          ))}
        </div>
        {modo === "avancou" && pf && (
          <div className="rounded-md border border-border p-2 space-y-2">
            <div className="text-xs text-text-secondary">Avança quando: <span className="text-text-primary">{FASES[fase].avanco}</span> → {FASES[pf].nome}</div>
            {["0", "2", "3", "4", "5"].includes(fase) && <CamposFase ctx={ctx} lead={ef} fase={fase} set={set} />}
          </div>
        )}
        {modo === "avancou" && !pf && <div className="text-xs text-text-secondary">Pós-venda é a fase final.</div>}
        {modo === "nao" && <NaoVaiAgora lead={ef} set={set} />}
        {falta.length > 0 && <div className="text-xs text-destructive">Falta: {falta.join(", ")}</div>}
      </div>

      <div className="space-y-1.5">
        <div className={bloco}>3. O que descobriu (opcional)</div>
        <div className="flex flex-wrap gap-1.5">{DESCOBERTAS.map((c) => <Chip key={c} ativo={desc.includes(c)} onClick={() => toggleDesc(c)}>{c}</Chip>)}</div>
        {desc.includes("Pertence a rede") && <Input placeholder="Qual rede / central de compras?" value={ef.rede_grupo ?? ""} onChange={(e) => set({ rede_grupo: e.target.value || null })} />}
        <Input placeholder="Anotação curta" value={descTexto} onChange={(e) => setDescTexto(e.target.value)} maxLength={200} />
      </div>

      {modo !== "nao" && !usaRemarcar && (
        <ProximaAtividade titulo="4. Próxima atividade" valor={modo === "avancou" && pf && !tocado ? sugerirTarefa(pf, ef, hoje) : prox} onChange={(s) => { setProx(s); setTocado(true); }} />
      )}

      <div className="sticky bottom-0 bg-background pt-2 pb-1 space-y-2 border-t border-border">
        <div className="flex gap-2">
          <Button className="flex-1 h-11" disabled={salvando || falta.length > 0} onClick={() => void salvar()}>{salvando ? "Salvando…" : "Salvar e próxima"}</Button>
          <Button variant="outline" className="h-11" disabled={salvando} onClick={() => void onPular()}>Pular</Button>
        </div>
        <button type="button" disabled={salvando} className="w-full text-xs text-gold underline" onClick={() => void salvar(true)}>Sem novidade + mesma tarefa daqui a 7 dias</button>
      </div>
    </div>
  );
}

function Resumo({ ctx, rodada, leadMap, onFechar }: { ctx: Ctx; rodada: CrmRound; leadMap: Map<string, CrmLead>; onFechar: () => void }) {
  const hoje = hojeISO();
  const fim = addDias(hoje, 7);
  const det = rodada.detalhes;
  const avancos = det.filter((d) => d.acao === "avanco");
  const encerrados = det.filter((d) => d.acao === "encerrado");
  const descobertas = det.filter((d) => d.descobertas?.length);
  const semana = ctx.tarefas.filter((t) => t.status === "Aberta" && rodada.lead_ids.includes(t.lead_id) && t.vence_em <= fim)
    .sort((a, b) => a.vence_em.localeCompare(b.vence_em));
  const reps = [...new Set(rodada.lead_ids.map((id) => leadMap.get(id)?.representante_id).filter(Boolean))] as string[];

  function textoRep(repId: string, numeros: boolean) {
    const minhas = semana.filter((t) => t.representante_id === repId && t.responsavel === "Representante");
    const meus = det.filter((d) => d.rep_id === repId);
    const linhas = [
      `Oi ${nomeRep(ctx, repId).split(" ")[0]}! Resumo da nossa rodada de ${new Date(rodada.iniciada_em).toLocaleDateString("pt-BR")}:`,
      ...(numeros ? [`Atualizadas ${meus.length} · Avanços ${meus.filter((d) => d.acao === "avanco").length} · Sem novidade ${meus.filter((d) => d.acao === "sem_novidade").length} · Encerradas ${meus.filter((d) => d.acao === "encerrado").length}`] : []),
      ...meus.filter((d) => d.acao === "avanco").map((d) => `✅ ${d.loja}: ${d.de} → ${d.para}`),
      "", "Suas próximas atividades:",
      ...(minhas.length ? minhas.map((t) => `• ${fmtData(t.vence_em)} — ${leadMap.get(t.lead_id)?.nome_conta}: ${t.tipo}${t.descricao ? ` (${t.descricao})` : ""}`) : ["• nenhuma nesta semana"]),
    ];
    return linhas.join("\n");
  }
  const copiar = (t: string) => { void navigator.clipboard.writeText(t); toast.success("Copiado"); };

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[["Atualizadas", `${rodada.atualizados} de ${rodada.total_leads}`], ["Avanços", avancos.length], ["Sem novidade", rodada.sem_novidade], ["Encerradas", encerrados.length]].map(([k, v]) => (
          <div key={k as string} className="rounded-md border border-border p-3"><div className="text-xs text-text-secondary">{k}</div><div className="text-lg font-display text-text-primary">{v}</div></div>
        ))}
      </div>
      {avancos.length > 0 && <div><div className="font-medium text-text-primary mb-1">Avanços</div>{avancos.map((d, i) => <div key={i} className="text-xs">{d.loja}: {d.de} → {d.para}</div>)}</div>}
      {encerrados.length > 0 && <div><div className="font-medium text-text-primary mb-1">Encerradas</div>{encerrados.map((d, i) => <div key={i} className="text-xs">{d.loja}: {d.motivo}</div>)}</div>}
      {descobertas.length > 0 && <div><div className="font-medium text-text-primary mb-1">Novas descobertas</div>{descobertas.map((d, i) => <div key={i} className="text-xs">{d.loja}: {d.descobertas!.join(", ")}</div>)}</div>}
      <div>
        <div className="font-medium text-text-primary mb-1">Próximas atividades da semana</div>
        {(["Representante", "Gestão"] as const).map((r) => (
          <div key={r} className="mb-2"><div className="text-xs text-gold">{r}</div>
            {semana.filter((t) => t.responsavel === r).map((t) => <div key={t.id} className="text-xs">{fmtData(t.vence_em)} · {leadMap.get(t.lead_id)?.nome_conta} · {t.tipo}</div>)}
            {!semana.some((t) => t.responsavel === r) && <div className="text-xs text-text-secondary">Nenhuma.</div>}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {reps.map((r) => (
          <div key={r} className="flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-40">{nomeRep(ctx, r)}</span>
            <Button size="sm" variant="outline" onClick={() => copiar(textoRep(r, false))}><Copy className="h-4 w-4" /> Copiar resumo para WhatsApp</Button>
            <Button size="sm" variant="outline" onClick={() => copiar(textoRep(r, true))}><Copy className="h-4 w-4" /> Copiar para a Cintia</Button>
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={onFechar}>Fechar</Button>
    </div>
  );
}
