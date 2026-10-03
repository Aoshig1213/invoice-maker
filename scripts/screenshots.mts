// README 用の画面写真と、印刷（PDF）の確認用ファイルを作る
// 使い方: サンプルデータ入りのサーバーを起動しておき（npm run seed → npm run build → npm start）、
//         npx tsx scripts/screenshots.ts [URL]（省略時 http://localhost:3000）
import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "docs/images";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, locale: "ja-JP" });
const shot = async (path: string, name: string, full = false) => {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  console.log(`${out}/${name}.png`);
};

await shot("/", "list");
// 一覧から、軽減税率の明細がある請求書を開く
await page.goto(base + "/?q=" + encodeURIComponent("メニュー撮影"));
await page.locator("table.list a").first().click();
await page.waitForURL(/\/documents\/\d+$/);
const id = page.url().split("/").pop();
await shot(`/documents/${id}`, "invoice", true);
await page.goto(`${base}/documents/${id}/print`);
await page.pdf({ path: `${out}/invoice.pdf`, format: "A4", printBackground: true });
console.log(`${out}/invoice.pdf`);

// 入力画面（明細を足しながら合計が出る）
await page.goto(base + "/documents/new?kind=invoice");
await page.getByLabel("取引先").selectOption({ index: 1 });
await page.getByLabel("件名").fill("10月分 保守作業");
await page.getByLabel("品目1").fill("サイト保守（月額）");
await page.getByLabel("単価1").fill("20000");
await page.getByRole("button", { name: "＋ 明細を足す" }).click();
await page.getByLabel("品目2").fill("打ち合わせ用の弁当");
await page.getByLabel("数量2").fill("4");
await page.getByLabel("単位2").fill("個");
await page.getByLabel("単価2").fill("864");
await page.getByLabel("税率2").selectOption("8");
await page.screenshot({ path: `${out}/form.png`, fullPage: true });
console.log(`${out}/form.png`);

await shot("/settings", "settings", true);
await browser.close();
