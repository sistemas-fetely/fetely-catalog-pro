import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl tracking-[0.25em] text-text-primary">FETÉLY</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            Recuperar senha
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-surface p-6 space-y-4 text-center">
            <p className="text-sm text-text-primary">
              Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.
            </p>
            <Link
              to="/login"
              className="inline-block text-xs uppercase tracking-wider text-gold hover:text-gold-light"
            >
              ← Voltar ao login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-lg border border-border bg-surface p-6 space-y-4"
          >
            <h2 className="font-display text-lg text-text-primary">Recuperar acesso</h2>
            <p className="text-xs text-text-secondary">
              Informe seu e-mail e enviaremos um link para redefinir a senha.
            </p>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-gold px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-background hover:bg-gold-light disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Enviar link"}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
              >
                ← Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
