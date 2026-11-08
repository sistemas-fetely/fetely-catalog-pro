import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_LABELS, type CatalogLists, type CatalogRow } from "@/lib/catalogSpreadsheet";
import { createValue, loadLists } from "@/lib/catalogSpreadsheetData";
import { loadCatalogRows, useCatalog } from "@/store/catalogStore";
import { useAuth } from "@/store/authStore";
import {
  callCatalogDaily,
  dailyNewValues,
  mapDailyResponse,
  prepareDailyItems,
  type DailyChoice,
  type DailyData,
  type DailyPrepared,
} from "@/lib/catalogDailyUpdate";

const display = (value: unknown) => value == null || value === "" ? "—" : typeof value === "boolean" ? value ? "Sim" : "Não" : String(value);
type DailyOutcome = { id: string; code: string; field: string; status: "Aplicada" | "Resolvida" | "Descartada" | "Erro"; message?: string };

export function CatalogDailyUpdateSection() {
  const session = useAuth(s => s.session);
  const profile = useAuth(s => s.profile);
  const [data, setData] = useState<DailyData | null>(null);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [lists, setLists] = useState<CatalogLists | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, DailyChoice>>({});
  const [newValues, setNewValues] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<DailyOutcome[]>([]);

  async function refresh(showBusy = true) {
    if (showBusy) setBusy("Consultando atualização do dia");
    setError("");
    try {
      const [response, currentRows, currentLists] = await Promise.all([
        callCatalogDaily({ acao: "pendentes" }), loadCatalogRows(), loadLists(),
      ]);
      const mapped = mapDailyResponse(response);
      setData(mapped); setRows(currentRows); setLists(currentLists);
      setSelected(prev => new Set([...prev].filter(id => mapped.itens.some(item => item.id === id))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (showBusy) setBusy(""); }
  }

  useEffect(() => { void refresh(); }, []);
  const prepared = useMemo(() => data && lists ? prepareDailyItems(data.itens, rows, lists, choices) : [], [data, rows, lists, choices]);
  const pendingNewValues = useMemo(() => dailyNewValues(prepared), [prepared]);
  const selectedItems = prepared.filter(entry => selected.has(entry.item.id));

  function toggle(id: string, checked: boolean) {
    setSelected(prev => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });
  }

  async function confirmOne(entry: DailyPrepared, status: "aplicada" | "resolvida", choice: DailyChoice) {
    await callCatalogDaily({ acao: "confirmar", ids: [entry.item.id], status, escolha: choice });
  }

  async function apply() {
    if (!session || !data || !lists || !selected.size || busy) return;
    setBusy("Recalculando e aplicando no FOP"); setOutcomes([]);
    const results: DailyOutcome[] = [];
    try {
      // Recarrega imediatamente antes de gravar: o valor exibido e a detecção de
      // conflito usam o FOP vivo, não a cópia da leitura das 06:30.
      const [freshRows, freshLists] = await Promise.all([loadCatalogRows(), loadLists()]);
      setRows(freshRows); setLists(freshLists);
      const fresh = prepareDailyItems(data.itens.filter(item => selected.has(item.id)), freshRows, freshLists, choices);
      const canonical = new Map<string, string>();
      const failures = new Map<string, string>();
      for (const value of dailyNewValues(fresh).filter(value => newValues.has(value.key))) {
        try { canonical.set(value.key, await createValue(value, freshLists)); }
        catch (cause) { failures.set(value.key, cause instanceof Error ? cause.message : String(cause)); }
      }

      const groups = new Map<string, DailyPrepared[]>();
      for (const entry of fresh) {
        const base = { id: entry.item.id, code: entry.item.cod_cadastro, field: entry.item.campo };
        const choice: DailyChoice = entry.choice ?? "planilha";
        const status = entry.item.tipo === "conflito" || entry.drifted ? "resolvida" : "aplicada";
        try {
          if (entry.error) throw new Error(entry.error);
          if ((entry.item.tipo === "conflito" || entry.drifted) && !entry.choice) throw new Error("Escolha planilha ou sistema antes de aplicar");
          if (choice === "sistema") {
            await confirmOne(entry, "resolvida", "sistema");
            results.push({ ...base, status: "Resolvida" }); continue;
          }
          if (!entry.change) {
            await confirmOne(entry, status, "planilha");
            results.push({ ...base, status: status === "resolvida" ? "Resolvida" : "Aplicada" }); continue;
          }
          if (entry.change.newKey && !newValues.has(entry.change.newKey)) throw new Error("Valor novo não selecionado para criação");
          if (entry.change.newKey && failures.has(entry.change.newKey)) throw new Error(failures.get(entry.change.newKey));
          const group = groups.get(entry.item.cod_cadastro) ?? []; group.push(entry); groups.set(entry.item.cod_cadastro, group);
        } catch (cause) {
          results.push({ ...base, status: "Erro", message: cause instanceof Error ? cause.message : String(cause) });
        }
      }

      let done = 0;
      for (const [code, entries] of groups) {
        setBusy(`Gravando ${code} · ${++done}/${groups.size}`);
        const patch = Object.fromEntries(entries.map(entry => [entry.change!.field, entry.change!.newKey ? canonical.get(entry.change!.newKey) ?? entry.change!.after : entry.change!.after]));
        try {
          await useCatalog.getState().saveProductFields(code, patch, {
            usuarioId: session.user.id,
            usuarioNome: profile?.nome_completo ?? profile?.login_amigavel ?? session.user.email ?? "—",
          }, `Atualização do dia · ${data.leitura?.hora ?? "leitura SNCF"}`);
          for (const entry of entries) {
            const status = entry.item.tipo === "conflito" || entry.drifted ? "resolvida" : "aplicada";
            try {
              await confirmOne(entry, status, "planilha");
              results.push({ id: entry.item.id, code, field: entry.item.campo, status: status === "resolvida" ? "Resolvida" : "Aplicada" });
            } catch (cause) {
              results.push({ id: entry.item.id, code, field: entry.item.campo, status: "Erro", message: `Gravado no FOP, mas a confirmação ao SNCF falhou: ${cause instanceof Error ? cause.message : String(cause)}` });
            }
          }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          for (const entry of entries) results.push({ id: entry.item.id, code, field: entry.item.campo, status: "Erro", message });
        }
      }
      setOutcomes(results);
      if (results.some(result => result.status === "Erro")) toast.error("Há itens não confirmados; confira os erros antes de tentar novamente");
      else toast.success("Atualização aplicada e confirmada ao SNCF");
      await useCatalog.getState().hydrate({ force: true });
      await refresh(false);
    } catch (cause) {
      setOutcomes(results); toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(""); }
  }

  async function discard() {
    if (!data || !selected.size || busy) return;
    setBusy("Descartando no SNCF"); setOutcomes([]);
    const results: DailyOutcome[] = [];
    for (const entry of prepared.filter(item => selected.has(item.item.id))) {
      try {
        await callCatalogDaily({ acao: "confirmar", ids: [entry.item.id], status: "descartada", escolha: entry.choice ?? "planilha" });
        results.push({ id: entry.item.id, code: entry.item.cod_cadastro, field: entry.item.campo, status: "Descartada" });
      } catch (cause) {
        results.push({ id: entry.item.id, code: entry.item.cod_cadastro, field: entry.item.campo, status: "Erro", message: cause instanceof Error ? cause.message : String(cause) });
      }
    }
    setOutcomes(results);
    if (results.some(result => result.status === "Erro")) toast.error("Alguns descartes não foram confirmados");
    else toast.success("Itens descartados no SNCF");
    await refresh(false); setBusy("");
  }

  return <section className="space-y-4 rounded-lg border border-border bg-surface p-4" aria-labelledby="daily-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="daily-title" className="text-lg font-semibold">Atualização do dia</h2><p className="text-sm text-text-secondary">Fila de Produto lida pelo SNCF no SharePoint. A gravação e a auditoria acontecem no FOP.</p></div>
      <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={!!busy}><RefreshCw className="mr-2 h-4 w-4" />Atualizar fila</Button>
    </div>
    {data?.leitura && <p className="text-sm"><strong>Última leitura:</strong> {data.leitura.hora} · <strong>Status:</strong> {data.leitura.status}</p>}
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}<Button variant="outline" size="sm" className="ml-3" onClick={() => void refresh()}>Tentar novamente</Button></div>}
    {busy && <p role="status" className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}
    {data && !error && <>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setSelected(new Set(prepared.filter(entry => !entry.error).map(entry => entry.item.id)))} disabled={!!busy || !prepared.length}>Selecionar válidos</Button>
        <span className="text-sm text-text-secondary">{selected.size} selecionados de {prepared.length}</span>
        <Button size="sm" onClick={() => void apply()} disabled={!!busy || !selected.size}><Check className="mr-2 h-4 w-4" />Aplicar</Button>
        <Button variant="outline" size="sm" onClick={() => void discard()} disabled={!!busy || !selected.size}><Trash2 className="mr-2 h-4 w-4" />Descartar</Button>
      </div>
      {pendingNewValues.length > 0 && <div className="space-y-2 rounded-md bg-surface-2 p-3"><h3 className="text-sm font-semibold">Valores novos</h3>{pendingNewValues.map(value => <label key={value.key} className="flex items-center gap-2 text-sm"><Checkbox checked={newValues.has(value.key)} onCheckedChange={checked => setNewValues(prev => { const next = new Set(prev); if (checked === true) next.add(value.key); else next.delete(value.key); return next; })} />Criar este valor: {FIELD_LABELS[value.kind]} — {value.nome}</label>)}</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-surface-2 text-text-secondary"><tr>{["", "Código", "Campo", "Tipo", "Base", "Planilha", "FOP agora", "Escolha"].map(head => <th key={head} className="p-2 text-left">{head}</th>)}</tr></thead><tbody>{prepared.map(entry => {
        const conflict = entry.item.tipo === "conflito" || entry.drifted;
        return <tr key={entry.item.id} className="border-t border-border align-top">
          <td className="p-2"><Checkbox aria-label={`Selecionar ${entry.item.cod_cadastro} ${entry.item.campo}`} checked={selected.has(entry.item.id)} disabled={!!busy || !!entry.error} onCheckedChange={checked => toggle(entry.item.id, checked === true)} /></td>
          <td className="p-2">{entry.item.cod_cadastro}<span className="block max-w-44 break-words text-xs text-text-secondary">{display(entry.product?.nome_comercial)}</span></td>
          <td className="p-2">{FIELD_LABELS[entry.item.campo] ?? entry.item.campo}{entry.error && <span className="block max-w-56 text-xs text-destructive">{entry.error}</span>}</td>
          <td className="p-2">{conflict ? "Conflito" : "Mudança"}{entry.drifted && entry.item.tipo !== "conflito" && <span className="block text-xs text-text-secondary">FOP mudou após a leitura</span>}</td>
          <td className="max-w-48 break-words p-2">{conflict ? display(entry.item.valor_base) : "—"}</td>
          <td className="max-w-48 break-words p-2">{display(entry.item.valor_planilha)}</td>
          <td className="max-w-48 break-words p-2">{display(entry.current)}{conflict && <span className="block text-xs text-text-secondary">Sistema na leitura: {display(entry.item.valor_sistema)}</span>}</td>
          <td className="p-2">{conflict ? <Select value={entry.choice} onValueChange={value => setChoices(prev => ({ ...prev, [entry.item.id]: value as DailyChoice }))} disabled={!!busy}><SelectTrigger aria-label={`Escolha para ${entry.item.cod_cadastro} ${entry.item.campo}`} className="w-36"><SelectValue placeholder="Escolher" /></SelectTrigger><SelectContent><SelectItem value="planilha">Planilha</SelectItem><SelectItem value="sistema">Sistema</SelectItem></SelectContent></Select> : "—"}</td>
        </tr>;
      })}</tbody></table></div>
      {!prepared.length && <p className="text-sm text-text-secondary">Nenhuma mudança pendente do dono Produto.</p>}
      {data.semCadastro.length > 0 && <div className="rounded-md border border-border p-3"><h3 className="font-semibold">Sem cadastro</h3><p className="text-sm text-text-secondary">Estes produtos não são criados aqui: nascem pela Importação de PI no SNCF.</p><ul className="mt-2 list-inside list-disc text-sm">{data.semCadastro.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {data.erros.length > 0 && <div><h3 className="font-semibold text-destructive">Erros da leitura</h3><ul className="list-inside list-disc text-sm text-destructive">{data.erros.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    </>}
    {outcomes.length > 0 && <div><h3 className="font-semibold">Resultado desta operação</h3><ul className="divide-y divide-border text-sm">{outcomes.map(outcome => <li key={outcome.id} className="py-2">{outcome.code} · {FIELD_LABELS[outcome.field] ?? outcome.field} — <span className={outcome.status === "Erro" ? "text-destructive" : "text-stock-in"}>{outcome.status}</span>{outcome.message && <p className="break-words text-destructive">{outcome.message}</p>}</li>)}</ul></div>}
  </section>;
}
