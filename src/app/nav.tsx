"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "書類一覧" },
  { href: "/clients", label: "取引先" },
  { href: "/settings", label: "自社情報" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/documents") : path.startsWith(href));
  return (
    <nav className="nav no-print">
      <div className="nav-inner">
        <Link href="/" className="brand">見積書・請求書メーカー</Link>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={active(i.href) ? "active" : ""}>{i.label}</Link>
        ))}
      </div>
    </nav>
  );
}
