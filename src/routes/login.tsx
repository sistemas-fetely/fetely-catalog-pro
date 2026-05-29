import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/authStore";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const init = useAuth((s) => s.init);
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const signIn = useAuth((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/catalog" });
    }
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl tracking-[0.25em] text-text-primary">FETÉLY</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-gold-muted">
            B2B Orders
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-border bg-surface p-6 space-y-4"
        >
          <h2 className="font-display text-lg text-text-primary">Acessar sistema</h2>

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

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-[11px] text-text-secondary text-center">
            Acesso restrito. Solicite cadastro ao administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
