// Motor de pace por dias úteis (seg–sex). Puro, sem side effects.

export type StatusPace = "adiantado" | "no_ritmo" | "atrasado";

export interface PaceInput {
  meta: number;
  realizado: number;
  ano: number;
  mes: number; // 1..12
  hoje: Date; // referência
}

export interface PaceResult {
  diasUteisTotal: number;
  diasUteisDecorridos: number;
  diasUteisRestantes: number;
  fracUtil: number;
  idealAteHoje: number;
  projecaoFimMes: number;
  ratio: number;
  faltaPorDiaUtil: number;
  status: StatusPace;
  mesFechado: boolean;
}

function isDiaUtil(d: Date): boolean {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;
}

function ultimoDiaMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

export function diasUteisNoMes(ano: number, mes: number): number {
  const dias = ultimoDiaMes(ano, mes);
  let n = 0;
  for (let d = 1; d <= dias; d++) {
    if (isDiaUtil(new Date(ano, mes - 1, d))) n++;
  }
  return n;
}

export function diasUteisDecorridos(ano: number, mes: number, hoje: Date): number {
  // Se hoje > último dia do mês → todos os dias úteis do mês
  const ultDia = ultimoDiaMes(ano, mes);
  const fimMes = new Date(ano, mes - 1, ultDia);
  if (hoje > fimMes) return diasUteisNoMes(ano, mes);

  const inicioMes = new Date(ano, mes - 1, 1);
  if (hoje < inicioMes) return 0;

  let n = 0;
  const dia = hoje.getDate();
  for (let d = 1; d <= dia; d++) {
    if (isDiaUtil(new Date(ano, mes - 1, d))) n++;
  }
  return n;
}

export function statusPace(ratio: number): StatusPace {
  if (ratio >= 1.05) return "adiantado";
  if (ratio >= 0.95) return "no_ritmo";
  return "atrasado";
}

export function calcularPace(input: PaceInput): PaceResult {
  const { meta, realizado, ano, mes, hoje } = input;
  const diasUteisTotal = diasUteisNoMes(ano, mes);
  const diasUteisDec = diasUteisDecorridos(ano, mes, hoje);
  const diasUteisRest = Math.max(0, diasUteisTotal - diasUteisDec);
  const fracUtil = diasUteisTotal > 0 ? diasUteisDec / diasUteisTotal : 0;
  const idealAteHoje = meta * fracUtil;
  const projecaoFimMes =
    diasUteisDec > 0 ? (realizado / diasUteisDec) * diasUteisTotal : 0;
  const ratio = idealAteHoje > 0 ? realizado / idealAteHoje : 0;
  const faltaPorDiaUtil =
    diasUteisRest > 0 ? Math.max(0, meta - realizado) / diasUteisRest : 0;
  const ultDia = ultimoDiaMes(ano, mes);
  const mesFechado = hoje > new Date(ano, mes - 1, ultDia, 23, 59, 59);

  return {
    diasUteisTotal,
    diasUteisDecorridos: diasUteisDec,
    diasUteisRestantes: diasUteisRest,
    fracUtil,
    idealAteHoje,
    projecaoFimMes,
    ratio,
    faltaPorDiaUtil,
    status: statusPace(ratio),
    mesFechado,
  };
}

export interface PontoSerie {
  dia: number; // dia do mês
  realizado: number | null;
  ideal: number;
  projecao: number | null;
}

/**
 * Série acumulada para o gráfico.
 * - ideal: cumulativo por dias úteis (degrau em fins de semana)
 * - realizado: cumulativo dos pedidos por dia, até hoje
 * - projecao: reta da taxa atual (real/diasÚteisDecorridos) do dia atual até o fim do mês
 */
export function serieGrafico(
  ano: number,
  mes: number,
  meta: number,
  realizadoPorDia: Record<number, number>, // { dia: valor daquele dia }
  hoje: Date,
): PontoSerie[] {
  const dias = ultimoDiaMes(ano, mes);
  const diasUteisTotal = diasUteisNoMes(ano, mes);
  const idealPorDiaUtil = diasUteisTotal > 0 ? meta / diasUteisTotal : 0;

  const hojeAno = hoje.getFullYear();
  const hojeMes = hoje.getMonth() + 1;
  const hojeDia = hoje.getDate();
  const mesmoMes = hojeAno === ano && hojeMes === mes;
  const mesFuturo = ano > hojeAno || (ano === hojeAno && mes > hojeMes);
  const mesPassado = ano < hojeAno || (ano === hojeAno && mes < hojeMes);

  let acumIdeal = 0;
  let acumReal = 0;
  const pontos: PontoSerie[] = [];

  // taxa por dia útil baseada no realizado até hoje
  let diasUteisAteHoje = 0;
  if (mesmoMes) {
    for (let d = 1; d <= hojeDia; d++) {
      if (isDiaUtil(new Date(ano, mes - 1, d))) diasUteisAteHoje++;
    }
  } else if (mesPassado) {
    diasUteisAteHoje = diasUteisTotal;
  }
  const realTotalAteHoje = Object.entries(realizadoPorDia).reduce(
    (s, [d, v]) => (Number(d) <= (mesmoMes ? hojeDia : dias) ? s + v : s),
    0,
  );
  const taxaProjecao =
    diasUteisAteHoje > 0 ? realTotalAteHoje / diasUteisAteHoje : 0;

  let acumProj = 0;
  for (let d = 1; d <= dias; d++) {
    const isUtil = isDiaUtil(new Date(ano, mes - 1, d));
    if (isUtil) acumIdeal += idealPorDiaUtil;
    acumReal += realizadoPorDia[d] ?? 0;

    let realizado: number | null = null;
    let projecao: number | null = null;

    if (mesPassado) {
      realizado = acumReal;
    } else if (mesmoMes) {
      if (d <= hojeDia) realizado = acumReal;
      if (d >= hojeDia) {
        if (d === hojeDia) {
          acumProj = acumReal;
        } else if (isUtil) {
          acumProj += taxaProjecao;
        }
        projecao = acumProj;
      }
    } else if (mesFuturo) {
      // sem realizado nem projeção
    }

    pontos.push({ dia: d, realizado, ideal: acumIdeal, projecao });
  }
  return pontos;
}
