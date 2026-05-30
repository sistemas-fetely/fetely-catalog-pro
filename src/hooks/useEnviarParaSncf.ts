import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type SncfStatus =
  | "nao_enviado"
  | "pendente"
  | "enviado"
  | "rejeitado"
  | "erro_persistente";

interface State {
  status: SncfStatus;
  pedidoId: string | null;
  estagio: string | null;
  erro: string | null;
  enviadoEm: string | null;
}

export function useEnviarParaSncf(orderId: string) {
  const [state, setState] = useState<State>({
    status: "nao_enviado",
    pedidoId: null,
    estagio: null,
    erro: null,
    enviadoEm: null,
  });
  const [isEnviando, setIsEnviando] = useState(false);

  // Load initial state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "sncf_status_sync, sncf_pedido_id, sncf_estagio, sncf_ultimo_erro, sncf_enviado_em",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) return;
      const status = (data.sncf_status_sync as SncfStatus | null) ?? "nao_enviado";
      setState({
        status,
        pedidoId: data.sncf_pedido_id ?? null,
        estagio: data.sncf_estagio ?? null,
        erro: data.sncf_ultimo_erro ?? null,
        enviadoEm: data.sncf_enviado_em ?? null,
      });
      
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const enviar = useCallback(async () => {
    setIsEnviando(true);
    setState((s) => ({ ...s, status: "pendente", erro: null }));
    try {
      const { data, error } = await supabase.functions.invoke("enviar-para-sncf", {
        body: { order_id: orderId },
      });

      if (error) {
        // Try to detect 4xx vs 5xx
        const status = (error as { status?: number; context?: { status?: number } })
          .status ?? (error as { context?: { status?: number } }).context?.status;
        const msg = (error as { message?: string }).message ?? "Erro desconhecido";
        if (status && status >= 400 && status < 500) {
          setState((s) => ({ ...s, status: "rejeitado", erro: msg }));
          toast.error(msg);
        } else {
          setState((s) => ({ ...s, status: "erro_persistente", erro: msg }));
          toast.error("Falhou ao enviar. Tente de novo.");
        }
        return;
      }

      if (data?.ok === true) {
        setState({
          status: "enviado",
          pedidoId: data.pedido_id ?? data.sncf_pedido_id ?? null,
          estagio: data.estagio ?? data.sncf_estagio ?? null,
          erro: null,
          enviadoEm: data.enviado_em ?? new Date().toISOString(),
        });
        toast.success("Pedido enviado pro SNCF");
      } else {
        const msg = data?.error ?? "Resposta inválida do SNCF";
        setState((s) => ({ ...s, status: "rejeitado", erro: msg }));
        toast.error(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      setState((s) => ({ ...s, status: "erro_persistente", erro: msg }));
      toast.error("Falhou ao enviar. Tente de novo.");
    } finally {
      setIsEnviando(false);
    }
  }, [orderId]);


  return {
    status: state.status,
    pedidoId: state.pedidoId,
    estagio: state.estagio,
    erro: state.erro,
    enviadoEm: state.enviadoEm,
    enviar,
    isEnviando,
  };
}
