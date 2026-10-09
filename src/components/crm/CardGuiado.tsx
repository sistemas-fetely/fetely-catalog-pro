// CRM Parte 4 — card guiado: um passo por vez, só a fase atual.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fmtData, hojeISO, resumoComercial, type CrmLead, type CrmHist } from "@/lib/crm";
import { FASES, TRILHA, ESFORCO, faltaParaAvancar, proximaFase, sugerirTarefa, type Fase, type Sugestao } from "@/lib/crmFases";
import {
  type Ctx, type Patch, infoLead, nomeRep, Chip, Selo, TempDot, FraseBox, fraseDaFase, ProximaAtividade, CamposFase, NaoVaiAgora,
  aplicarAtualizacao, resumoFicha, textoTarefa, brl,
} from "./shared";

function registroDaFase(l: CrmLead, f: Fase): string {
  switch (f) {
    case "0": return l.visita_em ? `Visita agendada para ${new Date(l.visita_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : "—";
    case "1": return l.visita_confirmada ? "Confirmada na véspera" : "Sem confirmação registrada";
    case "2": return resumoFicha(l);
    case "3": return [l.catalogo_enviado_em && `Catálogo enviado em ${fmtData(l.catalogo_enviado_em)}`, l.toque_d2_feito && "toque D+2", l.toque_d5_feito && "toque D+5"].filter(Boolean).join(" · ") || "—";
    case "4": return [l.valor_estimado != null && `Valor estimado ${brl(l.valor_estimado)}`, l.amostra && "amostra", l.cadastro_fornecedor && "cadastro", l.comite && "comitê", l.comissao_registrada && "comissão registrada"].filter(Boolean).join(" · ") || "—";
    case "5": return [l.forma_pagamento, l.pago_em && `pago em ${fmtData(l.pago_em)}`].filter(Boolean).join(" · ") || "—";
    default: return "—";
  }
}

export function CardGuiado({ ctx, lead, onClose, onEditar, onVincular, comercial }: {
  ctx: Ctx; lead: CrmLead; onClose: () => void; onEditar: () => void; onVincular: () => void; comercial: React.ReactNode;
}) {
  const hoje = hojeISO();
  const [d, setD] = useState<Patch>({});
  const ef = useMemo(() => ({ ...lead, ...d }) as CrmLead, [lead, d]);
  const inf = infoLead(ctx, ef, hoje);
  const fase = inf.fase ?? "0";
  const [prox, setProx] = useState<Sugestao>(() => sugerirTarefa(fase, ef, hoje));
  const [tocado, setTocado] = useState(false);
  const [naoAgora, setNaoAgora] = useState(false);
  const [verFase, setVerFase] = useState<Fase | null>(null);
  const [salvando, setSalvando] = useState(false);
  const rc = resumoComercial(ctx.comercial, ef.cliente_id);
  const set = (p: Patch) => setD((x) => ({ ...x, ...p }));
  useEffect(() => { if (!tocado) setProx(sugerirTarefa(fase, ef, hoje)); }, [fase, ef.amostra, ef.cadastro_fornecedor, ef.visita_em, ef.pago_em]); // eslint-disable-line react-hooks/exhaustive-deps

  const falta = naoAgora ? faltaParaAvancar("X", ef, { temPedido: rc.pedidos.length > 0 }) : faltaParaAvancar(fase, ef, { temPedido: rc.pedidos.length > 0 });
  const prox_ = proximaFase(fase);
  const info = FASES[fase];
  const frase = fraseDaFase(ctx, ef, fase);

  async function gravar(tipo: "salvar" | "avancar" | "nao") {
    setSalvando(true);
    try {
      if (tipo === "nao") {
        await aplicarAtualizacao(ctx, lead, { patch: { ...d, motivo_nao_agora: ef.motivo_nao_agora, retomar_em: ef.retomar_em }, novaFase: "X", tarefaAtual: "Cancelada",
          atividade: { tipo: "E-mail ou WhatsApp", resultado: `Não vai agora: ${ef.motivo_nao_agora} · retomar em ${fmtData(ef.retomar_em)}` } });
        toast.success("Encerrado por agora");
      } else if (tipo === "avancar" && prox_) {
        const p = tocado ? prox : sugerirTarefa(prox_, ef, hoje);
        await aplicarAtualizacao(ctx, lead, {
          patch: d, novaFase: prox_, tarefaAtual: "Feita", proxima: p,
          atividade: fase === "2" ? { tipo: "Visita", resultado: resumoFicha(ef) } : undefined,
        });
        toast.success(`Avançou para ${FASES[prox_].nome}`);
      } else {
        await aplicarAtualizacao(ctx, lead, { patch: d, tarefaAtual: "Feita", proxima: prox });
        toast.success("Atualizado");
      }
      setD({}); setTocado(false); setNaoAgora(false);
      await ctx.recarregar();
      if (tipo !== "salvar") onClose();
    } catch (e) {
      toast.error(`Não foi possível salvar: ${(e as Error).message}`);
    } finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[94vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2">{ef.nome_conta}</DialogTitle>
          <DialogDescription>{ef.cidade ?? "—"}/{ef.uf ?? "—"}{ctx.gestao && ` · ${nomeRep(ctx, ef.representante_id)}`}{ef.rede_grupo && ` · rede ${ef.rede_grupo}`}</DialogDescription>
          <div className="flex flex-wrap items-center gap-1.5">
            <Selo tom="gold">Classe {inf.classe}</Selo>
            {inf.nivel && <Selo>{inf.nivel}</Selo>}
            <TempDot t={inf.temp} label />
            {ef.segmento && <Selo>{ef.segmento}</Selo>}
            {inf.prio && <Selo tom="gold">{inf.prio}</Selo>}
            {ef.tier_a && <Selo tom="bordo">Tier A</Selo>}
            {ctx.gestao && ctx.conflitos.has(ef.id) && <Selo tom="alerta">Conflito</Selo>}
            {inf.alertas.length > 0 && <Selo tom="alerta">{inf.alertas.join(", ")}</Selo>}
          </div>
          <div className="text-[11px] text-text-secondary">{ESFORCO[inf.classe]}</div>
        </DialogHeader>

        {/* Trilha */}
        <div className="flex gap-1 pt-1">
          {TRILHA.map((f) => {
            const idx = TRILHA.indexOf(fase as Fase), i = TRILHA.indexOf(f);
            const feita = fase !== "X" && i < idx, atual = f === fase;
            return (
              <button key={f} type="button" disabled={!feita} onClick={() => setVerFase(verFase === f ? null : f)} title={FASES[f].nome}
                className={cn("flex-1 h-2 rounded-full", feita ? "bg-gold" : atual ? "bg-gold/50 ring-2 ring-gold" : "bg-muted", feita && "cursor-pointer")} />
            );
          })}
        </div>
        <div className="text-xs text-text-secondary -mt-1">Fase {fase} · <span className="text-text-primary font-medium">{info.nome}</span>{fase !== "X" && ` · desde ${fmtData(ef.stage_desde)}`}</div>
        {verFase && <div className="rounded-md border border-border bg-muted/40 p-2 text-xs"><b>{FASES[verFase].nome}:</b> {registroDaFase(ef, verFase)}</div>}

        <Tabs defaultValue="fase">
          <TabsList className="h-8">
            <TabsTrigger value="fase" className="text-xs">Fase atual</TabsTrigger>
            <TabsTrigger value="hist" className="text-xs">Histórico</TabsTrigger>
            {ef.cliente_id && <TabsTrigger value="com" className="text-xs">Comercial</TabsTrigger>}
          </TabsList>
          <TabsContent value="fase" className="space-y-3 pt-2">
            {fase === "X" ? (
              <div className="space-y-2 text-sm">
                <p className="text-text-secondary">Encerrado por agora: <span className="text-text-primary">{ef.motivo_nao_agora ?? "—"}</span>{ef.retomar_em && ` · volta para "A agendar" em ${fmtData(ef.retomar_em)}`}.</p>
                <NaoVaiAgora lead={ef} set={set} />
                <Button size="sm" disabled={salvando} onClick={async () => {
                  setSalvando(true);
                  try { await aplicarAtualizacao(ctx, lead, { patch: { motivo_nao_agora: ef.motivo_nao_agora, retomar_em: ef.retomar_em } }); toast.success("Atualizado"); await ctx.recarregar(); }
                  catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
                }}>Salvar</Button>
              </div>
            ) : naoAgora ? (
              <div className="space-y-3">
                <div className="text-sm text-text-secondary"><b className="text-text-primary">O rep faz:</b> {FASES.X.repFaz}</div>
                <NaoVaiAgora lead={ef} set={set} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setNaoAgora(false)}>Voltar</Button>
                  <Button disabled={salvando || falta.length > 0} onClick={() => void gravar("nao")}>Encerrar por agora</Button>
                </div>
                {falta.length > 0 && <div className="text-xs text-destructive">Falta: {falta.join(", ")}</div>}
              </div>
            ) : (
              <>
                <div className="text-sm"><span className="text-[11px] uppercase tracking-wide text-text-secondary block">O rep faz</span>{info.repFaz}</div>
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-text-secondary block">Você marca</span>
                  <CamposFase ctx={ctx} lead={ef} fase={fase} set={set} onVincular={onVincular} numeroPedido={rc.pedidos[0]?.id ?? null} />
                </div>
                {frase && <FraseBox texto={frase} />}
                <div className="text-xs text-text-secondary">Tarefa aberta: <span className="text-text-primary">{textoTarefa(inf.tarefa)}</span></div>
                <ProximaAtividade valor={prox} onChange={(s) => { setProx(s); setTocado(true); }} />
                {prox_ && !tocado && <p className="text-[11px] text-text-secondary -mt-2">Ao avançar, a próxima atividade vira a sugestão de "{FASES[prox_].nome}", a não ser que você troque aqui.</p>}
                <div className="sticky bottom-0 bg-background pt-2 space-y-2">
                  {prox_ && info.avanco && (
                    <Button className="w-full h-11" disabled={salvando || falta.length > 0} onClick={() => void gravar("avancar")}>Avança quando: {info.avanco}</Button>
                  )}
                  {prox_ && falta.length > 0 && <div className="text-xs text-destructive">Falta: {falta.join(", ")}{fase === "4" && ef.cliente_id && rc.pedidos.length === 0 ? " — quando o pedido entrar, o lead avança sozinho" : ""}</div>}
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" className="text-xs text-text-secondary underline" onClick={() => setNaoAgora(true)}>Não vai agora</button>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={onEditar}>Editar dados</Button>
                      <Button size="sm" variant="outline" disabled={salvando} onClick={() => void gravar("salvar")}>Salvar sem avançar</Button>
                    </div>
                  </div>
                </div>
              </>
            )}
            {fase === "X" && <div className="text-right"><Button size="sm" variant="ghost" onClick={onEditar}>Editar dados</Button></div>}
          </TabsContent>
          <TabsContent value="hist" className="pt-2"><Historico ctx={ctx} lead={ef} /></TabsContent>
          {ef.cliente_id && <TabsContent value="com" className="pt-2">{comercial}</TabsContent>}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Historico({ ctx, lead }: { ctx: Ctx; lead: CrmLead }) {
  const [hist, setHist] = useState<CrmHist[] | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    void Promise.all([
      supabase.from("crm_stage_history").select("*").eq("lead_id", lead.id).order("alterado_em", { ascending: false }),
      supabase.from("crm_stages").select("id, nome"),
    ]).then(([h, s]) => { setHist((h.data ?? []) as CrmHist[]); setNomes(new Map((s.data ?? []).map((x) => [x.id, x.nome]))); });
  }, [lead.id]);
  if (!hist) return <div className="text-sm text-text-secondary">Carregando…</div>;
  type Item = { quando: string; texto: string; tipo: string };
  const itens: Item[] = [
    ...hist.map((h) => ({ quando: h.alterado_em, tipo: "Fase",
      texto: h.stage_anterior_id === h.stage_novo_id && h.evento ? h.evento
        : `${nomes.get(h.stage_anterior_id ?? "") ?? "início"} → ${nomes.get(h.stage_novo_id ?? "") ?? "—"}${h.evento ? ` (${h.evento})` : ""} · ${nomeRep(ctx, h.alterado_por)}` })),
    ...ctx.atividades.filter((a) => a.lead_id === lead.id).map((a) => ({ quando: a.created_at, tipo: a.tipo, texto: a.resultado ?? "A registrar" })),
    ...ctx.tarefas.filter((t) => t.lead_id === lead.id).map((t) => ({ quando: t.created_at, tipo: `Tarefa ${t.status.toLowerCase()}`, texto: `${t.tipo} · ${fmtData(t.vence_em)} · ${t.responsavel}${t.descricao ? ` — ${t.descricao}` : ""}` })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));
  return (
    <div className="space-y-2">
      {lead.descobertas && <div className="rounded-md bg-muted/40 p-2 text-xs whitespace-pre-line"><b>Descobertas:</b> {lead.descobertas}</div>}
      {itens.length === 0 ? <div className="text-sm text-text-secondary">Sem histórico.</div> : itens.map((i, k) => (
        <div key={k} className="flex gap-2 text-xs border-b border-border pb-1.5">
          <span className="w-12 shrink-0 text-text-secondary">{new Date(i.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
          <span className="w-28 shrink-0 text-gold">{i.tipo}</span><span className="text-text-primary">{i.texto}</span>
        </div>
      ))}
    </div>
  );
}

