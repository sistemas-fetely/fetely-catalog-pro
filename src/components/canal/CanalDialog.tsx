import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle } from "lucide-react";

type CanalEvento = {
  id: string;
  tipo_evento: "msg_comercial" | "msg_sops";
  descricao: string | null;
  metadata: { autor_nome?: string } | null;
  operador_id: string | null;
  criado_em: string;
  lida_fop: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  sncfPedidoId: string;
  numeroPedido: string;
  nomeCliente: string;
}

const DATA_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtData(d: string): string {
  try {
    return DATA_FMT.format(new Date(d));
  } catch {
    return d;
  }
}

export function CanalDialog({
  open,
  onClose,
  sncfPedidoId,
  numeroPedido,
  nomeCliente,
}: Props) {
  const [texto, setTexto] = useState("");
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["canal", sncfPedidoId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
        body: { tipo: "canal_listar", sncf_pedido_id: sncfPedidoId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Erro ao carregar canal");
      return (data.eventos ?? []) as CanalEvento[];
    },
    enabled: open && !!sncfPedidoId,
  });

  useEffect(() => {
    if (eventos.length > 0) {
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  }, [eventos.length]);

  useEffect(() => {
    if (!open) qc.invalidateQueries({ queryKey: ["canal_badges"] });
  }, [open, qc]);

  const enviar = useMutation({
    mutationFn: async (txt: string) => {
      const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
        body: { tipo: "canal_criar", sncf_pedido_id: sncfPedidoId, texto: txt },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Erro ao enviar mensagem");
      return data;
    },
    onSuccess: () => {
      setTexto("");
      qc.invalidateQueries({ queryKey: ["canal", sncfPedidoId] });
    },
    onError: (e: Error) => toast.error("Erro ao enviar: " + e.message),
  });

  const handleEnviar = () => {
    const t = texto.trim();
    if (!t || enviar.isPending) return;
    enviar.mutate(t);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-2">
            <MessageCircle className="h-4 w-4 mt-1 text-muted-foreground" />
            <div>
              <DialogTitle className="text-sm">
                Canal · {numeroPedido}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {nomeCliente} · somente você e o SOPS
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2 pr-1">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))
          ) : eventos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <MessageCircle className="h-6 w-6 opacity-40" />
              <span className="text-xs">
                Nenhuma mensagem. Escreva a primeira para o SOPS.
              </span>
            </div>
          ) : (
            eventos.map((ev) => {
              const isCom = ev.tipo_evento === "msg_comercial";
              const autorNome =
                ev.metadata?.autor_nome ?? (isCom ? "Comercial" : "SOPS");
              return (
                <div
                  key={ev.id}
                  className={`flex flex-col ${isCom ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                      isCom
                        ? "bg-primary/10 text-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {ev.descricao}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {isCom ? "Comercial" : "SOPS"} · {autorNome} ·{" "}
                    {fmtData(ev.criado_em)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleEnviar();
              }
            }}
            placeholder="Escrever para o SOPS… (Ctrl+Enter para enviar)"
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleEnviar}
              disabled={!texto.trim() || enviar.isPending}
              className="text-xs uppercase tracking-wide"
            >
              {enviar.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
