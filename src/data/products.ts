import type { Product } from "@/types";

// Coleções de vela NUMÉRICA
export const NUMERIC_CANDLE_COLLECTIONS = [
  "Classique", "Dots Doux", "Fine Pure", "Frost Glow",
  "Glitter Glow", "Golden Line", "Splash Neon", "Sweet Candy", "Texture",
] as const;

// Coleções de vela DECORATIVA
export const DECORATIVE_CANDLE_COLLECTIONS = [
  "Amour", "Le Moment", "Lumi Star", "Pattern", "Spirale", "Twist",
] as const;

// Helpers
let _id = 1;
const nextSku = (prefix: string) => `FTL-${prefix}-${String(_id++).padStart(5, "0")}`;
const ean = () => String(7890000000000 + _id * 7).padStart(13, "0");

// Mapping de cor por coleção (para placeholders visuais)
export const COLLECTION_ACCENT: Record<string, string> = {
  // Velas numéricas
  Classique: "oklch(0.55 0.02 80)",
  "Dots Doux": "oklch(0.78 0.09 350)",
  "Fine Pure": "oklch(0.92 0.01 80)",
  "Frost Glow": "oklch(0.82 0.06 220)",
  "Glitter Glow": "oklch(0.75 0.13 85)",
  "Golden Line": "oklch(0.74 0.115 85)",
  "Splash Neon": "oklch(0.78 0.20 145)",
  "Sweet Candy": "oklch(0.80 0.10 20)",
  Texture: "oklch(0.55 0.04 60)",
  // Decorativas
  Amour: "oklch(0.62 0.18 20)",
  "Le Moment": "oklch(0.50 0.06 280)",
  "Lumi Star": "oklch(0.78 0.11 85)",
  Pattern: "oklch(0.45 0.05 250)",
  Spirale: "oklch(0.68 0.13 50)",
  Twist: "oklch(0.70 0.10 320)",
  // Mesa
  "Aura Gold": "oklch(0.78 0.11 85)",
  Blosson: "oklch(0.78 0.10 350)",
  "Butterfly -B&W": "oklch(0.30 0 0)",
  "Costa Serena": "oklch(0.70 0.10 220)",
  "Fresh-Frutta": "oklch(0.78 0.18 90)",
  "Fungi Royale": "oklch(0.45 0.08 30)",
  "Lemon Blue": "oklch(0.80 0.14 100)",
  "Lottus Golden": "oklch(0.76 0.11 85)",
  "Luxury Blue": "oklch(0.45 0.12 250)",
  "Mosaïque": "oklch(0.60 0.10 200)",
  "Ocean Blue": "oklch(0.55 0.12 230)",
  Piacera: "oklch(0.72 0.06 80)",
  "Pink Flower": "oklch(0.78 0.13 0)",
  "Solar-Tropical": "oklch(0.75 0.16 60)",
  "Tropical-Chic": "oklch(0.60 0.14 150)",
  Signature: "oklch(0.70 0.04 80)",
  Blasson: "oklch(0.72 0.08 30)",
  Cadre: "oklch(0.65 0.05 60)",
  Coquille: "oklch(0.85 0.05 80)",
  "Dolce Frutta": "oklch(0.78 0.15 80)",
  "Éclat": "oklch(0.78 0.10 85)",
  "Ondée": "oklch(0.70 0.08 220)",
  "Pétale": "oklch(0.78 0.10 350)",
  "Floréale Glass": "oklch(0.85 0.04 200)",
  "Lineare Glass": "oklch(0.82 0.02 80)",
  Lavoire: "oklch(0.78 0.11 85)",
};

// Cores/variantes padrão para velas numéricas
const CANDLE_COLORS = [
  { nome: "Noir & Oro", cor: "Preto/Dourado", code: "017" },
  { nome: "Bianco & Oro", cor: "Branco/Dourado", code: "018" },
  { nome: "Rose Gold", cor: "Rosé", code: "024" },
];

