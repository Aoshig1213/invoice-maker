// 入力チェック（フォームから届いた値を、保存してよい形に直す）
import { z } from "zod";

const text = (max: number, label: string) => z.string().trim().max(max, `${label}は${max}文字以内で入力してください`);
const required = (max: number, label: string) => text(max, label).min(1, `${label}を入力してください`);
const date = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label}を正しい日付で入力してください`);

// 適格請求書発行事業者の登録番号は「T」＋13桁の数字
export const registrationNumber = z
  .string()
  .trim()
  .transform((s) => s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[－ー‐-]/g, "").replace(/\s/g, "").toUpperCase())
  .refine((s) => s === "" || /^T\d{13}$/.test(s), "登録番号は「T」と13桁の数字で入力してください（例: T1234567890123）");

export const settingsSchema = z.object({
  companyName: required(80, "会社名・屋号"),
  registrationNumber,
  postalCode: text(10, "郵便番号"),
  address: text(120, "住所"),
  phone: text(30, "電話番号"),
  bankInfo: text(200, "振込先"),
  rounding: z.enum(["floor", "round", "ceil"]),
});

export const clientSchema = z.object({
  name: required(80, "取引先名"),
  honorific: z.enum(["御中", "様"]),
  contactPerson: text(40, "担当者"),
  email: z.union([z.literal(""), z.string().trim().email("メールアドレスの形が正しくありません")]),
  address: text(120, "住所"),
});

export const lineSchema = z.object({
  description: required(100, "品目"),
  quantity: z.coerce.number().min(0.01, "数量は0.01以上にしてください").max(99999, "数量が大きすぎます")
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, "数量は小数2桁までにしてください"),
  unit: text(10, "単位"),
  unitPrice: z.coerce.number().int("単価は円単位の整数で入力してください").min(0, "単価は0円以上にしてください").max(99_999_999, "単価が大きすぎます"),
  taxRate: z.coerce.number().pipe(z.union([z.literal(10), z.literal(8)])),
});

export const documentSchema = z
  .object({
    kind: z.enum(["quote", "invoice"]),
    clientId: z.coerce.number().int().positive("取引先を選んでください"),
    issueDate: date("発行日"),
    dueDate: z.union([z.literal(""), date("期限")]),
    subject: required(100, "件名"),
    notes: text(500, "備考"),
    lines: z.array(lineSchema).min(1, "明細を1行以上入力してください").max(50, "明細は50行までです"),
  })
  .refine((d) => !d.dueDate || d.dueDate >= d.issueDate, { path: ["dueDate"], message: "期限は発行日より後の日付にしてください" });

export type SettingsInput = z.infer<typeof settingsSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;

// zod のエラーを { 項目名: メッセージ } にする（画面で項目の横に出すため）
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const key = i.path.join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
