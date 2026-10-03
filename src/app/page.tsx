import Link from "next/link";
import { getDb } from "@/lib/db";
import { KIND_LABEL, STATUS_LABEL, listDocuments, type Kind, type Status } from "@/lib/repo";
import { yen } from "@/lib/tax";

export default async function DocumentsPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q), kind = one(sp.kind) as Kind | "", status = one(sp.status) as Status | "";
  const docs = listDocuments(getDb(), { q, kind: kind in KIND_LABEL ? kind : "", status: status in STATUS_LABEL ? status : "" });
  const unpaid = docs.filter((d) => d.kind === "invoice" && d.status === "issued").reduce((s, d) => s + d.totals.total, 0);

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>書類一覧</h1>
        <div className="spacer" />
        <Link className="btn" href="/documents/new?kind=quote">＋ 見積書を作る</Link>
        <Link className="btn primary" href="/documents/new?kind=invoice">＋ 請求書を作る</Link>
      </div>

      <form className="row card" style={{ padding: 12, marginBottom: 16 }}>
        <input name="q" defaultValue={q} placeholder="番号・件名・取引先で探す" style={{ maxWidth: 320 }} />
        <select name="kind" defaultValue={kind} style={{ width: 130 }}>
          <option value="">すべての種類</option><option value="quote">見積書</option><option value="invoice">請求書</option>
        </select>
        <select name="status" defaultValue={status} style={{ width: 140 }}>
          <option value="">すべての状態</option><option value="draft">下書き</option><option value="issued">発行済み</option><option value="paid">入金済み</option>
        </select>
        <button className="btn">絞り込む</button>
        {(q || kind || status) && <Link href="/">条件を消す</Link>}
        <div className="spacer" />
        <span className="muted">入金待ちの請求 <b style={{ color: "var(--ink)" }}>{yen(unpaid)}</b></span>
      </form>

      {docs.length === 0 ? (
        <div className="card muted">書類はまだありません。右上のボタンから作れます。</div>
      ) : (
        <table className="list">
          <thead>
            <tr><th>種類</th><th>番号</th><th>発行日</th><th>取引先</th><th>件名</th><th className="num">合計（税込）</th><th>状態</th></tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td><span className={`badge ${d.kind}`}>{KIND_LABEL[d.kind]}</span></td>
                <td><Link href={`/documents/${d.id}`}>{d.number}</Link></td>
                <td>{d.issueDate}</td>
                <td>{d.clientName}</td>
                <td>{d.subject}</td>
                <td className="num">{yen(d.totals.total)}</td>
                <td><span className={`badge ${d.status}`}>{STATUS_LABEL[d.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
