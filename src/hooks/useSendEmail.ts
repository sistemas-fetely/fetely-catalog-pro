import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export const useSendEmail = () => {
  const [enviando, setEnviando] = useState(false);

  const enviarEmail = async (params: SendEmailParams): Promise<SendEmailResult> => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return { success: true, id: data?.id };
    } catch (error: any) {
      const msg = error?.message ?? "Falha ao enviar email";
      console.error("useSendEmail:", error);
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setEnviando(false);
    }
  };

  return { enviarEmail, enviando };
};
