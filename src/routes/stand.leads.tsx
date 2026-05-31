import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  exportarCSV,
  getLeads,
  Lead,
  SegmentoLead,
  SEGMENTO_LABEL,
} from "@/lib/leadsFeira";

export const Route = createFileRoute("/stand/leads")({
  head: () => ({
    meta: [
      { title: "Fetély — Leads do Stand" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const [leads] = useState<Lead[]>(() =>
    [...getLeads()].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
  );
  const [busca, setBusca] = useState("");
  const [seg, setSeg] = useState<SegmentoLead | "todos">("todos");
  const [expandido, setExpandido] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (seg !== "todos" && l.segmento !== seg) return false;
      if (q && !l.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, busca, seg]);

  return (
    <div
      className="min-h-screen w-full px-5 py-6"
      style={{ backgroundColor: "#0A0A0A", fontFamily: "'DM Sans', sans-serif", color: "#F5F0E8" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                letterSpacing: "0.12em",
                color: "#C9A84C",
              }}
            >
              FETÉLY — LEADS DO STAND
            </h1>
            <div style={{ fontSize: 12, color: "#A09880", marginTop: 4 }}>
              {leads.length} {leads.length === 1 ? "lead cadastrado" : "leads cadastrados"}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportarCSV(filtrados)}
              disabled={filtrados.length === 0}
              style={{
                backgroundColor: "#C9A84C",
                color: "#0A0A0A",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                border: "none",
                cursor: filtrados.length === 0 ? "not-allowed" : "pointer",
                opacity: filtrados.length === 0 ? 0.5 : 1,
              }}
            >
              ⬇ Exportar CSV
            </button>
            <Link
              to="/catalog"
              style={{
                background: "transparent",
                border: "0.5px solid #2A2A2A",
                color: "#A09880",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              ← Voltar ao Catálogo
            </Link>
          </div>
        </div>

        <div
          style={{ height: 1, backgroundColor: "#2A2A2A", margin: "20px 0" }}
        />

        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              flex: "1 1 240px",
              backgroundColor: "#1A1A1A",
              border: "0.5px solid #2A2A2A",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#F5F0E8",
              fontSize: 14,
              outline: "none",
            }}
          />
          <select
            value={seg}
            onChange={(e) => setSeg(e.target.value as SegmentoLead | "todos")}
            style={{
              backgroundColor: "#1A1A1A",
              border: "0.5px solid #2A2A2A",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#F5F0E8",
              fontSize: 14,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="todos">Segmento: Todos</option>
            {(Object.entries(SEGMENTO_LABEL) as [SegmentoLead, string][]).map(([k, v]) => (
              <option key={k} value={k} style={{ backgroundColor: "#1A1A1A" }}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            backgroundColor: "#111111",
            border: "0.5px solid #2A2A2A",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            className="hidden md:grid"
            style={{
              gridTemplateColumns: "1.5fr 1.2fr 1.5fr 1.2fr 1fr",
              gap: 16,
              padding: "14px 20px",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#A09880",
              borderBottom: "0.5px solid #2A2A2A",
            }}
          >
            <div>Nome</div>
            <div>WhatsApp</div>
            <div>E-mail</div>
            <div>Segmento</div>
            <div>Data/Hora</div>
          </div>

          {filtrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#605850", fontSize: 13 }}>
              Nenhum lead encontrado.
            </div>
          ) : (
            filtrados.map((l) => {
              const d = new Date(l.criadoEm);
              const isOpen = expandido === l.id;
              return (
                <div
                  key={l.id}
                  onClick={() => setExpandido(isOpen ? null : l.id)}
                  style={{
                    padding: "14px 20px",
                    borderBottom: "0.5px solid #1A1A1A",
                    cursor: "pointer",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#161616")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div
                    className="grid md:grid"
                    style={{
                      gridTemplateColumns: "1.5fr 1.2fr 1.5fr 1.2fr 1fr",
                      gap: 16,
                      fontSize: 14,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ color: "#F5F0E8" }}>{l.nome}</div>
                    <div style={{ color: "#A09880" }}>{l.whatsapp}</div>
                    <div style={{ color: l.email ? "#A09880" : "#605850" }}>
                      {l.email || "—"}
                    </div>
                    <div style={{ color: "#A09880" }}>{SEGMENTO_LABEL[l.segmento]}</div>
                    <div style={{ color: "#605850", fontSize: 12 }}>
                      {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                      {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {isOpen && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "0.5px solid #2A2A2A",
                        fontSize: 12,
                        color: "#A09880",
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <div>ID: {l.id}</div>
                      <div>Origem: {l.origem}</div>
                      <div>Criado em: {d.toLocaleString("pt-BR")}</div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
