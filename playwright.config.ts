import { defineConfig } from "@playwright/test";
import fs from "node:fs";

// E2E テストは、実行のたびに新しい空のデータベースで本番用サーバーを起動して行う
// （サーバーが先に起動してファイルを開くため、消すのではなく別名にする。ワーカーにも同じ名前を引き継ぐ）
process.env.E2E_DB ??= `test-results/e2e-${Date.now()}.db`;
fs.mkdirSync("test-results", { recursive: true });

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3101", locale: "ja-JP", timezoneId: "Asia/Tokyo" },
  webServer: {
    command: "npx next start -p 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    env: { DB_PATH: process.env.E2E_DB },
    timeout: 60_000,
  },
});
