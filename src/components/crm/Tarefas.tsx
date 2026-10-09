// CRM Parte 4 — painel de tarefas da gestão.
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fmtData, hojeISO, diasEntre, type CrmTask } from "@/lib/crm";
import { TASK_TIPOS, sugerirTarefa, type Sugestao } from "@/lib/crmFases";
import { type Ctx, nomeRep, faseDe, ProximaAtividade, aplicarAtualizacao, Marca, Selo } from "./shared";

const TODOS = "__todos";

export function TarefasGestao({ ctx }: { ctx: Ctx }) {
  const hoje = hojeISO();
  const [rep, setRep] = useState(TODOS);
  const [resp, setResp] = useState(TODOS);
  const [tipo, setTipo] = useState(TODOS);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [feitas, setFeitas] = useState<CrmTask[] | null>(null);
  const [dataRemarcar, setDataRemarcar] = useState(hoje);
  const leadMap = new Map(ctx.leads.map((l) => [l.id, l]));

  const abertas = ctx.tarefas.filter((t) => t.status === "Aberta" && leadMap.has(t.lead_id)
    && (rep === TODOS || t.representante_id === rep) && (resp === TODOS || t.responsavel === resp) && (tipo === TODOS || t.tipo === tipo));
  const dow = new Date().getDay();
  const fimSemana = (() => { const d = new Date(); d.setDate(d.getDate() + (7 - (dow === 0 ? 7 : dow))); return d.toISOString().slice(0, 10); })();
  const secoes = [
    { titulo: "Vencidas", itens: abertas.filter((t) => t.vence_em < hoje), alerta: true },
    { titulo: "Hoje", itens: abertas.filter((t) => t.vence_em === hoje) },
    { titulo: "Esta semana", itens: abertas.filter((t) => t.vence_em > hoje && t.vence_em <= fimSemana) },
    { titulo: "Depois", itens: abertas.filter((t) => t.vence_em > fimSemana) },
  ];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function remarcar(ids: string[], data: string) {
    const { error } = await supabase.from("crm_tasks").update({ vence_em: data }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(ids.length > 1 ? `${ids.length} tarefas remarcadas` : "Tarefa remarcada");
    setSel(new Set());
    await ctx.recarregar();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={rep} onValueChange={setRep}><SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={TODOS}>Todos os representantes</SelectItem>{ctx.representantes.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent></Select>
        <Select value={resp} onValueChange={setResp}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={TODOS}>Qualquer responsável</SelectItem><SelectItem value="Representante">Representante</SelectItem><SelectItem value="Gestão">Gestão</SelectItem></SelectContent></Select>
        <Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={TODOS}>Todos os tipos</SelectItem>{TASK_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
      </div>
      {sel.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-gold/50 bg-background p-2 text-sm">
          <span className="font-medium">{sel.size} selecionada(s)</span>
          <Button size="sm" onClick={() => setFeitas(ctx.tarefas.filter((t) => sel.has(t.id)))}>Marcar como feitas</Button>
          <Input type="date" className="w-40 h-9" value={dataRemarcar} onChange={(e) => setDataRemarcar(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void remarcar([...sel], dataRemarcar)}>Remarcar</Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Limpar</Button>
        </div>
      )}
      {secoes.map((s) => (
        <Card key={s.titulo}><CardContent className="p-3 sm:p-4">
          <div className={cn("text-sm font-medium mb-2", s.alerta && s.itens.length ? "text-destructive" : "text-text-primary")}>{s.titulo} ({s.itens.length})</div>
          {s.itens.length === 0 ? <div className="text-xs text-text-secondary">Nada aqui.</div> : s.itens.map((t) => {
            const l = leadMap.get(t.lead_id)!;
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-border text-sm">
                <Marca checked={sel.has(t.id)} onChange={() => toggle(t.id)}><span className="sr-only">Selecionar</span></Marca>
                <button type="button" className="flex-1 min-w-48 text-left" onClick={() => ctx.abrirLead(l)}>
                  <div className="text-text-primary">{l.nome_conta} <span className="text-text-secondary text-xs">· {nomeRep(ctx, l.representante_id)}</span></div>
                  <div className="text-xs text-text-secondary">{t.tipo}{t.descricao ? ` — ${t.descricao}` : ""} · <span className={t.vence_em < hoje ? "text-destructive" : ""}>{fmtData(t.vence_em)}{t.vence_em < hoje ? ` (${diasEntre(t.vence_em, hoje)}d)` : ""}</span></div>
                </button>
                <Selo>{t.responsavel}</Selo>
                <Button size="sm" onClick={() => setFeitas([t])}>Feita</Button>
                <RemarcarInline onOk={(d) => void remarcar([t.id], d)} />
              </div>
            );
          })}
        </CardContent></Card>
      ))}
      {feitas && <FeitasDialog ctx={ctx} tarefas={feitas} onClose={() => { setFeitas(null); setSel(new Set()); }} />}
    </div>
  );
}

function RemarcarInline({ onOk }: { onOk: (d: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [d, setD] = useState(hojeISO());
  if (!aberto) return <Button size="sm" variant="outline" onClick={() => setAberto(true)}>Remarcar</Button>;
  return (
    <span className="flex items-center gap-1">
      <Input type="date" className="w-36 h-8" value={d} onChange={(e) => setD(e.target.value)} />
      <Button size="sm" onClick={() => { setAberto(false); onOk(d); }}>OK</Button>
    </span>
  );
}

/** Marcar Feita pede a próxima atividade de cada lead (uma tarefa aberta por lead). */
function FeitasDialog({ ctx, tarefas, onClose }: { ctx: Ctx; tarefas: CrmTask[]; onClose: () => void }) {
  const hoje = hojeISO();
  const leadMap = new Map(ctx.leads.map((l) => [l.id, l]));
  const [prox, setProx] = useState<Record<string, Sugestao>>(() => Object.fromEntries(tarefas.map((t) => {
    const l = leadMap.get(t.lead_id)!;
    return [t.id, sugerirTarefa(faseDe(ctx, l) ?? "0", l, hoje)];
  })));
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    setSalvando(true);
    let ok = 0;
    for (const t of tarefas) {
      const l = leadMap.get(t.lead_id);
      if (!l) continue;
      try {
        await aplicarAtualizacao(ctx, l, { tarefaAtual: "Feita", proxima: prox[t.id], atividade: { tipo: "E-mail ou WhatsApp", resultado: `Tarefa feita: ${t.tipo}` } });
        ok++;
      } catch (e) { toast.error(`${l.nome_conta}: ${(e as Error).message}`); }
    }
    setSalvando(false);
    if (ok) toast.success(`${ok} tarefa(s) feita(s) com próxima atividade`);
    await ctx.recarregar();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Próxima atividade</DialogTitle><DialogDescription>Toda oportunidade aberta continua com uma próxima atividade com data.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {tarefas.map((t) => (
            <div key={t.id} className="space-y-1">
              <div className="text-sm font-medium text-text-primary">{leadMap.get(t.lead_id)?.nome_conta} <span className="text-xs text-text-secondary">· feita: {t.tipo}</span></div>
              <ProximaAtividade valor={prox[t.id]} onChange={(s) => setProx((p) => ({ ...p, [t.id]: s }))} />
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={salvando} onClick={() => void confirmar()}>{salvando ? "Salvando…" : "Confirmar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
