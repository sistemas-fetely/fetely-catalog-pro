import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LockKeyhole,
  LockKeyholeOpen,
  ArrowLeftRight,
  Trash2,
  ChevronDown,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getColecaoPhoto, getProdutoPhoto, usePhotos } from "@/store/photoStore";
import { PhotoPlaceholder } from "@/components/photos/PhotoPlaceholder";
import { formatBRL, halfBox } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KitSugestao, ItemSugestao } from "@/lib/sugestaoPedido";
import type { Product } from "@/types";

export function FotoKit({ kit, className = "" }: { kit: KitSugestao; className?: string }) {
  const photos = usePhotos();
  const foto =
    getColecaoPhoto(photos, kit.colecao, kit.itens[0]?.produto.categoria) ??
    getProdutoPhoto(photos, kit.colecao, kit.itens[0]?.produto.sku ?? "");
  return foto ? (
    <img
      loading="lazy"
      src={foto}
      alt={kit.nome}
      className={cn("h-full w-full object-cover", className)}
    />
  ) : (
    <PhotoPlaceholder colecao={kit.colecao} className={cn("h-full w-full", className)} />
  );
}
export function FotoPeca({ produto }: { produto: Product }) {
  const photos = usePhotos();
  const foto =
    getProdutoPhoto(photos, produto.colecao, produto.sku) ??
    getProdutoPhoto(photos, produto.colecao, produto.corNome);
  return foto ? (
    <img
      loading="lazy"
      src={foto}
      alt={produto.nomeComercial}
      className="h-full w-full object-contain"
    />
  ) : (
    <PhotoPlaceholder colecao={produto.colecao} className="h-full w-full" />
  );
}
export function AcaoKit({
  label,
  onClick,
  children,
  ativo = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  ativo?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn("h-9 w-9 shrink-0 active:scale-[0.97]", ativo && "text-gold bg-gold/10")}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function SugestaoKitCard({
  kit,
  base,
  onChange,
  onLock,
  onSwap,
  onRemove,
}: {
  kit: KitSugestao;
  base: KitSugestao;
  onChange: (itens: ItemSugestao[]) => void;
  onLock: () => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const reduzido = useReducedMotion();
  const alterar = (p: Product, delta: number) =>
    onChange(
      kit.itens.map((i) =>
        i.produto.sku === p.sku
          ? {
              ...i,
              quantidade: Math.max(
                halfBox(p.multiplos),
                i.quantidade + delta * halfBox(p.multiplos),
              ),
            }
          : i,
      ),
    );
  return (
    <motion.article
      layout={!reduzido}
      whileHover={reduzido ? {} : { y: -2 }}
      initial={{ opacity: 0, y: reduzido ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: reduzido ? 1 : 0.97 }}
      transition={{ duration: reduzido ? 0 : 0.22 }}
      className={cn(
        "group min-w-0 overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg",
        kit.travado ? "border-gold" : "border-border",
      )}
      data-kit-id={kit.id}
      data-travado={kit.travado}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        <FotoKit
          kit={kit}
          className="transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
        />
        {kit.travado && (
          <span className="absolute top-3 left-3 flex items-center gap-1 rounded bg-background/90 px-2 py-1 text-xs text-gold">
            <LockKeyhole className="size-3" /> Travado
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between gap-2 items-start">
          <h4 className="font-display text-2xl leading-tight break-words">{kit.nome}</h4>
          <AcaoKit
            label={`${kit.travado ? "Destravar" : "Travar"} ${kit.nome}`}
            onClick={onLock}
            ativo={kit.travado}
          >
            {kit.travado ? (
              <LockKeyhole className="size-4" />
            ) : (
              <LockKeyholeOpen className="size-4" />
            )}
          </AcaoKit>
        </div>
        <p className="text-xs text-gold">{kit.motivo}</p>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3 shrink-0">
            {kit.itens.slice(0, 4).map((i) => (
              <div
                key={i.produto.sku}
                className="size-9 overflow-hidden rounded-full border-2 border-card bg-surface-2"
              >
                <FotoPeca produto={i.produto} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {kit.itens.length} peças · {kit.itens.reduce((s, i) => s + i.quantidade, 0)} un.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="font-display text-xl text-gold">{formatBRL(kit.custo)}</span>
          <div className="flex items-center">
            <AcaoKit label={`Trocar kit ${kit.nome}`} onClick={onSwap}>
              <ArrowLeftRight className="size-4" />
            </AcaoKit>
            <AcaoKit label={`Remover kit ${kit.nome}`} onClick={onRemove}>
              <Trash2 className="size-4" />
            </AcaoKit>
            <Button
              variant="ghost"
              size="icon"
              aria-expanded={expandido}
              aria-label={`Ver peças de ${kit.nome}`}
              onClick={() => setExpandido((v) => !v)}
            >
              <ChevronDown
                className={cn("size-4 transition-transform", expandido && "rotate-180")}
              />
            </Button>
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduzido ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border divide-y divide-border">
              {base.itens.map((original) => {
                const p = original.produto;
                const item = kit.itens.find((i) => i.produto.sku === p.sku);
                return (
                  <div key={p.sku} className={cn("py-3 flex gap-3 min-w-0", !item && "opacity-50")}>
                    <div className="size-16 shrink-0 bg-surface-2 rounded overflow-hidden">
                      <FotoPeca produto={p} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <label className="flex gap-2 text-sm items-start">
                        <Checkbox
                          aria-label={`Incluir ${p.nomeComercial} ${p.sku}`}
                          checked={!!item}
                          onCheckedChange={(v) =>
                            onChange(
                              v
                                ? [...kit.itens, original]
                                : kit.itens.filter((i) => i.produto.sku !== p.sku),
                            )
                          }
                        />
                        <span className="break-words">{p.nomeComercial}</span>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {p.corNome} · {p.tamanhoNumero} {p.tamanhoRef} · {formatBRL(p.precoAtacado)}
                        /un.
                      </p>
                      {item && (
                        <div className="inline-flex items-center rounded-full border border-border overflow-hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full"
                            aria-label={`Diminuir ${p.sku}`}
                            onClick={() => alterar(p, -1)}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-10 text-center text-xs tabular-nums">
                            {item.quantidade}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full"
                            aria-label={`Aumentar ${p.sku}`}
                            disabled={item.quantidade >= original.quantidade * 2}
                            onClick={() => alterar(p, 1)}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