// Cores reais da coleção Classique (7 variantes)
const CLASSIQUE_COLORS = [
  { nome: "Noir & Oro", cor: "Preto/Dourado", code: "017" },
  { nome: "Bianco & Oro", cor: "Branco/Dourado", code: "018" },
  { nome: "Bianco & Oro Éclat", cor: "Branco/Dourado Brilho", code: "019" },
  { nome: "Bianco & Argento Éclat", cor: "Branco/Prata Brilho", code: "020" },
  { nome: "Oro Éclat", cor: "Dourado Brilho", code: "021" },
  { nome: "Rosé Doux - Éclat", cor: "Rosé Brilho", code: "022" },
  { nome: "Argento Éclat", cor: "Prata Brilho", code: "023" },
];

// Especificações físicas por tamanho (validadas com JSON oficial Classique)
const CANDLE_SIZES = [
  { num: "5 cm", ref: "Médio",  preco: 7.9,    varejo: 14.9, code: "5", pesoG: 25, alturaCm: 11.1, larguraCm: 4.0, profundidadeCm: 1.0 },
  { num: "7 cm", ref: "Grande", preco: 9.9412, varejo: 16.9, code: "7", pesoG: 32, alturaCm: 15.6, larguraCm: 5.5, profundidadeCm: 1.4 },
];

const COLECAO_CODE: Record<string, string> = {
  Classique: "CL",
  "Dots Doux": "DD",
  "Fine Pure": "FP",
  "Frost Glow": "FG",
  "Glitter Glow": "GG",
  "Golden Line": "GL",
  "Splash Neon": "SN",
  "Sweet Candy": "SC",
  Texture: "TX",
};

function colorsForCollection(colecao: string) {
  if (colecao === "Classique") return CLASSIQUE_COLORS;
  return CANDLE_COLORS;
}

function sizesForCollection(colecao: string) {
  // Classique só existe em 7 cm no catálogo oficial
  if (colecao === "Classique") return CANDLE_SIZES.filter((s) => s.code === "7");
  return CANDLE_SIZES;
}

function buildNumericCandles(colecao: string): Product[] {
  const out: Product[] = [];
  const colors = colorsForCollection(colecao);
  const sizes = sizesForCollection(colecao);
  const prefix = COLECAO_CODE[colecao] ?? colecao.slice(0, 2).toUpperCase();
  for (const color of colors) {
    for (const size of sizes) {
      for (let n = 0; n <= 9; n++) {
        const cad = `VELNUMGRD.${prefix}.${size.code}/${color.code}${n}0`;
        const nomeComercial = `Vela ${colecao} Nº ${n}, cor ${color.nome}, ${size.num} (1un.)`;
        const nomeCompleto = `Vela Numérica ${colecao}, ${size.num}, cor ${color.nome}, contém 1un.`;
        out.push({
          sku: nextSku("VN"),
          codCadastro: cad,
          ean: ean(),
          marca: "Fetély",
          linha: "Lumier",
          categoria: "Luz e Momento",
          departamento: "Celebrações",
          grupo: "Vela",
          tipo: "Numérica",
          colecao,
          subColecao2: colecao === "Classique" ? "Lançamento" : undefined,
          familia: `Número ${n}`,
          corNome: color.nome,
          cor: color.cor,
          estampa: "",
          tamanhoNumero: size.num,
          tamanhoRef: size.ref,
          nomeComercial,
          nomeCompleto,
          metaDescricao: `${nomeComercial} em cera premium. Decoração elegante para celebrar. Coleção ${colecao} - Fetely Celebrações.`,
          ncm: "3406.00.00",
          cest: "28.016.00",
          origemFisc: "Nacional",
          origemProd: "Importado",
          tipoEmbalagem: "Cartão Blister + Caixa de PVC",
          material: "Cera",
          materialDescritivo: "Cera parafínica de alta qualidade",
          multiplos: 12,
          qtdKit: 1,
          precoVarejo: size.varejo,
          precoAtacado: size.preco,
          statusEstoque:
            colecao === "Classique"
              ? "Prev. Jul_2026"
              : n === 8 && colecao === "Sweet Candy"
                ? "Prev. Jun_2026"
                : "em estoque",
          pesoG: size.pesoG,
          larguraCm: size.larguraCm,
          alturaCm: size.alturaCm,
          profundidadeCm: size.profundidadeCm,
          isVelaNumerica: true,
          numeroVela: n,
        });
      }
    }
  }
  return out;
}

