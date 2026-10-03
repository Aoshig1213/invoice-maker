// 動作確認用のサンプルデータを入れる（会社・取引先はすべて架空）
// 使い方: npm run seed（DB_PATH を指定しなければ data/app.db）
import path from "node:path";
import { openDb } from "../src/lib/db";
import * as repo from "../src/lib/repo";
import { documentSchema, settingsSchema } from "../src/lib/schema";

const db = openDb(process.env.DB_PATH || path.join(process.cwd(), "data", "app.db"));
if (repo.listClients(db).length) {
  console.log("すでにデータがあるため、何もしませんでした");
  process.exit(0);
}
repo.saveSettings(db, settingsSchema.parse({
  companyName: "サンプル制作室", registrationNumber: "T1234567890123", postalCode: "100-0001", address: "東京都千代田区千代田0-0-0（架空）",
  phone: "03-0000-0000", bankInfo: "サンプル銀行 本店営業部 普通 1234567\nサンプルセイサクシツ", rounding: "floor",
}));
const a = repo.saveClient(db, { name: "株式会社みなと商事", honorific: "御中", contactPerson: "山田", email: "", address: "" });
const b = repo.saveClient(db, { name: "カフェ・ひなた", honorific: "御中", contactPerson: "", email: "", address: "" });
repo.saveClient(db, { name: "佐藤 花子", honorific: "様", contactPerson: "", email: "", address: "" });

const doc = (o: object) => documentSchema.parse({ dueDate: "", notes: "", ...o });
const q1 = repo.createDocument(db, doc({ kind: "quote", clientId: a, issueDate: "2026-09-10", dueDate: "2026-10-10", subject: "コーポレートサイト改修",
  lines: [{ description: "トップページのデザイン修正", quantity: 1, unit: "式", unitPrice: 80000, taxRate: 10 },
    { description: "お問い合わせフォームの改修", quantity: 6, unit: "時間", unitPrice: 5000, taxRate: 10 }] }));
repo.setStatus(db, q1, "issued");
const i1 = repo.invoiceFromQuote(db, q1, "2026-09-30", "2026-10-31");
repo.setStatus(db, i1, "issued");
const i2 = repo.createDocument(db, doc({ kind: "invoice", clientId: b, issueDate: "2026-09-25", dueDate: "2026-10-25", subject: "9月分 メニュー撮影と焼き菓子",
  notes: "お振込手数料はご負担をお願いいたします。",
  lines: [{ description: "メニュー写真の撮影", quantity: 1, unit: "式", unitPrice: 30000, taxRate: 10 },
    { description: "焼き菓子の詰め合わせ（撮影用）", quantity: 3, unit: "箱", unitPrice: 1080, taxRate: 8 },
    { description: "撮影の追加時間", quantity: 1.5, unit: "時間", unitPrice: 4000, taxRate: 10 }] }));
repo.setStatus(db, i2, "issued");
repo.setStatus(db, i2, "paid");
repo.createDocument(db, doc({ kind: "quote", clientId: b, issueDate: "2026-10-03", subject: "Instagram 投稿用の画像制作",
  lines: [{ description: "投稿用画像（1枚）", quantity: 8, unit: "枚", unitPrice: 3500, taxRate: 10 }] }));
console.log("サンプルデータを入れました");
