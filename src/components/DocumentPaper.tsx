// 見積書・請求書の紙面（詳細画面と印刷画面で共通）
// 適格請求書の記載事項: ①交付先 ②発行者の名称と登録番号 ③取引年月日 ④取引内容（軽減税率の対象品目である旨）
// ⑤税率ごとの対価の合計と適用税率 ⑥税率ごとの消費税額  （国税庁「インボイス制度の概要」）
import { KIND_LABEL, type Doc } from "@/lib/repo";
import { ROUNDING_LABEL, lineAmount, yen } from "@/lib/tax";

const jpDate = (d: string) => (d ? `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日` : "");

export function DocumentPaper({ doc }: { doc: Doc }) {
  const isInvoice = doc.kind === "invoice";
  const hasReduced = doc.lines.some((l) => l.taxRate === 8);
  const i = doc.issuer;
  return (
    <div className="paper">
      <h1>{KIND_LABEL[doc.kind]}</h1>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10mm" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14pt", borderBottom: "1px solid #111", paddingBottom: "1mm", marginBottom: "4mm" }}>
            {doc.clientName}　{doc.clientHonorific}
          </div>
          <div>件名：{doc.subject}</div>
          <div style={{ marginTop: "5mm" }}>
            {isInvoice ? "下記のとおりご請求申し上げます。" : "下記のとおりお見積り申し上げます。"}
          </div>
          <div style={{ marginTop: "3mm" }}>
            {isInvoice ? "ご請求金額" : "お見積金額"}（税込）
            <span className="grand" style={{ marginLeft: "4mm" }}>{yen(doc.totals.total)}</span>
          </div>
        </div>
        <div style={{ width: "72mm", fontSize: "9.5pt" }}>
          <div>{isInvoice ? "請求書番号" : "見積書番号"}：{doc.number}</div>
          <div>発行日：{jpDate(doc.issueDate)}</div>
          {doc.dueDate && <div>{isInvoice ? "お支払期限" : "有効期限"}：{jpDate(doc.dueDate)}</div>}
          <div style={{ marginTop: "4mm", fontWeight: 700, fontSize: "11pt" }}>{i.companyName || "（自社情報が未登録です）"}</div>
          {i.registrationNumber && <div>登録番号：{i.registrationNumber}</div>}
          {(i.postalCode || i.address) && <div>{i.postalCode && `〒${i.postalCode} `}{i.address}</div>}
          {i.phone && <div>TEL：{i.phone}</div>}
        </div>
      </div>

      <table className="items">
        <thead>
          <tr><th style={{ width: "46%" }}>品目</th><th>数量</th><th>単位</th><th>単価</th><th>金額</th></tr>
        </thead>
        <tbody>
          {doc.lines.map((l, n) => (
            <tr key={n}>
              <td>{l.description}{l.taxRate === 8 && " ※"}</td>
              <td className="num">{l.quantity.toLocaleString("ja-JP")}</td>
              <td>{l.unit}</td>
              <td className="num">{yen(l.unitPrice)}</td>
              <td className="num">{yen(lineAmount(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4mm", gap: "8mm" }}>
        <div style={{ fontSize: "9pt" }}>
          {hasReduced && <div>※は軽減税率（8%）の対象品目です。</div>}
          <div>金額は税抜です。消費税は税率ごとに合計して計算しています（1円未満{ROUNDING_LABEL[doc.rounding]}）。</div>
        </div>
        <table className="items" style={{ width: "80mm", marginTop: 0 }}>
          <tbody>
            {doc.totals.byRate.map((r) => (
              <tr key={r.rate}>
                <td>{r.rate}%対象{r.rate === 8 ? "（軽減税率）" : ""}</td>
                <td className="num">{yen(r.base)}<br /><span style={{ fontSize: "8.5pt" }}>消費税 {yen(r.tax)}</span></td>
              </tr>
            ))}
            <tr><td>小計（税抜）</td><td className="num">{yen(doc.totals.subtotal)}</td></tr>
            <tr><td>消費税</td><td className="num">{yen(doc.totals.tax)}</td></tr>
            <tr><th>合計（税込）</th><th className="num">{yen(doc.totals.total)}</th></tr>
          </tbody>
        </table>
      </div>

      {isInvoice && i.bankInfo && (
        <div style={{ marginTop: "8mm", border: "1px solid #555", padding: "3mm 4mm" }}>
          <div style={{ fontWeight: 700 }}>お振込先</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{i.bankInfo}</div>
        </div>
      )}
      {doc.notes && (
        <div style={{ marginTop: "6mm" }}>
          <div style={{ fontWeight: 700 }}>備考</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{doc.notes}</div>
        </div>
      )}
    </div>
  );
}