function buildDecorativeCandles(colecao: string): Product[] {
  const variants = [
    { cor: "Branco", nome: "Ivory" },
    { cor: "Dourado", nome: "Champagne Gold" },
    { cor: "Preto", nome: "Noir" },
  ];
  return variants.map((v) => ({
    sku: nextSku("VD"),
    codCadastro: `VD-${colecao.slice(0, 3).toUpperCase()}-${v.cor.slice(0, 3).toUpperCase()}`,
    marca: "Fetély",
    linha: "Lumier",
    categoria: "Luz e Momento",
    grupo: "Vela",
    tipo: "Decorativa",
    colecao,
    familia: colecao,
    corNome: v.nome,
    cor: v.cor,
    estampa: "Decorativa",
    tamanhoNumero: "10 cm",
    tamanhoRef: "Único",
    nomeComercial: `Vela ${colecao} — ${v.nome}`,
    multiplos: 4,
    qtdKit: 1,
    precoVarejo: 39.9,
    precoAtacado: 22.5,
    statusEstoque: "em estoque",
    material: "Parafina premium",
    pesoG: 120,
    larguraCm: 6,
    alturaCm: 10,
    ean: ean(),
    isVelaNumerica: false,
  }));
}

interface MesaSpec {
  colecao: string;
  grupo: string;
  tipo: string;
  tamanho: string;
  tamanhoRef: string;
  preco: number;
  multiplos: number;
}

function buildMesa(spec: MesaSpec): Product {
  return {
    sku: nextSku(spec.grupo.slice(0, 2).toUpperCase()),
    codCadastro: `${spec.grupo.slice(0, 3).toUpperCase()}-${spec.colecao.slice(0, 4).toUpperCase()}-${spec.tamanho.replace(/\s/g, "")}`,
    marca: "Fetély",
    linha: "Célébrée",
    categoria: "Celebrar à Mesa",
    grupo: spec.grupo,
    tipo: spec.tipo,
    colecao: spec.colecao,
    familia: spec.colecao,
    corNome: spec.colecao,
    cor: "Multicolor",
    estampa: spec.colecao,
    tamanhoNumero: spec.tamanho,
    tamanhoRef: spec.tamanhoRef,
    nomeComercial: `${spec.grupo} ${spec.tipo} ${spec.colecao} ${spec.tamanho}`,
    multiplos: spec.multiplos,
    qtdKit: spec.multiplos,
    precoVarejo: +(spec.preco * 1.85).toFixed(2),
    precoAtacado: spec.preco,
    statusEstoque: "em estoque",
    material: spec.grupo === "Copos e Taças" ? "Vidro cristal" : spec.grupo === "Talheres" ? "Aço inox dourado" : "Porcelana premium",
    pesoG: 200,
    larguraCm: 25,
    alturaCm: 3,
    ean: ean(),
    isVelaNumerica: false,
  };
}

const PRATO_COLLECTIONS = ["Aura Gold","Blosson","Butterfly -B&W","Costa Serena","Fresh-Frutta","Fungi Royale","Lemon Blue","Lottus Golden","Luxury Blue","Mosaïque","Ocean Blue","Piacera","Pink Flower","Solar-Tropical","Tropical-Chic"];
const GUARDANAPO_COLLECTIONS = ["Aura Gold","Blosson","Butterfly -B&W","Costa Serena","Fresh-Frutta","Fungi Royale","Lemon Blue","Lottus Golden","Luxury Blue","Mosaïque","Ocean Blue","Pink Flower","Signature","Solar-Tropical","Tropical-Chic"];
const JOGO_AMERICANO = ["Blasson","Cadre","Coquille","Dolce Frutta","Éclat","Ondée","Pétale","Solar-Tropical","Spirale"];
const TRAVESSA = ["Butterfly -B&W","Fresh-Frutta","Fungi Royale","Lemon Blue","Lottus Golden","Mosaïque","Piacera","Solar-Tropical"];

