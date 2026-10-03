// 金額と消費税の計算（画面とサーバーの両方で使う。DB や React に依存しない）
//
// インボイス制度（適格請求書）のルールに合わせている:
// - 消費税額は「1枚の書類につき、税率ごとに1回」だけ端数処理する（明細ごとに丸めて足すのは不可）
// - 端数処理の方法（切り捨て・四捨五入・切り上げ）は事業者が選べる
// 出典: 国税庁「消費税の仕入税額控除制度における適格請求書等保存方式に関するQ&A」問57

export const TAX_RATES = [10, 8] as const;
export type TaxRate = (typeof TAX_RATES)[number];
export type Rounding = "floor" | "round" | "ceil";

export const ROUNDING_LABEL: Record<Rounding, string> = { floor: "切り捨て", round: "四捨五入", ceil: "切り上げ" };

export type LineInput = {
  // 単価は税抜・円（整数）。数量は小数2桁まで（例: 1.5時間）
  unitPrice: number;
  quantity: number;
  taxRate: TaxRate;
};

export type RateTotal = { rate: TaxRate; base: number; tax: number };
export type DocumentTotals = { byRate: RateTotal[]; subtotal: number; tax: number; total: number };

// 小数の誤差を避けるため、数量は100倍した整数で計算する（1.1 * 3 のような誤差を出さない）
export function lineAmount(l: Pick<LineInput, "unitPrice" | "quantity">): number {
  const q100 = Math.round(l.quantity * 100);
  // 明細の金額で1円未満が出たら切り捨てる（例: 1,001円 × 0.5 = 500円）
  return Math.floor((l.unitPrice * q100) / 100);
}

function roundYen(v: number, mode: Rounding): number {
  // v は「円 × 100」の整数（税率を掛けた値）。整数のまま丸めて誤差を出さない
  if (mode === "floor") return Math.floor(v / 100);
  if (mode === "ceil") return Math.ceil(v / 100);
  return Math.floor((v + 50) / 100);
}

export function calcTotals(lines: LineInput[], rounding: Rounding): DocumentTotals {
  const byRate: RateTotal[] = [];
  for (const rate of TAX_RATES) {
    const target = lines.filter((l) => l.taxRate === rate);
    if (!target.length) continue;
    const base = target.reduce((s, l) => s + lineAmount(l), 0);
    byRate.push({ rate, base, tax: roundYen(base * rate, rounding) });
  }
  const subtotal = byRate.reduce((s, r) => s + r.base, 0);
  const tax = byRate.reduce((s, r) => s + r.tax, 0);
  return { byRate, subtotal, tax, total: subtotal + tax };
}

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
