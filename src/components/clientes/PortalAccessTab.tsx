import { useEffect, useState } from "react";
import { Copy, Check, KeyRound, Power, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createPortalAccess,
  disablePortalAccess,
  resetPortalPassword,
  defaultPortalPassword,
} from "@/lib/portal.functions";
import type { Cliente } from "@/types/cliente";

interface PortalUserInfo {
  userId: string;
  email: string;
}

interface Props {
  cliente: Cliente;
}

export function PortalAccessTab({ cliente }: Props) {
  const [info, setInfo] = useState<PortalUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(cliente.contatoEmail || "");
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // procura profile com cliente_id === cliente.id
      const { data } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("cliente_id", cliente.id)
        .maybeSingle();
      if (cancelled) return;
      setInfo(data ? { userId: data.id, email: data.email } : null);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [cliente.id]);

  const createAccess = async () => {
    if (!email.trim()) {
      toast.error("Informe o e-mail de acesso");
      return;
    }
    setBusy(true);
    try {
      const result = await createPortalAccess({
        data: {
          clienteId: cliente.id,
          email: email.trim(),
          nomeEmpresa: cliente.nomeFantasia || cliente.razaoSocial,
          cnpjDigits: cliente.cnpj,
        },
      });
      setInfo({ userId: result.userId, email: result.email });
      setCredentials({ email: result.email, password: result.password });
      toast.success("Acesso criado com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar acesso");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!info) return;
    if (!confirm("Gerar nova senha para este cliente?")) return;
    setBusy(true);
    try {
      const { password } = await resetPortalPassword({
        data: { userId: info.userId },
      });
      setCredentials({ email: info.email, password });
      toast.success("Nova senha gerada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao resetar senha");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!info) return;
    if (
      !confirm(
        "Desativar acesso do cliente? O usuário será removido e ele não conseguirá mais entrar no portal. O histórico de pedidos permanece.",
      )
    )
      return;
    setBusy(true);
    try {
      await disablePortalAccess({ data: { userId: info.userId } });
      setInfo(null);
      setCredentials(null);
      toast.success("Acesso desativado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao desativar");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">Carregando...</p>;
  }

  return (
    <div className="space-y-5">
      {info ? (
        <>
          <div className="rounded-md border border-gold/30 bg-gold/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
              Status
            </div>
            <div className="text-lg text-text-primary mt-1">✅ Portal ativo</div>
            <div className="text-xs text-text-secondary mt-2">
              E-mail de acesso: <span className="text-text-primary">{info.email}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={resetPassword}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs uppercase tracking-wider text-text-secondary hover:text-gold hover:border-gold"
            >
              <KeyRound className="h-3.5 w-3.5" /> Redefinir senha
            </button>
            <button
              onClick={disable}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs uppercase tracking-wider text-text-secondary hover:text-stock-out hover:border-stock-out"
            >
              <Power className="h-3.5 w-3.5" /> Desativar acesso
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface/40 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
              Status
            </div>
            <div className="text-lg text-text-secondary mt-1">— Sem acesso</div>
            <p className="text-xs text-text-muted mt-2">
              Crie um acesso para que o lojista possa entrar no portal do cliente,
              ver pedidos e provisões.
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
              E-mail de acesso
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com.br"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
            <p className="text-[10px] text-text-muted mt-1">
              Senha inicial sugerida:{" "}
              <span className="font-mono text-text-secondary">
                {defaultPortalPassword(cliente.cnpj)}
              </span>
            </p>
          </div>

          <button
            onClick={createAccess}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-gold text-background text-xs font-semibold uppercase tracking-wider hover:bg-gold-light disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" /> Criar acesso ao portal
          </button>
        </div>
      )}

      {credentials && (
        <CredentialsModal
          credentials={credentials}
          empresa={cliente.nomeFantasia || cliente.razaoSocial}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}

function CredentialsModal({
  credentials,
  empresa,
  onClose,
}: {
  credentials: { email: string; password: string };
  empresa: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const portalUrl =
    typeof window !== "undefined" ? `${window.location.origin}/portal` : "/portal";

  const message = [
    "*Fetély — Acesso ao Portal do Cliente*",
    "Olá! Seu acesso ao portal Fetély está pronto.",
    "",
    `🔗 Acesse: ${portalUrl}`,
    `📧 E-mail: ${credentials.email}`,
    `🔑 Senha: ${credentials.password}`,
    "",
    "Troque sua senha no primeiro acesso.",
    "Dúvidas? Fale com seu vendedor.",
  ].join("\n");

  const copyAll = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-gold/40 bg-surface p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold-muted">
            ✦ Acesso criado
          </div>
          <h2 className="font-display text-2xl text-text-primary mt-2">{empresa}</h2>
        </div>

        <div className="rounded-md border border-border bg-background p-4 space-y-2 font-mono text-sm">
          <div>
            <span className="text-text-muted">E-mail:</span>{" "}
            <span className="text-text-primary">{credentials.email}</span>
          </div>
          <div>
            <span className="text-text-muted">Senha:</span>{" "}
            <span className="text-gold">{credentials.password}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={copyAll}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-gold px-4 py-2.5 text-xs uppercase tracking-wider text-background hover:bg-gold-light"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copiado!
              </>
            ) : (
              <>
                <MessageSquare className="h-3.5 w-3.5" /> Copiar para WhatsApp
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2.5 text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            Fechar
          </button>
        </div>

        <p className="text-[10px] text-text-muted text-center">
          Salve ou envie essas credenciais agora. A senha não poderá ser
          recuperada depois — apenas redefinida.
        </p>
      </div>
    </div>
  );
}