const PRATO_TYPES: { tipo: string; tamanho: string; ref: string; preco: number; mult: number }[] = [
  { tipo: "Raso", tamanho: "27 cm", ref: "Grande", preco: 38, mult: 6 },
  { tipo: "Fundo", tamanho: "22 cm", ref: "Médio", preco: 34, mult: 6 },
  { tipo: "Sobremesa", tamanho: "19 cm", ref: "Pequeno", preco: 24, mult: 6 },
];

const products: Product[] = [];

// Velas numéricas
NUMERIC_CANDLE_COLLECTIONS.forEach((c) => products.push(...buildNumericCandles(c)));
// Velas decorativas
DECORATIVE_CANDLE_COLLECTIONS.forEach((c) => products.push(...buildDecorativeCandles(c)));

// Pratos
PRATO_COLLECTIONS.forEach((col) => {
  PRATO_TYPES.forEach((t) => {
    products.push(buildMesa({ colecao: col, grupo: "Prato", tipo: t.tipo, tamanho: t.tamanho, tamanhoRef: t.ref, preco: t.preco, multiplos: t.mult }));
  });
});

// Guardanapos
GUARDANAPO_COLLECTIONS.forEach((col) => {
  products.push(buildMesa({ colecao: col, grupo: "Guardanapo", tipo: "Papel", tamanho: "33x33 cm", tamanhoRef: "Padrão", preco: 18, multiplos: 12 }));
  products.push(buildMesa({ colecao: col, grupo: "Guardanapo", tipo: "Coquetel", tamanho: "25x25 cm", tamanhoRef: "Pequeno", preco: 14, multiplos: 12 }));
});

// Jogos americanos
JOGO_AMERICANO.forEach((col) => {
  products.push(buildMesa({ colecao: col, grupo: "Jogo Americano", tipo: "Retangular", tamanho: "45x30 cm", tamanhoRef: "Padrão", preco: 28, multiplos: 4 }));
});

// Travessas
TRAVESSA.forEach((col) => {
  products.push(buildMesa({ colecao: col, grupo: "Travessa", tipo: "Oval", tamanho: "38 cm", tamanhoRef: "Grande", preco: 78, multiplos: 2 }));
});

// Copos e Taças
["Floréale Glass", "Lineare Glass"].forEach((col) => {
  products.push(buildMesa({ colecao: col, grupo: "Copos e Taças", tipo: "Taça de Vinho", tamanho: "350ml", tamanhoRef: "Médio", preco: 42, multiplos: 6 }));
  products.push(buildMesa({ colecao: col, grupo: "Copos e Taças", tipo: "Copo Long Drink", tamanho: "400ml", tamanhoRef: "Grande", preco: 34, multiplos: 6 }));
});

// Talheres
products.push(buildMesa({ colecao: "Lavoire", grupo: "Talheres", tipo: "Faqueiro", tamanho: "24 peças", tamanhoRef: "Conjunto", preco: 280, multiplos: 1 }));

export const PRODUCTS: Product[] = products;

// Index helpers
export const CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.categoria)));

export function collectionsByCategory(categoria: string): string[] {
  return Array.from(new Set(PRODUCTS.filter((p) => p.categoria === categoria).map((p) => p.colecao)));
}

export function groupsByCollection(colecao: string): string[] {
  return Array.from(new Set(PRODUCTS.filter((p) => p.colecao === colecao).map((p) => p.grupo)));
}

export function productsBy(colecao: string, grupo?: string): Product[] {
  return PRODUCTS.filter((p) => p.colecao === colecao && (!grupo || p.grupo === grupo));
}

export function isNumericCollection(colecao: string): boolean {
  return (NUMERIC_CANDLE_COLLECTIONS as readonly string[]).includes(colecao);
}
