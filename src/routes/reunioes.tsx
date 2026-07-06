import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link as LinkIcon, MessageCircle, Copy, QrCode, Trash2, CheckCircle2, Eye, ArrowRight, X } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/store/authStore";
import { usePreSelecao, usePreSelecoesEscopo } from "@/store/preSelecaoStore";
import { useCatalog } from "@/store/catalogStore";
import { useCotacao } from "@/store/cotacaoStore";
import { STATUS_PRE_LABEL, SEGMENTO_LABEL, type StatusPreSelecao, type PreSelecao } from "@/types/preSelecao";
import type { CartItem, OrderMeta } from "@/types";
import { formatBRL } from "@/lib/format";
import { tempoRestante, PUBLIC_SITE_URL } from "@/lib/preSelecao";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reunioes")({
  head: () => ({
    meta: [{ title: "Reuniões — Fetély B2B" }],
  }),
  component: ReunioesPage,
});

const TABS: { key: StatusPreSelecao | "todas"; label: string }[] = [
  { key: "nova", label: "Novas" },
  { key: "visualizada", label: "Visualizadas" },
  { key: "em_contato", label: "Em contato" },
  { key: "convertida", label: "Convertidas" },
  { key: "todas", label: "Todas" },
];

function ReunioesPage() {
  const hydrate = usePreSelecao((s) => s.hydrate);
  const refresh = usePreSelecao((s) => s.refresh);
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  useEffect(() => { hydrate(); }, [hydrate, session?.user.id, profile?.id]);
  useEffect(() => {
    if (!session) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, session]);

  const todas = usePreSelecoesEscopo();
  const [tab, setTab] = useState<StatusPreSelecao | "todas">("nova");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<PreSelecao | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const filtradas = useMemo(() => {
    let out = todas;
    if (tab !== "todas") out = out.filter((p) => p.status === tab);
    const q = busca.trim().toLowerCase();
    if (q) {
      out = out.filter((p) =>
        `${p.nomeFantasia} ${p.razaoSocial} ${p.cnpj} ${p.contatoNome} ${p.id}`.toLowerCase().includes(q),
      );
    }
    return out.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
  }, [todas, tab, busca]);

  const kpis = useMemo(() => {
    const novas = todas.filter((p) => p.status === "nova").length;
    const valorPotencial = todas
      .filter((p) => ["nova", "visualizada", "em_contato"].includes(p.status))
      .reduce((s, p) => s + p.totalVarejoRef, 0);
    const convertidas = todas.filter((p) => p.status === "convertida").length;
    const total = todas.length || 1;
    return { novas, valorPotencial, taxa: Math.round((convertidas / total) * 100) };
  }, [todas]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: todas.length };
    for (const p of todas) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [todas]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl">Reuniões</h1>
          <p className="text-sm text-text-secondary">Pré-seleções recebidas do catálogo público</p>
        </div>
        <div className="md:ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setLinkModalOpen(true)}>
            <LinkIcon className="h-4 w-4" />
            Gerar meu link
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Novas" value={String(kpis.novas)} accent={kpis.novas > 0} />
        <KpiCard label="Valor ref. potencial" value={formatBRL(kpis.valorPotencial)} />
        <KpiCard label="Taxa de conversão" value={`${kpis.taxa}%`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border transition",
              tab === t.key
                ? "bg-gold text-background border-gold"
                : "border-border text-text-secondary hover:border-gold/40 hover:text-gold",
            )}
          >
            {t.label} {counts[t.key] > 0 && <span className="opacity-70">({counts[t.key]})</span>}
            {t.key === "nova" && counts["nova"] > 0 && <span className="inline-block ml-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
          </button>
        ))}
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresa, CNPJ..."
          className="ml-auto max-w-xs h-9"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Empresa</th>
              <th className="text-left px-3 py-2">Itens</th>
              <th className="text-left px-3 py-2">Ref. Varejo</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Expira em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-text-secondary text-sm">
                  Nenhuma pré-seleção nesta aba.
                </td>
              </tr>
            ) : (
              filtradas.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-border hover:bg-surface-hover cursor-pointer"
                  onClick={() => setSelecionada(p)}
                >
                  <td className="px-3 py-3 font-mono text-xs">{p.id}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{p.nomeFantasia}</div>
                    <div className="text-xs text-text-secondary">{p.cidadeEstado} · {SEGMENTO_LABEL[p.segmento]}</div>
                  </td>
                  <td className="px-3 py-3">
                    {p.totalItens} · {p.totalUnidades} un
                  </td>
                  <td className="px-3 py-3 text-gold">{formatBRL(p.totalVarejoRef)}</td>
                  <td className="px-3 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-3 py-3 text-xs text-text-secondary">{tempoRestante(p)}</td>
                  <td className="px-3 py-3">
                    <Eye className="h-4 w-4 text-text-muted" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selecionada} onOpenChange={(v) => !v && setSelecionada(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {selecionada && (
            <PreSelecaoDetail
              pre={selecionada}
              onClose={() => setSelecionada(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <GerarLinkModal open={linkModalOpen} onOpenChange={setLinkModalOpen} />
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-widest text-text-secondary">{label}</div>
        <div className={cn("mt-1 font-display text-2xl", accent && "text-red-500")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: StatusPreSelecao }) {
  const cls: Record<StatusPreSelecao, string> = {
    nova: "bg-red-500/15 text-red-500 border-red-500/30",
    visualizada: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    em_contato: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    convertida: "bg-green-500/15 text-green-600 border-green-500/30",
    expirada: "bg-muted text-text-muted border-border",
    descartada: "bg-muted text-text-muted border-border",
  };
  return (
    <span className={cn("inline-flex px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border", cls[status])}>
      {STATUS_PRE_LABEL[status]}
    </span>
  );
}

function PreSelecaoDetail({ pre, onClose }: { pre: PreSelecao; onClose: () => void }) {
  const marcarVisualizada = usePreSelecao((s) => s.marcarVisualizada);
  const atualizarStatus = usePreSelecao((s) => s.atualizarStatus);
  const vincularCotacao = usePreSelecao((s) => s.vincularCotacao);
  const descartar = usePreSelecao((s) => s.descartar);
  const catalogProducts = useCatalog((s) => s.products);
  const criarCotacao = useCotacao((s) => s.criarCotacao);
  const profile = useAuth((s) => s.profile);
  const [convertendo, setConvertendo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (pre.status === "nova") marcarVisualizada(pre.id);
  }, [pre.id, pre.status, marcarVisualizada]);


  function whatsappLink() {
    const num = pre.contatoWhatsapp.replace(/\D/g, "");
    const msg = `Olá ${pre.contatoNome}! Recebemos sua pré-seleção #${pre.id} com ${pre.totalItens} produtos. Vamos conversar?`;
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  function copiarLista() {
    const linhas = pre.itens.map((i) =>
      i.temInteresseSemQtd
        ? `♡ ${i.nomeComercial} (${i.corNome}) — interesse sem qtd`
        : `• ${i.quantidade} un · ${i.nomeComercial} (${i.corNome}) — ${formatBRL(i.subtotalVarejo)}`,
    );
    const texto = `Pré-seleção #${pre.id}\n${pre.nomeFantasia}\n\n${linhas.join("\n")}\n\nRef. varejo: ${formatBRL(pre.totalVarejoRef)}`;
    navigator.clipboard.writeText(texto);
    toast.success("Lista copiada");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div>
          <div className="text-xs text-text-secondary">#{pre.id}</div>
          <h2 className="font-display text-xl">{pre.nomeFantasia}</h2>
          <div className="text-xs text-text-secondary">{pre.razaoSocial}</div>
        </div>
        <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs uppercase tracking-wider text-gold-muted mb-2">Empresa</h3>
          <dl className="text-sm space-y-1">
            <Row k="CNPJ" v={pre.cnpj} />
            <Row k="Segmento" v={SEGMENTO_LABEL[pre.segmento]} />
            <Row k="Cidade" v={pre.cidadeEstado} />
            <Row k="Contato" v={`${pre.contatoNome}${pre.contatoCargo ? ` (${pre.contatoCargo})` : ""}`} />
            <Row k="WhatsApp" v={pre.contatoWhatsapp} />
            <Row k="E-mail" v={pre.contatoEmail} />
            <Row k="Vendedor" v={pre.vendedorId ?? "—"} />
            <Row k="Expira" v={tempoRestante(pre)} />
          </dl>
          {pre.observacao && (
            <div className="mt-3 p-3 bg-surface-2 rounded-md text-sm italic text-text-secondary">
              "{pre.observacao}"
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-gold-muted mb-2">
            Lista de interesse ({pre.totalItens} itens · {pre.totalUnidades} un)
          </h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {pre.itens.map((i, idx) => (
              <li key={idx} className="px-3 py-2 text-sm flex gap-2">
                <div className="w-8 text-center text-xs text-gold-muted uppercase tracking-wider">
                  {i.temInteresseSemQtd ? "♡" : i.colecao.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{i.nomeComercial}</div>
                  <div className="text-xs text-text-secondary">
                    {i.corNome}{i.tamanhoNumero && ` · ${i.tamanhoNumero}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {i.temInteresseSemQtd ? <span className="text-gold text-xs">sem qtd</span> : `${i.quantidade} un`}
                  </div>
                  {!i.temInteresseSemQtd && (
                    <div className="text-xs text-text-secondary">{formatBRL(i.subtotalVarejo)}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-text-secondary">Total ref. varejo</span>
            <span className="font-semibold text-gold">{formatBRL(pre.totalVarejoRef)}</span>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-gold-muted">Ações</h3>
          <Button
            className="w-full bg-gold hover:bg-gold-light text-background justify-start"
            onClick={() => {
              // TODO Fase 2: pré-popular cotacaoStore com itens e cliente
              toast.info("Abrindo módulo de cotação...");
              navigate({ to: "/cotacoes" });
            }}
          >
            <ArrowRight className="h-4 w-4" /> Converter em Cotação
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <a href={whatsappLink()} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
            </a>
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={copiarLista}>
            <Copy className="h-4 w-4" /> Copiar lista de interesse
          </Button>
          {pre.status !== "em_contato" && pre.status !== "convertida" && (
            <Button variant="outline" className="w-full justify-start" onClick={() => atualizarStatus(pre.id, "em_contato")}>
              <CheckCircle2 className="h-4 w-4" /> Marcar "Em contato"
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-500" onClick={() => { descartar(pre.id); onClose(); }}>
            <Trash2 className="h-4 w-4" /> Descartar
          </Button>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 text-text-secondary">{k}:</dt>
      <dd className="flex-1 min-w-0 truncate">{v}</dd>
    </div>
  );
}

function GerarLinkModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const profile = useAuth((s) => s.profile);
  const login = profile?.login_amigavel || profile?.codigo_vendedor || "";
  const [qr, setQr] = useState<string>("");

  const link = useMemo(() => {
    return login ? `${PUBLIC_SITE_URL}/pre-selecao?v=${login}` : `${PUBLIC_SITE_URL}/pre-selecao`;
  }, [login]);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [open, link]);

  const waMsg = `Olá! Aqui é ${profile?.nome_completo ?? "da Fetély"} 🌟\n\nAntes da nossa reunião, preparei nosso catálogo interativo para você.\n\nNavegue pelos nossos produtos, marque os que têm interesse e nos envie sua lista — assim chegamos na nossa conversa já sabendo o que faz sentido para a sua loja.\n\n👉 ${link}\n\nQualquer dúvida, é só chamar!`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seu link de pré-seleção</DialogTitle>
          <DialogDescription>Compartilhe com clientes antes da reunião.</DialogDescription>
        </DialogHeader>
        <div className="p-3 bg-surface-2 rounded-md text-sm break-all font-mono">{link}</div>
        {qr && (
          <div className="flex justify-center py-2">
            <img src={qr} alt="QR Code" className="rounded-md bg-white p-2" />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
            <Copy className="h-4 w-4" /> Copiar
          </Button>
          <Button variant="outline" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={qr} download={`fetely-preselecao-${login || "link"}.png`}>
              <QrCode className="h-4 w-4" /> Baixar QR
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
