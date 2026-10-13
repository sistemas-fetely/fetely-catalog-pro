// Aba "Homologação" do CRM: checklist de atividades de cada representante,
// que mora no Fetély Connect (/painel/atividades). Aqui só lemos e marcamos.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { carregarHomologacao, alterarHomologacao, type Homologacao, type TarefaHomolog } from "@/lib/mapaAtuacao.functions";

type AlterarInput =
  | { acao: "marcar"; tarefaId: string; concluida: boolean }
  | { acao: "adicionar"; representanteId: string; titulo: string }
  | { acao: "remover"; tarefaId: string }
  | { acao: "aplicar_padrao" };
type Vista = "rep" | "ativ";
type Filtro = "todos" | "pendentes" | "concluidos";

function Barra({ feitas, total }: { feitas: number; total: number }) {
  const pct = total ? Math.round((feitas / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-40 rounded bg-muted overflow-hidden">
        <div className={cn("h-full", pct === 100 ? "bg-primary" : "bg-primary/60")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-20">{pct}% · {feitas}/{total}</span>
    </div>
  );
}

export function HomologacaoTab({ gestao }: { gestao: boolean }) {
  const [dados, setDados] = useState<Homologacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("rep");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados(await carregarHomologacao());
      setErro(null);
    } catch (e) {
      const m = (e as Error).message;
      setErro(m.includes("404") ? "O Fetély Connect ainda não liberou as atividades para o Order Pro." : m);
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const executar = async (input: AlterarInput, otimista?: (d: Homologacao) => Homologacao) => {
    if (otimista && dados) setDados(otimista(dados));
    try {
      await alterarHomologacao({ data: input });
    } catch (e) {
      toast.error((e as Error).message);
    }
    void carregar();
  };

  const marcar = (t: TarefaHomolog, concluida: boolean) => {
    if (!gestao) return;
    void executar({ acao: "marcar", tarefaId: t.id, concluida }, (d) => ({
      ...d, tarefas: d.tarefas.map((x) => (x.id === t.id ? { ...x, concluida, concluidaEm: concluida ? new Date().toISOString() : null } : x)),
    }));
  };

  const porRep = useMemo(() => {
    const m = new Map<string, TarefaHomolog[]>();
    for (const t of dados?.tarefas ?? []) m.set(t.representanteId, [...(m.get(t.representanteId) ?? []), t]);
    return m;
  }, [dados]);

  const b = busca.trim().toLowerCase();
  const linhas = (dados?.representantes ?? [])
    .map((rep) => { const lista = porRep.get(rep.id) ?? []; return { rep, lista, feitas: lista.filter((t) => t.concluida).length, total: lista.length }; })
    .filter((l) => (b ? l.rep.nome.toLowerCase().includes(b) : true))
    .filter((l) => filtro === "pendentes" ? l.feitas < l.total || l.total === 0 : filtro === "concluidos" ? l.total > 0 && l.feitas === l.total : true)
    .sort((a, c) => (a.total ? a.feitas / a.total : -1) - (c.total ? c.feitas / c.total : -1));

  const nomeDe = new Map((dados?.representantes ?? []).map((r) => [r.id, r.nome]));
  const porTitulo = [...(dados?.tarefas ?? []).reduce((m, t) => {
    const e = m.get(t.titulo) ?? { feitas: 0, total: 0, itens: [] as TarefaHomolog[] };
    e.total++; if (t.concluida) e.feitas++; e.itens.push(t); m.set(t.titulo, e); return m;
  }, new Map<string, { feitas: number; total: number; itens: TarefaHomolog[] }>()).entries()]
    .filter(([titulo]) => (b ? titulo.toLowerCase().includes(b) : true))
    .filter(([, e]) => filtro === "pendentes" ? e.feitas < e.total : filtro === "concluidos" ? e.feitas === e.total : true)
    .sort((a, c) => a[1].feitas / a[1].total - c[1].feitas / c[1].total);

  if (erro) return <Card><CardContent className="p-4 text-sm text-destructive">{erro}</CardContent></Card>;
  if (!dados) return <p className="text-sm text-muted-foreground">Carregando atividades do Fetély Connect…</p>;

  const total = dados.tarefas.length;
  const feitas = dados.tarefas.filter((t) => t.concluida).length;
  const completos = dados.representantes.filter((r) => { const l = porRep.get(r.id) ?? []; return l.length > 0 && l.every((t) => t.concluida); }).length;
  const semChecklist = dados.representantes.filter((r) => !(porRep.get(r.id) ?? []).length).length;

  if (!gestao && dados.representantes.length === 0)
    return <Card><CardContent className="p-4 text-sm text-muted-foreground">Seu cadastro ainda não foi vinculado ao Fetély Connect. Peça à gestão para fazer o vínculo na aba Mapa.</CardContent></Card>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Homologação de representantes</h2>
          <p className="text-xs text-muted-foreground">Atividades de onboarding de cada representante ativo, vindas do Fetély Connect.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void carregar()}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
          {gestao && (
            <Button size="sm" variant="outline" disabled={ocupado} onClick={async () => { setOcupado(true); await executar({ acao: "aplicar_padrao" }); setOcupado(false); toast.success("Tarefas padrão aplicadas"); }}>
              {ocupado ? "Aplicando…" : "Aplicar tarefas padrão a todos"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        {[
          ["Conclusão geral", `${total ? Math.round((feitas / total) * 100) : 0}%`],
          ["Atividades pendentes", String(total - feitas)],
          ["Representantes 100%", `${completos}/${dados.representantes.length}`],
          ["Sem checklist", String(semChecklist)],
        ].map(([r, v]) => (
          <Card key={r}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{r}</p><p className="text-2xl font-semibold text-primary">{v}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {gestao && (["rep", "ativ"] as const).map((v) => (
          <Button key={v} size="sm" variant={vista === v ? "default" : "outline"} onClick={() => setVista(v)}>
            {v === "rep" ? "Por representante" : "Por atividade"}
          </Button>
        ))}
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendentes">Com pendências</SelectItem>
            <SelectItem value="concluidos">100% concluídos</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-56 h-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={vista === "rep" ? "Buscar representante" : "Buscar atividade"} />
      </div>

      {vista === "rep" ? (
        <Card><CardContent className="p-0 divide-y">
          {linhas.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum representante nesse filtro.</p>}
          {linhas.map(({ rep, lista, feitas: f, total: t }) => {
            const open = aberto === rep.id || (!gestao && linhas.length === 1);
            const proxima = lista.find((x) => !x.concluida);
            return (
              <div key={rep.id}>
                <button type="button" className="w-full flex flex-wrap items-center gap-3 p-3 text-left hover:bg-muted/50" onClick={() => setAberto(open ? null : rep.id)}>
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium">{rep.nome}{rep.nacional && <span className="ml-2 text-xs text-primary">nacional</span>}</p>
                    <p className="text-xs text-muted-foreground">{t === 0 ? "Sem checklist" : proxima ? `Próxima: ${proxima.titulo}` : "Tudo concluído"}</p>
                  </div>
                  <Barra feitas={f} total={t} />
                </button>
                {open && (
                  <div className="px-10 pb-3 space-y-1">
                    {lista.map((x) => (
                      <div key={x.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={x.concluida} disabled={!gestao} onCheckedChange={(c) => marcar(x, c === true)} />
                        <span className={cn("flex-1", x.concluida && "line-through text-muted-foreground")}>{x.titulo}</span>
                        {x.concluidaEm && <span className="text-xs text-muted-foreground">{new Date(x.concluidaEm).toLocaleDateString("pt-BR")}{x.concluidaPor ? ` · ${x.concluidaPor}` : ""}</span>}
                        {gestao && x.origem === "avulsa" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void executar({ acao: "remover", tarefaId: x.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    ))}
                    {gestao && (
                      <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); const titulo = novaTarefa.trim(); if (!titulo) return; setNovaTarefa(""); void executar({ acao: "adicionar", representanteId: rep.id, titulo }); }}>
                        <Input className="h-8" value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} placeholder="Nova atividade para este representante" />
                        <Button size="sm" type="submit"><Plus className="h-4 w-4" /></Button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 divide-y">
          {porTitulo.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma atividade nesse filtro.</p>}
          {porTitulo.map(([titulo, e]) => {
            const open = aberto === `t:${titulo}`;
            const pendentes = e.itens.filter((x) => !x.concluida);
            return (
              <div key={titulo}>
                <button type="button" className="w-full flex flex-wrap items-center gap-3 p-3 text-left hover:bg-muted/50" onClick={() => setAberto(open ? null : `t:${titulo}`)}>
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <p className="flex-1 min-w-[180px] text-sm font-medium">{titulo}</p>
                  <Barra feitas={e.feitas} total={e.total} />
                </button>
                {open && (
                  <div className="px-10 pb-3 space-y-1">
                    {pendentes.length > 0 && (
                      <Button size="sm" variant="outline" className="mb-2" onClick={() => {
                        const ids = new Set(pendentes.map((x) => x.id));
                        if (dados) setDados({ ...dados, tarefas: dados.tarefas.map((x) => (ids.has(x.id) ? { ...x, concluida: true } : x)) });
                        void Promise.all(pendentes.map((x) => alterarHomologacao({ data: { acao: "marcar", tarefaId: x.id, concluida: true } }))).catch((er) => toast.error((er as Error).message)).finally(() => void carregar());
                      }}>Concluir para todos ({pendentes.length})</Button>
                    )}
                    {e.itens.map((x) => (
                      <div key={x.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={x.concluida} onCheckedChange={(c) => marcar(x, c === true)} />
                        <span className={cn(x.concluida && "line-through text-muted-foreground")}>{nomeDe.get(x.representanteId) ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent></Card>
      )}
    </div>
  );
}
