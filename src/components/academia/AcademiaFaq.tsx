import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Loader2,
  MessageCircleQuestion,
  PlayCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { perguntarAcademia } from "@/lib/academiaAi.functions";
import { renderRichText } from "@/lib/academia";
import type { FaqResposta } from "@/lib/academia";

interface ConversaItem {
  pergunta: string;
  resultado: FaqResposta;
}

export function AcademiaFaq() {
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [historico, setHistorico] = useState<ConversaItem[]>([]);
  const perguntar = useServerFn(perguntarAcademia);

  async function enviar() {
    const p = pergunta.trim();
    if (p.length < 3 || carregando) return;
    setCarregando(true);
    try {
      const r = await perguntar({ data: { pergunta: p } });
      setHistorico((h) => [...h, { pergunta: p, resultado: r }]);
      setPergunta("");
    } catch (e) {
      toast.error("Não foi possível responder agora", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface p-5 md:p-6">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-gold" />
        <h2 className="font-display text-xl">Perguntas</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Inteligência artificial alimentada pela Academy e pelos cadastros do
        sistema — produtos, preços, estoque e previsões, cartilhas comerciais,
        condições de pagamento e frete por UF — com fonte do vídeo e do minuto
        exato.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void enviar();
          }}
          placeholder="Qual é a sua dúvida?"
          maxLength={600}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
        />
        <button
          onClick={() => void enviar()}
          disabled={carregando || pergunta.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-background transition hover:bg-gold-light disabled:opacity-50"
        >
          {carregando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Perguntar
        </button>
      </div>

      {carregando && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Consultando a base de conhecimento...
        </p>
      )}

      {historico.length > 0 && (
        <div className="mt-5 space-y-5">
          {historico.map((item, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-lg rounded-br-none bg-gold/15 px-3.5 py-2 text-sm text-text-primary">
                  {item.pergunta}
                </p>
              </div>

              <div
                className={`rounded-lg border p-4 ${
                  item.resultado.encontrou
                    ? "border-border bg-background"
                    : "border-amber-500/40 bg-amber-500/5"
                }`}
              >
                {!item.resultado.encontrou && (
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" /> Sem conteúdo direto
                  </p>
                )}
                <div
                  className="text-sm leading-relaxed text-text-primary [&_strong]:font-bold [&_h4]:text-gold"
                  dangerouslySetInnerHTML={{
                    __html: renderRichText(item.resultado.resposta),
                  }}
                />
              </div>

              {item.resultado.fontes.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-text-muted">
                    {item.resultado.encontrou
                      ? "Assista para entender melhor"
                      : "Conteúdo mais próximo"}
                  </p>
                  <ul className="space-y-2">
                    {item.resultado.fontes.map((f, i) => (
                      <li key={i}>
                        {f.modulo_id ? (
                          <Link
                            to="/academia/$moduloId"
                            params={{ moduloId: f.modulo_id }}
                            search={{
                              aula: f.aula_id ?? undefined,
                              t: f.timestamp ?? undefined,
                            }}
                            className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-gold/60"
                          >
                            <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-text-primary">
                                {f.modulo_titulo}
                                {f.aula_titulo ? ` · ${f.aula_titulo}` : ""}
                                {f.timestamp && (
                                  <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 font-mono text-[11px] text-gold">
                                    {f.timestamp}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block line-clamp-2 text-xs text-text-muted">
                                {f.trecho}
                              </span>
                            </span>
                          </Link>
                        ) : (
                          <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                            <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-text-primary">
                                {f.modulo_titulo}
                              </span>
                              <span className="mt-0.5 block line-clamp-2 text-xs text-text-muted">
                                {f.trecho}
                              </span>
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
