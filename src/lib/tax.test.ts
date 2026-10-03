import { describe, expect, it } from "vitest";
import { calcTotals, lineAmount, type LineInput } from "./tax";

const L = (unitPrice: number, quantity: number, taxRate: 10 | 8): LineInput => ({ unitPrice, quantity, taxRate });

describe("明細の金額", () => {
  it("単価×数量", () => expect(lineAmount(L(1200, 3, 10))).toBe(3600));
  it("数量が小数でも誤差を出さない（1.1 × 3）", () => expect(lineAmount(L(3, 1.1, 10))).toBe(3));
  it("1円未満は切り捨て（1,001円 × 0.5）", () => expect(lineAmount(L(1001, 0.5, 10))).toBe(500));
  it("時間単価 × 1.25時間", () => expect(lineAmount(L(4000, 1.25, 10))).toBe(5000));
});

describe("消費税は税率ごとに1回だけ端数処理する", () => {
  // 98円の品を3行。明細ごとに丸めると 9+9+9=27円、まとめて丸めると 294×10%=29.4 → 29円
  const lines = [L(98, 1, 10), L(98, 1, 10), L(98, 1, 10)];
  it("切り捨て", () => expect(calcTotals(lines, "floor").tax).toBe(29));
  it("四捨五入", () => expect(calcTotals(lines, "round").tax).toBe(29));
  it("切り上げ", () => expect(calcTotals(lines, "ceil").tax).toBe(30));
});

describe("10%と8%（軽減税率）が混ざる書類", () => {
  const t = calcTotals([L(1000, 1, 10), L(540, 1, 8), L(1260, 2, 8)], "floor");
  it("税率ごとに合計する", () => {
    expect(t.byRate).toEqual([
      { rate: 10, base: 1000, tax: 100 },
      { rate: 8, base: 3060, tax: 244 }, // 3,060 × 8% = 244.8 → 244
    ]);
  });
  it("総額", () => expect([t.subtotal, t.tax, t.total]).toEqual([4060, 344, 4404]));
});

describe("四捨五入の境目", () => {
  it("0.5円は切り上がる", () => expect(calcTotals([L(105, 1, 10)], "round").tax).toBe(11)); // 10.5
  it("0.4円は切り捨てられる", () => expect(calcTotals([L(104, 1, 10)], "round").tax).toBe(10)); // 10.4
  it("8%の端数（12.96円）", () => expect(calcTotals([L(162, 1, 8)], "round").tax).toBe(13));
});

it("明細がない税率は出さない", () => {
  expect(calcTotals([L(500, 2, 8)], "floor").byRate.map((r) => r.rate)).toEqual([8]);
});
