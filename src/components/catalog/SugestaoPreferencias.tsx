import { motion, useReducedMotion } from "framer-motion";
import { Check, Heart, Ban, Boxes, Sparkles, TrendingUp, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getColecaoPhoto, usePhotos } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { FotoKit } from "./SugestaoKitCard";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import {
  GRUPOS_SUGESTAO,
  faixaSugestao,
  dicaFaixa,
  type PreferenciasSugestao,
  type KitSugestao,
  type FaixaSugestao,
} from "@/lib/sugestaoPedido";
export const SECOES_PREFERENCIAS = [
  "Investimento",
  "Mix",
  "Profundidade",
  "Estilo",
  "Coleções",
  "Entrega",
] as const;
export type SecaoPreferencias = (typeof SECOES_PREFERENCIAS)[number];
export function SugestaoPreferencias({
  pref,
  patch,
  kits,
  faixas,
  secao,
}: {
  pref: PreferenciasSugestao;
  patch: (p: Partial<PreferenciasSugestao>) => void;
  kits: KitSugestao[];
  faixas: FaixaSugestao[];
  secao?: SecaoPreferencias;
}) {
  const photos = usePhotos();
  const reduzido = useReducedMotion();
  const faixa = faixaSugestao(pref.investimento, faixas);
  const dica = dicaFaixa(pref.investimento, faixas);
  const colecoes = [...new Set(kits.map((k) => k.colecao))].sort((a, b) => a.localeCompare(b));
  const mostrar = (s: SecaoPreferencias) => !secao || secao === s;
  const colecao = (campo: "preferidas" | "excluidas", col: string) =>
    patch({
      [campo]: pref[campo].includes(col)
        ? pref[campo].filter((c) => c !== col)
        : [...pref[campo], col],
      [campo === "preferidas" ? "excluidas" : "preferidas"]: pref[
        campo === "preferidas" ? "excluidas" : "preferidas"
      ].filter((c) => c !== col),
    });
  return (
    <div className="space-y-7">
      {mostrar("Investimento") && (
        <section className="space-y-3">
          <h3 className="text-xs uppercase text-muted-foreground">Investimento · atacado</h3>
          <div className="flex items-center gap-2 font-display text-3xl text-gold">
            <span>R$</span>
            <Input
              id="sugestao-investimento"
              aria-label="Investimento em reais"
              type="number"
              min={1000}
              max={30000}
              step={100}
              value={pref.investimento}
              className="border-0 border-b border-gold/30 rounded-none p-0 h-12 bg-transparent text-3xl md:text-3xl font-display shadow-none"
              onChange={(e) => patch({ investimento: Number(e.target.value) })}
              onBlur={() =>
                patch({ investimento: Math.max(1000, Math.min(30000, pref.investimento || 1000)) })
              }
            />
          </div>
          <div className="relative">
            <Slider
              aria-label="Investimento"
              className="py-2"
              min={1000}
              max={30000}
              step={100}
              value={[pref.investimento]}
              onValueChange={(v) => patch({ investimento: v[0] ?? 2500 })}
            />
            <svg
              viewBox="0 0 100 4"
              preserveAspectRatio="none"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 w-full pointer-events-none text-gold"
              aria-hidden="true"
            >
              {faixas.map((f) => (
                <rect
                  key={f.nome}
                  x={((f.valor_min - 1000) / 29000) * 100}
                  width={0.4}
                  height={4}
                  fill="currentColor"
                />
              ))}
            </svg>
          </div>
          <div
            className="grid grid-cols-4 gap-1 text-[9px] text-muted-foreground"
            aria-label="Faixas comerciais"
          >
            {faixas.map((f) => (
              <Button
                key={f.nome}
                variant="ghost"
                className="h-auto p-0 flex-col text-[9px] gap-0"
                onClick={() => patch({ investimento: f.valor_min })}
              >
                <span className="text-gold">│</span>
                {f.nome}
                <span>{formatBRL(f.valor_min)}</span>
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[2000, 5000, 10000, 20000].map((valor) => (
              <Button
                key={valor}
                variant="outline"
                size="sm"
                className="text-xs px-1"
                onClick={() => patch({ investimento: valor })}
              >
                R$ {valor / 1000} mil
              </Button>
            ))}
          </div>
          {faixa && (
            <p className="text-xs text-gold">
              {faixa.nome} · {faixa.desconto_celebra}% de desconto · Frete {faixa.frete}
            </p>
          )}
          {dica && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Faltam {formatBRL(dica.falta)} para {dica.faixa.nome} (+{dica.descontoExtra}%
                {dica.faixa.frete === "CIF" ? " / frete CIF" : ""})
              </p>
              <progress
                className="w-full h-1 accent-gold"
                value={pref.investimento}
                max={dica.faixa.valor_min}
              />
            </div>
          )}
        </section>
      )}
      {mostrar("Mix") && (
        <section>
          <h3 className="text-xs uppercase text-muted-foreground mb-3">O que quer no pedido</h3>
          <div className="grid grid-cols-2 gap-2">
            {GRUPOS_SUGESTAO.map((g) => {
              const kit = kits.find((k) => k.grupo === g);
              const selecionado = !!pref.grupos[g];
              return (
                <div
                  key={g}
                  className={cn(
                    "relative rounded-md border overflow-hidden",
                    selecionado ? "border-gold" : "border-border",
                  )}
                >
                  <Button
                    variant="ghost"
                    aria-pressed={selecionado}
                    aria-label={`Selecionar ${g}`}
                    className="w-full h-auto p-0 flex-col gap-0 rounded-none"
                    onClick={() => patch({ grupos: { ...pref.grupos, [g]: selecionado ? 0 : 1 } })}
                  >
                    <div className="aspect-[16/9] w-full bg-surface-2 overflow-hidden">
                      {kit ? (
                        <FotoKit kit={kit} />
                      ) : (
                        <PhotoPlaceholder colecao={g} className="h-full w-full" />
                      )}
                    </div>
                    <span className="text-xs py-2 whitespace-normal">{g}</span>
                  </Button>
                  {selecionado && (
                    <motion.span
                      initial={{ scale: reduzido ? 1 : 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1.5 right-1.5 rounded-full bg-primary text-primary-foreground p-1"
                    >
                      <Check className="size-3" />
                    </motion.span>
                  )}
                  {selecionado && (
                    <div className="flex justify-center pb-1" role="group" aria-label={`Peso ${g}`}>
                      {[0.5, 1, 2].map((peso, i) => (
                        <Tooltip key={peso}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              className={cn(
                                "h-7 px-1.5 text-xs",
                                pref.grupos[g] === peso && "text-gold bg-gold/10",
                              )}
                              aria-label={`${g}: ${["Pouco", "Equilibrado", "Muito"][i]}`}
                              aria-pressed={pref.grupos[g] === peso}
                              onClick={() => patch({ grupos: { ...pref.grupos, [g]: peso } })}
                            >
                              {["●○○", "●●○", "●●●"][i]}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{["Pouco", "Equilibrado", "Muito"][i]}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {mostrar("Profundidade") && (
        <section className="space-y-3">
          <h3 className="text-xs uppercase text-muted-foreground">Profundidade por kit</h3>
          <div className="grid grid-cols-4 rounded-md border border-border p-1 gap-1">
            {(["meia", "uma", "duas", "personalizado"] as const).map((p, i) => (
              <Button
                key={p}
                variant={pref.profundidade === p ? "default" : "ghost"}
                className="px-1 gap-1"
                aria-label={`Profundidade ${["meia caixa", "1 caixa", "2 caixas", "personalizada"][i]}`}
                aria-pressed={pref.profundidade === p}
                onClick={() => patch({ profundidade: p })}
              >
                <Boxes className="size-3" />
                {["½", "1", "2", "+"][i]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            ≈{" "}
            {Math.round(
              kits.flatMap((k) => k.itens).reduce((s, i) => s + i.quantidade, 0) /
                Math.max(1, kits.flatMap((k) => k.itens).length),
            )}{" "}
            un. por item
          </p>
          {pref.profundidade === "personalizado" && (
            <Input
              aria-label="Número de caixas"
              type="number"
              min={1}
              max={100}
              value={pref.caixas}
              onChange={(e) =>
                patch({ caixas: Math.max(1, Math.min(100, Number(e.target.value))) })
              }
            />
          )}
        </section>
      )}
      {mostrar("Estilo") && (
        <section className="space-y-2">
          <h3 className="text-xs uppercase text-muted-foreground">Estilo do mix</h3>
          {(["vendidos", "equilibrado", "mesclado"] as const).map((v, i) => {
            const Icon = [TrendingUp, Sparkles, Compass][i] ?? Sparkles;
            return (
              <Button
                key={v}
                variant="outline"
                aria-pressed={pref.estilo === v}
                className={cn(
                  "w-full h-auto py-3 justify-start gap-3",
                  pref.estilo === v && "border-gold bg-gold/10",
                )}
                onClick={() => patch({ estilo: v })}
              >
                <Icon className="size-4 text-gold" />
                <span className="text-left">
                  <span className="block text-xs">
                    {["Mais vendidos", "Equilibrado", "Descobertas"][i]}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {
                      ["Os favoritos das lojas", "Sucessos e variedade", "Novas cores e coleções"][
                        i
                      ]
                    }
                  </span>
                </span>
              </Button>
            );
          })}
        </section>
      )}
      {mostrar("Coleções") && (
        <section className="space-y-3">
          <h3 className="text-xs uppercase text-muted-foreground">Coleções</h3>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1">
            {(["concentrar", "espalhar"] as const).map((v) => (
              <Button
                key={v}
                variant={pref.colecoes === v ? "default" : "ghost"}
                className="px-1 text-xs"
                onClick={() => patch({ colecoes: v })}
              >
                {v === "concentrar" ? "Concentrar" : "Espalhar"}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
            {colecoes.map((col) => {
              const foto = getColecaoPhoto(photos, col);
              const excluida = pref.excluidas.includes(col);
              return (
                <div key={col} className={cn("relative min-w-0", excluida && "opacity-40")}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-auto w-full p-0 flex-col gap-1",
                      pref.preferidas.includes(col) && "ring-1 ring-gold",
                    )}
                    aria-label={`Favoritar ${col}`}
                    aria-pressed={pref.preferidas.includes(col)}
                    onClick={() => colecao("preferidas", col)}
                  >
                    <div className="aspect-square w-full overflow-hidden rounded bg-surface-2">
                      {foto ? (
                        <img
                          loading="lazy"
                          src={foto}
                          alt={col}
                          className="size-full object-cover"
                        />
                      ) : (
                        <PhotoPlaceholder colecao={col} className="size-full" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] break-words whitespace-normal w-full",
                        excluida && "line-through",
                      )}
                    >
                      {col}
                    </span>
                  </Button>
                  {pref.preferidas.includes(col) && (
                    <Heart className="absolute top-1 left-1 size-3 fill-gold text-gold" />
                  )}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1 size-6"
                    aria-label={`${excluida ? "Liberar" : "Excluir"} ${col}`}
                    onClick={() => colecao("excluidas", col)}
                  >
                    <Ban className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {mostrar("Entrega") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="flex items-center justify-between gap-2 text-sm">
              Só pronta entrega
              <Switch
                aria-label="Só pronta entrega"
                checked={pref.prontaEntrega}
                onCheckedChange={(v) => patch({ prontaEntrega: v })}
              />
            </label>
          </TooltipTrigger>
          <TooltipContent>Apenas itens sinalizados como pronta entrega no catálogo.</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
