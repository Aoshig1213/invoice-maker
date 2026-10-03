import Link from "next/link";
import { deleteClientAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { getDb } from "@/lib/db";
import { listClients } from "@/lib/repo";

export default function ClientsPage() {
  const clients = listClients(getDb());
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>取引先</h1>
        <div className="spacer" />
        <Link className="btn primary" href="/clients/new">＋ 取引先を登録</Link>
      </div>
      {clients.length === 0 ? (
        <div className="card muted">取引先はまだありません。</div>
      ) : (
        <table className="list">
          <thead><tr><th>取引先名</th><th>担当者</th><th>メールアドレス</th><th className="num">書類</th><th /></tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name} <span className="muted">{c.honorific}</span></td>
                <td>{c.contactPerson}</td>
                <td>{c.email}</td>
                <td className="num">{c.documentCount}件</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <Link className="btn" href={`/clients/${c.id}/edit`}>編集</Link>{" "}
                  <ActionButton action={deleteClientAction} fields={{ id: c.id }} label="削除" className="btn danger" confirm={`「${c.name}」を削除します。よろしいですか？`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
