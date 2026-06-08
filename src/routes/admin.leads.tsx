import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Download,
  Plus,
  Flame,
  Zap,
  Sprout,
  Trash2,
  X,
  History as HistoryIcon,
  User as UserIcon,
  Settings2,
  MessageSquare,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useAuth } from "@/store/authStore";
import { Can } from "@/components/security/Can";
import {
  listarLeads,
  atualizarLeadCrm,
  listarHistoricoLead,
  excluirLead,
  liberarCatalogoLead,
} from "@/lib/leads.functions";
import {
  SEGMENTO_LABEL,
  POTENCIAL_LABEL,
  STATUS_CRM_LABEL,
  STATUS_CRM_COLOR,
  ORIGEM_LABEL,
  FREQUENCIA_LABEL,
  VOLUME_LABEL,
  type LeadQualificado,
  type LeadSegmento,
  type LeadPotencial,
  type LeadStatusCrm,
  type LeadOrigem,
} from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/leads")({
  component: AdminLeadsPage,
});

function AdminLeadsPage() {
  const navigate = useNavigate();
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const isAdminOrMaster = useAuth((s) => s.isAdminOrMaster);

  const listFn = useServerFn(listarLeads);

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!isAdminOrMaster()) navigate({ to: "/catalog" });
  }, [loading, session, isAdminOrMaster, navigate]);

  const leadsQ = useQuery({
    queryKey: ["leads-qualificados"],
    queryFn: () => listFn(),
    enabled: !!session && isAdminOrMaster(),
  });

  const leads = leadsQ.data ?? [];
  const [tab, setTab] = useState<"base" | "campanhas" | "integracoes">("base");

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl text-text-primary">Leads Qualificados</h1>
            <p className="text-sm text-text-secondary">
              Gestão de leads captados via formulário público de qualificação.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/qualificacao"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border bg-surface hover:bg-muted/40 transition"
            >
              <span className="text-text-secondary">Link público:</span>
              <span className="text-gold font-medium">/qualificacao ↗</span>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/qualificacao`;
                navigator.clipboard.writeText(url);
                toast.success("Link copiado");
              }}
            >
              Copiar link público
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="base">Base de Leads</TabsTrigger>
            <TabsTrigger value="campanhas" disabled>Campanhas (em breve)</TabsTrigger>
            <TabsTrigger value="integracoes" disabled>Integrações (em breve)</TabsTrigger>
          </TabsList>
          <TabsContent value="base" className="mt-6">
            <BaseLeadsTab leads={leads} loading={leadsQ.isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BaseLeadsTab({ leads, loading }: { leads: LeadQualificado[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [fSeg, setFSeg] = useState<string>("all");
  const [fPot, setFPot] = useState<string>("all");
  const [fStat, setFStat] = useState<string>("all");
  const [fOri, setFOri] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (fSeg !== "all" && l.segmento !== fSeg) return false;
      if (fPot !== "all" && l.potencial !== fPot) return false;
      if (fStat !== "all" && l.statusCrm !== fStat) return false;
      if (fOri !== "all" && l.origem !== fOri) return false;
      if (s) {
        const hay = `${l.nome} ${l.whatsapp} ${l.instagram ?? ""} ${l.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [leads, search, fSeg, fPot, fStat, fOri]);

  const kpis = useMemo(() => {
    const total = leads.length;
    const alto = leads.filter((l) => l.potencial === "alto").length;
    const hoje = new Date().toISOString().slice(0, 10);
    const novosHoje = leads.filter((l) => l.criadoEm.slice(0, 10) === hoje).length;
    const convertidos = leads.filter((l) => l.statusCrm === "convertido").length;
    return { total, alto, novosHoje, convertidos };
  }, [leads]);

  const breakdown = useMemo(() => {
    const m = new Map<LeadSegmento, number>();
    for (const l of leads) m.set(l.segmento, (m.get(l.segmento) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  function exportCsv() {
    const header = [
      "Nome","WhatsApp","Instagram","Email","Cidade","UF","Segmento","Potencial","Score",
      "Status","Origem","Frequência","Volume","Urgência","Produtos","Responsável","Tags","Criado em",
    ];
    const rows = filtered.map((l) => [
      l.nome, l.whatsapp, l.instagram ?? "", l.email ?? "", l.cidade ?? "", l.uf ?? "",
      SEGMENTO_LABEL[l.segmento], POTENCIAL_LABEL[l.potencial], String(l.score),
      STATUS_CRM_LABEL[l.statusCrm], ORIGEM_LABEL[l.origem],
      l.frequencia ? FREQUENCIA_LABEL[l.frequencia] : "",
      l.volumeEstimado ? VOLUME_LABEL[l.volumeEstimado] : "",
      l.urgencia?.toString() ?? "",
      l.produtosInteresse.join("; "),
      l.responsavelNome ?? "",
      l.tags.join("; "),
      new Date(l.criadoEm).toLocaleString("pt-BR"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fetely_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total de Leads" value={kpis.total} />
        <KpiCard label="Alto Potencial" value={kpis.alto} icon={<Flame className="h-4 w-4 text-orange-500" />} />
        <KpiCard label="Novos Hoje" value={kpis.novosHoje} />
        <KpiCard label="Convertidos" value={kpis.convertidos} />
      </div>

      {/* Breakdown */}
      {breakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-text-secondary mb-3">
            Por segmento
          </div>
          <div className="space-y-1.5">
            {breakdown.map(([seg, n]) => {
              const pct = (n / leads.length) * 100;
              return (
                <div key={seg} className="flex items-center gap-3 text-sm">
                  <div className="w-44 shrink-0 text-text-secondary">{SEGMENTO_LABEL[seg]}</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-10 text-right tabular-nums">{n}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, WhatsApp, Instagram, e-mail..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect value={fSeg} onChange={setFSeg} placeholder="Segmento"
            options={[["all", "Todos os segmentos"], ...Object.entries(SEGMENTO_LABEL)]} />
          <FilterSelect value={fPot} onChange={setFPot} placeholder="Potencial"
            options={[["all", "Todos os potenciais"], ...Object.entries(POTENCIAL_LABEL)]} />
          <FilterSelect value={fStat} onChange={setFStat} placeholder="Status"
            options={[["all", "Todos os status"], ...Object.entries(STATUS_CRM_LABEL)]} />
          <FilterSelect value={fOri} onChange={setFOri} placeholder="Origem"
            options={[["all", "Todas as origens"], ...Object.entries(ORIGEM_LABEL)]} />
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(""); setFSeg("all"); setFPot("all"); setFStat("all"); setFOri("all");
          }}>
            Limpar
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Segmento</th>
                <th className="px-4 py-3 text-left">Potencial</th>
                <th className="px-4 py-3 text-left">Origem</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Catálogo</th>
                <th className="px-4 py-3 text-left">Responsável</th>
                <th className="px-4 py-3 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-text-secondary">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  Nenhum lead encontrado.
                </td></tr>
              ) : (
                filtered.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className="border-t border-border cursor-pointer hover:bg-muted/30 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{l.nome}</div>
                      <div className="text-xs text-text-secondary">{l.whatsapp}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{SEGMENTO_LABEL[l.segmento]}</td>
                    <td className="px-4 py-3"><PotencialBadge p={l.potencial} /></td>
                    <td className="px-4 py-3 text-text-secondary">{ORIGEM_LABEL[l.origem]}</td>
                    <td className="px-4 py-3"><StatusBadge s={l.statusCrm} /></td>
                    <td className="px-4 py-3">
                      {l.catalogoLiberado ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Liberado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-text-secondary bg-muted border border-border px-2 py-0.5 rounded-full">
                          <Lock className="h-3 w-3" /> Bloqueado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{l.responsavelNome ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(l.criadoEm).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LeadDrawer lead={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-text-secondary">{label}</div>
        {icon}
      </div>
      <div className="mt-2 font-display text-3xl text-text-primary tabular-nums">{value}</div>
    </div>
  );
}

function FilterSelect({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[140px] h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function PotencialBadge({ p }: { p: LeadPotencial }) {
  const cfg = {
    alto: { icon: <Flame className="h-3 w-3" />, cls: "text-orange-600 bg-orange-500/15 border-orange-500/30" },
    medio: { icon: <Zap className="h-3 w-3" />, cls: "text-amber-600 bg-amber-500/15 border-amber-500/30" },
    em_desenvolvimento: { icon: <Sprout className="h-3 w-3" />, cls: "text-emerald-600 bg-emerald-500/15 border-emerald-500/30" },
  }[p];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
      {cfg.icon} {POTENCIAL_LABEL[p]}
    </span>
  );
}

function StatusBadge({ s }: { s: LeadStatusCrm }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_CRM_COLOR[s]}`}>
      {STATUS_CRM_LABEL[s]}
    </span>
  );
}

function LeadDrawer({ lead, onClose }: { lead: LeadQualificado | null; onClose: () => void }) {
  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead?.nome ?? "Lead"}</SheetTitle>
        </SheetHeader>
        {lead && <LeadDrawerBody lead={lead} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function LeadDrawerBody({ lead, onClose }: { lead: LeadQualificado; onClose: () => void }) {
  const qc = useQueryClient();
  const update = useServerFn(atualizarLeadCrm);
  const histFn = useServerFn(listarHistoricoLead);
  const delFn = useServerFn(excluirLead);
  const libCatFn = useServerFn(liberarCatalogoLead);

  const [statusCrm, setStatusCrm] = useState<LeadStatusCrm>(lead.statusCrm);
  const [tagsRaw, setTagsRaw] = useState(lead.tags.join(", "));
  const [notas, setNotas] = useState(lead.notasInternas ?? "");
  const [catalogoLiberado, setCatalogoLiberado] = useState(lead.catalogoLiberado);

  const histQ = useQuery({
    queryKey: ["lead-historico", lead.id],
    queryFn: () => histFn({ data: { leadId: lead.id } }),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      update({
        data: {
          id: lead.id,
          statusCrm,
          tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
          notasInternas: notas || null,
        },
      }),
    onSuccess: () => {
      toast.success("CRM atualizado");
      qc.invalidateQueries({ queryKey: ["leads-qualificados"] });
      qc.invalidateQueries({ queryKey: ["lead-historico", lead.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => delFn({ data: { id: lead.id } }),
    onSuccess: () => {
      toast.success("Lead excluído");
      qc.invalidateQueries({ queryKey: ["leads-qualificados"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const libCatMut = useMutation({
    mutationFn: (liberar: boolean) => libCatFn({ data: { id: lead.id, liberar } }),
    onSuccess: (_, liberar) => {
      toast.success(liberar ? "Catálogo liberado para este lead" : "Acesso ao catálogo revogado");
      setCatalogoLiberado(liberar);
      qc.invalidateQueries({ queryKey: ["leads-qualificados"] });
      qc.invalidateQueries({ queryKey: ["lead-historico", lead.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const whatsappNumber = lead.whatsapp.replace(/\D/g, "").replace(/^55/, "");
  const whatsappLink = `https://wa.me/55${whatsappNumber}`;
  const instaLink = lead.instagram
    ? `https://instagram.com/${lead.instagram.replace(/^@/, "")}`
    : null;
  const catalogoUrl = `${window.location.origin}/catalog`;

  return (
    <Tabs defaultValue="perfil" className="mt-4">
      <TabsList className="w-full">
        <TabsTrigger value="perfil" className="flex-1"><UserIcon className="h-3 w-3 mr-1" />Perfil</TabsTrigger>
        <TabsTrigger value="crm" className="flex-1"><Settings2 className="h-3 w-3 mr-1" />CRM</TabsTrigger>
        <TabsTrigger value="historico" className="flex-1"><HistoryIcon className="h-3 w-3 mr-1" />Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="perfil" className="space-y-3 mt-4 text-sm">
        <KV k="WhatsApp" v={<a href={whatsappLink} target="_blank" rel="noreferrer" className="text-gold inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{lead.whatsapp}</a>} />
        {lead.instagram && <KV k="Instagram" v={<a href={instaLink!} target="_blank" rel="noreferrer" className="text-gold">{lead.instagram}</a>} />}
        {lead.email && <KV k="E-mail" v={lead.email} />}
        {(lead.cidade || lead.uf) && <KV k="Cidade" v={`${lead.cidade ?? ""}${lead.uf ? " / " + lead.uf : ""}`} />}
        <KV k="Origem" v={ORIGEM_LABEL[lead.origem]} />
        <KV k="Cadastrado em" v={new Date(lead.criadoEm).toLocaleString("pt-BR")} />

        <div className="pt-3 mt-3 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">Qualificação</div>
          <KV k="Segmento" v={SEGMENTO_LABEL[lead.segmento]} />
          {lead.frequencia && <KV k="Frequência" v={FREQUENCIA_LABEL[lead.frequencia]} />}
          {lead.volumeEstimado && <KV k="Volume" v={VOLUME_LABEL[lead.volumeEstimado]} />}
          {lead.urgencia != null && <KV k="Urgência" v={`${lead.urgencia} / 5`} />}
          {lead.produtosInteresse.length > 0 && (
            <KV k="Produtos" v={lead.produtosInteresse.join(" · ")} />
          )}
          {lead.observacoes && <KV k="Observações" v={lead.observacoes} />}
        </div>

        <div className="pt-3 mt-3 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">Score</div>
          <div className="flex items-center gap-3">
            <PotencialBadge p={lead.potencial} />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gold" style={{ width: `${lead.score}%` }} />
            </div>
            <span className="tabular-nums text-text-secondary">{lead.score}%</span>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">Acesso ao catálogo</div>
          <div className="flex items-center gap-2 mb-2">
            {catalogoLiberado ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> Liberado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-text-secondary bg-muted border border-border px-2 py-0.5 rounded-full">
                <Lock className="h-3 w-3" /> Bloqueado
              </span>
            )}
          </div>
          {catalogoLiberado && (
            <div className="flex items-center gap-2 mb-2">
              <input
                readOnly
                value={catalogoUrl}
                className="flex-1 text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-text-secondary"
              />
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => {
                  navigator.clipboard.writeText(catalogoUrl);
                  toast.success("Link copiado");
                }}
              >
                Copiar
              </Button>
            </div>
          )}
          <Button
            variant={catalogoLiberado ? "ghost" : "default"}
            size="sm"
            className="text-xs"
            onClick={() => libCatMut.mutate(!catalogoLiberado)}
            disabled={libCatMut.isPending}
          >
            {libCatMut.isPending
              ? "Processando..."
              : catalogoLiberado
                ? "Revogar acesso ao catálogo"
                : "Liberar acesso ao catálogo"}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="crm" className="space-y-4 mt-4">
        <div>
          <Label>Status</Label>
          <Select value={statusCrm} onValueChange={(v) => setStatusCrm(v as LeadStatusCrm)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CRM_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tags (separadas por vírgula)</Label>
          <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="b2b-potencial, vip, feira" />
        </div>
        <div>
          <Label>Notas internas (nunca exibidas ao lead)</Label>
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={5} maxLength={4000} />
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => {
            if (confirm("Excluir este lead permanentemente?")) deleteMut.mutate();
          }}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Salvando..." : "Salvar CRM"}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="historico" className="mt-4 space-y-2 text-sm">
        {histQ.isLoading && <div className="text-text-secondary">Carregando...</div>}
        {histQ.data?.length === 0 && (
          <div className="text-text-secondary">Sem eventos registrados.</div>
        )}
        {histQ.data?.map((h) => (
          <div key={h.id} className="rounded-md border border-border bg-surface p-3">
            <div className="text-xs text-text-secondary">
              {new Date(h.criadoEm).toLocaleString("pt-BR")} · {h.usuarioNome}
            </div>
            <div className="mt-1">{h.descricao}</div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 text-sm">
      <span className="text-text-secondary">{k}:</span>
      <span className="text-text-primary">{v}</span>
    </div>
  );
}
