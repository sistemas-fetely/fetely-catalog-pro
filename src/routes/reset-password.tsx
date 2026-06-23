import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase coloca os tokens no hash; ao montar, a SDK consome o hash e cria a sessão.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Caso a sessão já tenha sido criada antes do listener montar
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/login" }), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl tracking-[0.25em] text-text-primary">FETÉLY</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            Redefinir senha
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-border bg-surface p-6 space-y-4"
        >
          {done ? (
            <p className="text-sm text-text-primary text-center">
              Senha redefinida com sucesso. Redirecionando...
            </p>
          ) : !ready ? (
            <p className="text-xs text-text-secondary text-center">
              Validando link de recuperação...
            </p>
          ) : (
            <>
              <h2 className="font-display text-lg text-text-primary">Nova senha</h2>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                  Nova senha
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {submitting ? "Salvando..." : "Salvar nova senha"}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
                >
                  ← Voltar ao login
                </Link>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
