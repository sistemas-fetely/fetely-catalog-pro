import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  countDigits,
  getLeads,
  isValidEmail,
  Lead,
  leadsHoje,
  maskWhatsApp,
  saveLead,
  SegmentoLead,
  SEGMENTO_LABEL,
} from "@/lib/leadsFeira";

export const Route = createFileRoute("/stand")({
  head: () => ({
    meta: [
      { title: "Fetély — Cadastro de Visitante" },
      { name: "description", content: "Captação de leads no stand Fetély." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StandPage,
});

const SEGMENTOS = Object.entries(SEGMENTO_LABEL) as [SegmentoLead, string][];

function StandPage() {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [segmento, setSegmento] = useState<SegmentoLead | "">("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCount(leadsHoje(getLeads()));
  }, []);

  useEffect(() => {
    if (!success) nomeRef.current?.focus();
  }, [success]);

  function reset() {
    setNome("");
    setWhatsapp("");
    setEmail("");
    setSegmento("");
    setErrors({});
    setSuccess(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, boolean> = {};
    if (!nome.trim()) errs.nome = true;
    if (countDigits(whatsapp) < 10) errs.whatsapp = true;
    if (!segmento) errs.segmento = true;
    if (email && !isValidEmail(email)) errs.email = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(errs)[0]}"]`);
      first?.focus();
      return;
    }
    const lead: Lead = {
      id: String(Date.now()),
      criadoEm: new Date().toISOString(),
      nome: nome.trim(),
      whatsapp,
      email: email.trim(),
      segmento: segmento as SegmentoLead,
      origem: "feira",
    };
    saveLead(lead);
    setCount(leadsHoje(getLeads()));
    setSuccess(lead.nome);
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between px-5 py-8"
      style={{ backgroundColor: "#0A0A0A", fontFamily: "'DM Sans', sans-serif" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />
      <div className="w-full max-w-[480px] mx-auto self-center">
        <Link
          to="/catalog"
          style={{
            display: "inline-block",
            color: "#A09880",
            fontSize: 12,
            letterSpacing: "0.1em",
            textDecoration: "none",
            padding: "8px 14px",
            border: "0.5px solid #2A2A2A",
            borderRadius: 8,
            background: "transparent",
          }}
        >
          ← Voltar ao Catálogo
        </Link>
      </div>
      <div className="flex-1 w-full flex items-center justify-center">
        <div
          className="w-full max-w-[480px] mx-auto animate-in fade-in duration-200"
          style={{
            backgroundColor: "#111111",
            border: "0.5px solid #2A2A2A",
            borderRadius: 16,
            padding: "2.5rem 2rem",
          }}
        >
          {/* Logo */}
          <div className="text-center">
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                letterSpacing: "0.18em",
                color: "#C9A84C",
              }}
            >
              FETÉLY
            </h1>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.12em",
                color: "#605850",
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              {success ? "Cadastro confirmado" : "Cadastro de Visitante"}
            </div>
            <div
              style={{
                width: 40,
                height: 1,
                backgroundColor: "#C9A84C",
                opacity: 0.5,
                margin: "20px auto 28px",
              }}
            />
          </div>

          {success ? (
            <div className="text-center animate-in fade-in duration-200">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundColor: "rgba(201,168,76,0.1)",
                  border: "1px solid rgba(201,168,76,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  color: "#C9A84C",
                  fontSize: 24,
                  fontFamily: "'Cormorant Garamond', serif",
                }}
              >
                ✦
              </div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 24,
                  color: "#F5F0E8",
                  marginBottom: 8,
                }}
              >
                {success}
              </div>
              <div style={{ color: "#A09880", fontSize: 14, marginBottom: 28 }}>
                Cadastrado com sucesso.
              </div>
              <button
                onClick={reset}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "0.5px solid #2A2A2A",
                  color: "#A09880",
                  padding: 14,
                  borderRadius: 8,
                  fontSize: 13,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#C9A84C";
                  e.currentTarget.style.color = "#C9A84C";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#2A2A2A";
                  e.currentTarget.style.color = "#A09880";
                }}
              >
                Próximo Visitante
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="Nome Completo *" error={errors.nome}>
                <input
                  ref={nomeRef}
                  data-field="nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="lead-input"
                  style={inputStyle(errors.nome)}
                  autoComplete="off"
                />
              </Field>

              <Field label="WhatsApp *" error={errors.whatsapp}>
                <input
                  data-field="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
                  placeholder="(11) 99999-9999"
                  style={inputStyle(errors.whatsapp)}
                  autoComplete="off"
                />
              </Field>

              <Field label="E-mail" error={errors.email}>
                <input
                  data-field="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle(errors.email)}
                  autoComplete="off"
                />
              </Field>

              <Field label="Segmento *" error={errors.segmento}>
                <div style={{ position: "relative" }}>
                  <select
                    data-field="segmento"
                    value={segmento}
                    onChange={(e) => setSegmento(e.target.value as SegmentoLead)}
                    style={{
                      ...inputStyle(errors.segmento),
                      appearance: "none",
                      paddingRight: 40,
                      cursor: "pointer",
                    }}
                  >
                    <option value="" disabled style={{ color: "#3A3530" }}>
                      Selecione...
                    </option>
                    {SEGMENTOS.map(([k, v]) => (
                      <option key={k} value={k} style={{ backgroundColor: "#1A1A1A" }}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      position: "absolute",
                      right: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#C9A84C",
                      pointerEvents: "none",
                      fontSize: 10,
                    }}
                  >
                    ▼
                  </span>
                </div>
              </Field>

              <button
                type="submit"
                style={{
                  width: "100%",
                  backgroundColor: "#C9A84C",
                  color: "#0A0A0A",
                  fontSize: 13,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  borderRadius: 8,
                  padding: 14,
                  border: "none",
                  cursor: "pointer",
                  transition: "background 150ms",
                  marginTop: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8C97A")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C9A84C")}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                Cadastrar Visitante
              </button>
            </form>
          )}
        </div>
      </div>

      <div
        className="mt-8 text-center"
        style={{ fontSize: 11, color: "#3A3530", letterSpacing: "0.08em" }}
      >
        <span style={{ color: "#C9A84C" }}>{count}</span>{" "}
        {count === 1 ? "lead cadastrado hoje" : "leads cadastrados hoje"}
        <div className="mt-3">
          <Link
            to="/stand/leads"
            style={{ color: "#605850", fontSize: 11, letterSpacing: "0.08em" }}
          >
            Ver leads →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: error ? "#8B3A3A" : "#A09880",
          display: "block",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function inputStyle(error?: boolean): React.CSSProperties {
  return {
    width: "100%",
    backgroundColor: "#1A1A1A",
    border: `0.5px solid ${error ? "#8B3A3A" : "#2A2A2A"}`,
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 15,
    color: "#F5F0E8",
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  };
}
