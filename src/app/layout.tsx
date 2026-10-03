import type { Metadata } from "next";
import { Nav } from "./nav";
import "./globals.css";

// 毎回データベースを読むので、ビルド時に固定しない
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "見積書・請求書メーカー",
  description: "インボイス制度の記載事項に対応した、見積書・請求書の作成アプリ（サンプル）",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>
        <Nav />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
