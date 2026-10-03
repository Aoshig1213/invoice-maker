import { expect, test, type Page } from "@playwright/test";

// 登録 → 見積書 → 発行 → 請求書に変換 → 印刷画面、を順番に確かめる
test.describe.configure({ mode: "serial" });

async function fillLine(page: Page, i: number, d: string, q: string, unit: string, price: string, rate: "10" | "8") {
  await page.getByLabel(`品目${i}`).fill(d);
  await page.getByLabel(`数量${i}`).fill(q);
  await page.getByLabel(`単位${i}`).fill(unit);
  await page.getByLabel(`単価${i}`).fill(price);
  await page.getByLabel(`税率${i}`).selectOption(rate);
}

test("自社情報：登録番号の形が違うと保存できない", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("会社名・屋号").fill("テスト制作室");
  await page.getByLabel(/登録番号/).fill("T123");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("登録番号は「T」と13桁の数字で入力してください")).toBeVisible();
  // 全角とハイフンで入れても、正しい形に直して保存する
  await page.getByLabel(/登録番号/).fill("Ｔ１２３４－５６７８９０１２３");
  await page.getByLabel(/振込先/).fill("テスト銀行 本店 普通 7654321");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("保存しました")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/登録番号/)).toHaveValue("T1234567890123");
});

test("取引先を登録する", async ({ page }) => {
  await page.goto("/clients/new");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("取引先名を入力してください")).toBeVisible();
  await page.getByLabel("取引先名").fill("株式会社テスト商事");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.getByRole("cell", { name: /株式会社テスト商事/ })).toBeVisible();
});

test("見積書を作り、発行して、請求書に変える", async ({ page }) => {
  await page.goto("/documents/new?kind=quote");
  await page.getByLabel("取引先").selectOption({ label: "株式会社テスト商事" });
  await page.getByLabel("件名").fill("店舗サイトの更新");
  await fillLine(page, 1, "ページ更新作業", "1.5", "時間", "4000", "10");
  await page.getByRole("button", { name: "＋ 明細を足す" }).click();
  await fillLine(page, 2, "差し入れのお菓子", "3", "箱", "1080", "8");
  // 入力しながら合計が出る: 10%対象 6,000 / 8%対象 3,240 → 税 600 + 259（259.2 を切り捨て）
  await expect(page.getByText("¥10,099")).toBeVisible();
  await page.getByRole("button", { name: "下書きとして保存" }).click();

  await expect(page).toHaveURL(/\/documents\/\d+$/);
  await expect(page.getByRole("heading", { name: /見積書 Q-\d{4}-0001/ })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "発行済みにする" }).click();
  await expect(page.locator(".badge.issued")).toBeVisible();
  await expect(page.getByRole("link", { name: "編集" })).toHaveCount(0);

  await page.getByRole("button", { name: "この見積書から請求書を作る" }).click();
  await expect(page).toHaveURL(/\/documents\/\d+\/edit$/);
  await expect(page.getByLabel("品目2")).toHaveValue("差し入れのお菓子");
  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.getByRole("heading", { name: /請求書 I-\d{4}-0001/ })).toBeVisible();
  await expect(page.getByText(/元の見積書：Q-\d{4}-0001/)).toBeVisible();
});

test("印刷画面に適格請求書の記載事項がそろっている", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /I-\d{4}-0001/ }).click();
  await page.waitForURL(/\/documents\/\d+$/);
  const id = page.url().split("/").pop();
  await page.goto(`/documents/${id}/print`);
  const paper = page.locator(".paper");
  await expect(paper.getByText("株式会社テスト商事　御中")).toBeVisible();          // 交付先
  await expect(paper.getByText("テスト制作室")).toBeVisible();                     // 発行者
  await expect(paper.getByText("登録番号：T1234567890123")).toBeVisible();          // 登録番号
  await expect(paper.getByText(/発行日：\d{4}年/)).toBeVisible();                  // 取引年月日
  await expect(paper.getByText("差し入れのお菓子 ※")).toBeVisible();              // 軽減税率の対象である旨
  await expect(paper.getByText("※は軽減税率（8%）の対象品目です。")).toBeVisible();
  await expect(paper.getByText("10%対象")).toBeVisible();                           // 税率ごとの合計
  await expect(paper.getByText("8%対象（軽減税率）")).toBeVisible();
  await expect(paper.getByText("消費税 ¥600")).toBeVisible();                       // 税率ごとの消費税額
  await expect(paper.getByText("消費税 ¥259")).toBeVisible();
  await expect(paper.getByText("テスト銀行 本店 普通 7654321")).toBeVisible();      // 振込先
});

test("入力ミスはその場で知らせ、保存しない", async ({ page }) => {
  await page.goto("/documents/new?kind=invoice");
  await page.getByLabel("件名").fill("確認用");
  await page.getByLabel("数量1").fill("1.234");
  await page.getByLabel("単価1").fill("abc");
  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.getByText("入力内容を確認してください")).toBeVisible();
  await expect(page.getByText("取引先を選んでください")).toBeVisible();
  await expect(page.getByText("品目を入力してください")).toBeVisible();
  await expect(page.getByText("数量は小数2桁までにしてください")).toBeVisible();
  await expect(page).toHaveURL(/\/documents\/new/);
});

test("書類がある取引先は削除できない", async ({ page }) => {
  await page.goto("/clients");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText(/書類が\d件あるため削除できません/)).toBeVisible();
});

test("一覧で絞り込める", async ({ page }) => {
  await page.goto("/?kind=invoice");
  await expect(page.locator("table.list tbody tr")).toHaveCount(1);
  await page.goto("/?q=存在しない件名");
  await expect(page.getByText("書類はまだありません")).toBeVisible();
});
