import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Sparkles } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  criarLeadPublico,
  registrarAceiteCondicoes,
  salvarRascunhoFormulario,
} from "@/lib/leads.functions";
import {
  FREQUENCIA_LABEL,
  ORIGEM_LABEL,
  SEGMENTO_LABEL,
  VOLUME_LABEL,
  type LeadFrequencia,
  type LeadOrigem,
  type LeadSegmento,
  INTENCAO_LABEL,
  SEGMENTOS_FORMULARIO,
  type LeadFrequencia as _LF,
  type LeadIntencaoSequencia,
  type LeadVolumeEstimado,
} from "@/types/lead";

export const Route = createFileRoute("/qualificacao")({
  head: () => ({
    meta: [
      { title: "Qualificação — Fetély" },
      {
        name: "description",
        content:
          "Cadastre seu interesse e receba uma experiência Fetély personalizada.",
      },
    ],
  }),
  component: QualificacaoPage,
});

const PRODUTOS_OPCOES = [
  "Velas decorativas",
  "Velas numéricas",
  "Pratos",
  "Mesa posta completa",
  "Centros de mesa",
  "Acessórios",
  "Coleções sazonais",
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function QualificacaoPage() {
  const criar = useServerFn(criarLeadPublico);
  const aceitar = useServerFn(registrarAceiteCondicoes);
  const rascunho = useServerFn(salvarRascunhoFormulario);
  const [etapa, setEtapa] = useState<"form" | "condicoes" | "fim">("form");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [aceite, setAceite] = useState<"seguir" | "agora_nao" | null>(null);
  const sessaoId = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-0000-4000-8000-000000000000`,
    [],
  );
  // Antes da hidratação o onSubmit React não existe: o navegador fazia um
  // submit nativo (GET) e o cadastro era perdido silenciosamente.
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState<string>("");
  const [segmento, setSegmento] = useState<LeadSegmento>("lojista");
  const [frequencia, setFrequencia] = useState<LeadFrequencia | "">("");
  const [volume, setVolume] = useState<LeadVolumeEstimado | "">("");
  const [urgencia, setUrgencia] = useState(3);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [origem, setOrigem] = useState<LeadOrigem>("instagram");
  const [obs, setObs] = useState("");
  const [intencao, setIntencao] = useState<LeadIntencaoSequencia | "">("");

  // Registro silencioso do preenchimento em andamento (sem feedback na tela).
  const snapshot = useMemo(
    () => ({
      nome, whatsapp, instagram, email, cidade, uf, segmento,
      frequencia, volume, urgencia, produtos, origem, obs, intencao,
    }),
    [nome, whatsapp, instagram, email, cidade, uf, segmento, frequencia,
      volume, urgencia, produtos, origem, obs, intencao],
  );
  useEffect(() => {
    if (!pronto) return;
    const preenchidos = Object.values(snapshot).filter((v) =>
      Array.isArray(v) ? v.length > 0 : v !== "" && v !== null && v !== undefined,
    ).length;
    if (preenchidos === 0) return;
    const t = setTimeout(() => {
      void rascunho({
        data: {
          sessaoId,
          dados: snapshot as Record<string, unknown>,
          campos: preenchidos,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
        },
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [snapshot, pronto, rascunho, sessaoId]);

  const mut = useMutation({
    mutationFn: () =>
      criar({
        data: {
          nome,
          whatsapp,
          instagram: instagram || null,
          email: email || null,
          cidade: cidade || null,
          uf: uf || null,
          segmento,
          frequencia: (frequencia || null) as LeadFrequencia | null,
          volumeEstimado: (volume || null) as LeadVolumeEstimado | null,
          urgencia,
          produtosInteresse: produtos,
          origem,
          observacoes: obs || null,
          intencaoSequencia: (intencao || null) as LeadIntencaoSequencia | null,
        },
      }),
    onSuccess: (res) => {
      setLeadId(res.id);
      setEtapa("condicoes");
      void rascunho({
        data: {
          sessaoId,
          dados: snapshot as Record<string, unknown>,
          campos: 99,
          userAgent: null,
          enviado: true,
        },
      }).catch(() => {});
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar"),
  });

  function toggleProduto(p: string) {
    setProdutos((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) {
      toast.error("Informe seu nome");
      return;
    }
    if (whatsapp.trim().length < 8) {
      toast.error("Informe seu WhatsApp");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("E-mail inválido — corrija ou deixe em branco");
      return;
    }
    if (!intencao) {
      toast.error("Escolha como você quer dar sequência no atendimento");
      return;
    }
    mut.mutate();
  }

  const aceiteMut = useMutation({
    mutationFn: (v: "seguir" | "agora_nao") =>
      aceitar({ data: { id: leadId!, aceite: v } }),
    onSuccess: (_d, v) => {
      setAceite(v);
      setEtapa("fim");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao registrar"),
  });

  if (etapa === "condicoes") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 md:p-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs uppercase tracking-[0.25em] mb-4">
            <Sparkles className="h-3 w-3" /> Fetély
          </div>
          <h1 className="font-display text-2xl md:text-3xl text-text-primary">
            Cadastro recebido! Só mais uma coisa antes de seguirmos.
          </h1>
          <p className="mt-4 text-text-secondary text-sm">
            Nossos pedidos de atacado têm valor mínimo de{" "}
            <strong className="text-text-primary">R$ 1.500</strong>. Você
            gostaria de seguir com o atendimento?
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1"
              disabled={aceiteMut.isPending}
              onClick={() => aceiteMut.mutate("seguir")}
            >
              Sim, quero seguir
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={aceiteMut.isPending}
              onClick={() => aceiteMut.mutate("agora_nao")}
            >
              Agora não
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (etapa === "fim") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gold/15 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-gold" />
          </div>
          <h1 className="font-display text-3xl text-text-primary">
            Obrigado!
          </h1>
          <p className="mt-3 text-text-secondary">
            {aceite === "agora_nao"
              ? "Obrigado por avisar! Quando quiser retomar, estaremos por aqui."
              : "Recebemos seus dados. Em breve nosso time entrará em contato pelo WhatsApp."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs uppercase tracking-[0.25em] mb-4">
            <Sparkles className="h-3 w-3" /> Fetély
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-text-primary">
            Vamos te conhecer melhor
          </h1>
          <p className="mt-3 text-text-secondary text-sm">
            Conte um pouco sobre você e seus interesses. Em poucos minutos
            preparamos uma experiência personalizada.
          </p>
        </div>

        <form
          onSubmit={submit}
          method="post"
          action=""
          className="space-y-6 rounded-2xl border border-border bg-surface p-6 md:p-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} />
            </div>
            <div>
              <Label>WhatsApp *</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                required
                maxLength={30}
              />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@seuusuario"
                maxLength={80}
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={180}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label>UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Como você se enquadra? *</Label>
              <Select value={segmento} onValueChange={(v) => { setSegmento(v as LeadSegmento); setVolume(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_FORMULARIO.map((k) => (
                    <SelectItem key={k} value={k}>{SEGMENTO_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Como nos conheceu?</Label>
              <Select value={origem} onValueChange={(v) => setOrigem(v as LeadOrigem)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGEM_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequência de compra esperada</Label>
              <Select value={frequencia} onValueChange={(v) => setFrequencia(v as LeadFrequencia)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCIA_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Volume estimado por compra</Label>
              <Select value={volume} onValueChange={(v) => setVolume(v as LeadVolumeEstimado)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(segmento === "consumidor"
                    ? (["ate_500", "500_1500", "1500_3000", "nao_sei"] as LeadVolumeEstimado[])
                    : (["ate_2500", "2500_10k", "10k_50k", "acima_50k", "nao_sei"] as LeadVolumeEstimado[])
                  ).map((k) => (
                    <SelectItem key={k} value={k}>{VOLUME_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Urgência: {urgencia} / 5</Label>
            <input
              type="range"
              min={1}
              max={5}
              value={urgencia}
              onChange={(e) => setUrgencia(Number(e.target.value))}
              className="w-full mt-2 accent-[var(--color-gold,#caa55a)]"
            />
          </div>

          <div>
            <Label className="mb-2 block">Produtos de interesse</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRODUTOS_OPCOES.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={produtos.includes(p)}
                    onCheckedChange={() => toggleProduto(p)}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Algo a mais que queira nos contar?</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} maxLength={2000} />
          </div>

          <div>
            <Label className="mb-2 block">
              Como você gostaria de dar sequência no seu atendimento? *
            </Label>
            <div className="space-y-2">
              {(Object.keys(INTENCAO_LABEL) as LeadIntencaoSequencia[]).map((k) => (
                <label
                  key={k}
                  className={`flex items-center gap-3 text-sm cursor-pointer rounded-lg border px-3 py-2.5 transition ${
                    intencao === k
                      ? "border-gold bg-gold/5 text-text-primary"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="intencao_sequencia"
                    value={k}
                    checked={intencao === k}
                    onChange={() => setIntencao(k)}
                    className="accent-[var(--color-gold,#caa55a)]"
                  />
                  <span>{INTENCAO_LABEL[k]}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={mut.isPending || !pronto}
          >
            {!pronto
              ? "Carregando formulário..."
              : mut.isPending
                ? "Enviando..."
                : "Enviar cadastro"}
          </Button>
        </form>
      </div>
    </div>
  );
}
