import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/store/authStore";
import { useClientes } from "@/store/clienteStore";
import { changeOwnPortalPassword } from "@/lib/portal.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/conta")({
  component: MinhaConta,
});

function MinhaConta() {
  const profile = useAuth((s) => s.profile);
  const clienteId = profile?.cliente_id ?? null;
  const cliente = useClientes((s) =>
    clienteId ? s.clientes.find((c) => c.id === clienteId) : undefined,
  );

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Nova senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (next !== confirm) {
      toast.error("Confirmação não confere");
      return;
    }
    setBusy(true);
    try {
      await changeOwnPortalPassword({
        data: { currentPassword: current, newPassword: next },
      });
      toast.success("Senha alterada com sucesso");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao trocar senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="border-b border-border pb-5">
        <h1 className="font-display text-3xl text-text-primary">Minha Conta</h1>
      </header>

      <section className="rounded-lg border border-border bg-surface/40 p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
          Dados da empresa
        </div>
        <p className="text-xs text-text-muted">
          Para alterar, fale com seu vendedor.
        </p>
        <Field label="Razão Social" value={cliente?.razaoSocial ?? "—"} />
        <Field label="Nome Fantasia" value={cliente?.nomeFantasia ?? "—"} />
        <Field label="CNPJ" value={cliente?.cnpjFormatado ?? "—"} />
        <Field
          label="Endereço"
          value={
            cliente
              ? `${cliente.logradouro}${cliente.numero ? `, ${cliente.numero}` : ""} — ${cliente.bairro}, ${cliente.cidade}/${cliente.estado}`
              : "—"
          }
        />
        <Field label="Vendedor responsável" value={cliente?.cadastradoPorVendedorNome ?? "—"} />
      </section>

      <section className="rounded-lg border border-border bg-surface/40 p-5 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gold-muted">
          Acesso
        </div>
        <Field label="E-mail de acesso" value={profile?.email ?? "—"} />

        <form onSubmit={submitPassword} className="space-y-3 pt-3 border-t border-border">
          <h3 className="font-display text-base text-text-primary">Alterar senha</h3>
          <Input
            label="Senha atual"
            type="password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <Input
            label="Nova senha"
            type="password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !current || !next || !confirm}
              className="rounded-md bg-gold px-5 py-2 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/40 pb-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
        {label}
      </div>
      <div className="text-sm text-text-primary mt-0.5 break-words">{value}</div>
    </div>
  );
}

function Input({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
      />
    </div>
  );
}
