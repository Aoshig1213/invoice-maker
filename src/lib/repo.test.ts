import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { openDb } from "./db";
import * as repo from "./repo";
import { documentSchema, registrationNumber, settingsSchema } from "./schema";

let db: Database.Database;
let clientId: number;

const doc = (over: Partial<Parameters<typeof repo.createDocument>[1]> = {}) => documentSchema.parse({
  kind: "quote", clientId, issueDate: "2026-10-04", dueDate: "2026-10-31", subject: "Webサイト改修", notes: "",
  lines: [{ description: "作業費", quantity: 10, unit: "時間", unitPrice: 4000, taxRate: 10 }], ...over,
});

beforeEach(() => {
  db = openDb(":memory:");
  repo.saveSettings(db, settingsSchema.parse({ companyName: "サンプル商店", registrationNumber: "T1234567890123", postalCode: "", address: "",
    phone: "", bankInfo: "", rounding: "floor" }));
  clientId = repo.saveClient(db, { name: "株式会社テスト", honorific: "御中", contactPerson: "", email: "", address: "" });
});

describe("採番", () => {
  it("種類と年ごとに1から振る", () => {
    const a = repo.createDocument(db, doc());
    const b = repo.createDocument(db, doc());
    const c = repo.createDocument(db, doc({ kind: "invoice" }));
    const d = repo.createDocument(db, doc({ issueDate: "2027-01-05", dueDate: "" }));
    expect([a, b, c, d].map((id) => repo.getDocument(db, id)!.number)).toEqual(["Q-2026-0001", "Q-2026-0002", "I-2026-0001", "Q-2027-0001"]);
  });
});

describe("発行後は編集できない", () => {
  it("下書きは編集できる", () => {
    const id = repo.createDocument(db, doc());
    repo.updateDocument(db, id, doc({ subject: "変更後" }));
    expect(repo.getDocument(db, id)!.subject).toBe("変更後");
  });
  it("発行済みは編集・削除できない", () => {
    const id = repo.createDocument(db, doc());
    repo.setStatus(db, id, "issued");
    expect(() => repo.updateDocument(db, id, doc())).toThrow(/編集できません/);
    expect(() => repo.deleteDocument(db, id)).toThrow(/下書きだけ/);
  });
  it("発行後に自社情報を変えても、発行済みの書類の記載は変わらない", () => {
    const id = repo.createDocument(db, doc());
    repo.setStatus(db, id, "issued");
    repo.saveSettings(db, { ...repo.getSettings(db), companyName: "新しい屋号", rounding: "ceil" });
    const d = repo.getDocument(db, id)!;
    expect(d.issuer.companyName).toBe("サンプル商店");
    expect(d.rounding).toBe("floor");
  });
});

describe("状態の変更", () => {
  it("見積書は入金済みにできない", () => {
    const id = repo.createDocument(db, doc());
    repo.setStatus(db, id, "issued");
    expect(() => repo.setStatus(db, id, "paid")).toThrow(/変えられません/);
  });
  it("登録番号がないと請求書を発行できない", () => {
    repo.saveSettings(db, { ...repo.getSettings(db), registrationNumber: "" });
    const id = repo.createDocument(db, doc({ kind: "invoice" }));
    expect(() => repo.setStatus(db, id, "issued")).toThrow(/登録番号/);
  });
});

describe("見積書から請求書を作る", () => {
  it("明細を写し、元の見積書をたどれる", () => {
    const q = repo.createDocument(db, doc({ lines: [
      { description: "作業費", quantity: 10, unit: "時間", unitPrice: 4000, taxRate: 10 },
      { description: "お菓子（差し入れ）", quantity: 2, unit: "箱", unitPrice: 1080, taxRate: 8 }] }));
    const i = repo.invoiceFromQuote(db, q, "2026-11-01", "2026-11-30");
    const inv = repo.getDocument(db, i)!;
    expect(inv.kind).toBe("invoice");
    expect(inv.sourceQuoteId).toBe(q);
    expect(inv.lines).toHaveLength(2);
    expect(inv.totals.total).toBe(repo.getDocument(db, q)!.totals.total);
    expect(() => repo.deleteDocument(db, q)).toThrow(/請求書があるため/);
  });
});

describe("取引先", () => {
  it("書類がある取引先は削除できない", () => {
    repo.createDocument(db, doc());
    expect(() => repo.deleteClient(db, clientId)).toThrow(/削除できません/);
  });
});

describe("検索", () => {
  it("番号・件名・取引先名で探せる", () => {
    repo.createDocument(db, doc({ subject: "ロゴ制作" }));
    repo.createDocument(db, doc({ subject: "保守" }));
    expect(repo.listDocuments(db, { q: "ロゴ" })).toHaveLength(1);
    expect(repo.listDocuments(db, { q: "テスト" })).toHaveLength(2);
    expect(repo.listDocuments(db, { kind: "invoice" })).toHaveLength(0);
  });
});

describe("入力チェック", () => {
  it("登録番号は T＋13桁。全角やハイフンは直す", () => {
    expect(registrationNumber.parse("t１２３４-５６７８９０１２３")).toBe("T1234567890123");
    expect(registrationNumber.parse("Ｔ１２３４－５６７８ ９０１２３")).toBe("T1234567890123");
    expect(registrationNumber.safeParse("T123").success).toBe(false);
    expect(registrationNumber.parse("")).toBe("");
  });
  it("期限は発行日より後", () => {
    expect(documentSchema.safeParse({ ...doc(), dueDate: "2026-10-01" }).success).toBe(false);
  });
  it("数量は小数2桁まで", () => {
    const bad = { ...doc(), lines: [{ description: "x", quantity: 1.234, unit: "", unitPrice: 100, taxRate: 10 }] };
    expect(documentSchema.safeParse(bad).success).toBe(false);
  });
});
