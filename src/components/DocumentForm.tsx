"use client";
// 見積書・請求書の入力フォーム。明細を足したり消したりしながら、合計をその場で計算して見せる
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveDocumentAction, type FormState } from "@/app/actions";
import type { Client, Kind, Line } from "@/lib/repo";
import { ROUNDING_LABEL, calcTotals, lineAmount, type Rounding, type TaxRate, yen } from "@/lib/tax";

type Initial = { id?: number; kind: Kind; clientId?: number; issueDate: string; dueDate: string; subject: string; notes: string; lines: Line[] };
type Row = { key: number; description: string; quantity: string; unit: string; unitPrice: string; taxRate: string };

let seq = 0;
const toRow = (l?: Line): Row => ({ key: ++seq, description: l?.description ?? "", quantity: String(l?.quantity ?? 1), unit: l?.unit ?? "式",
  unitPrice: l ? String(l.unitPrice) : "", taxRate: String(l?.taxRate ?? 10) });

export function DocumentForm({ initial, clients, rounding }: { initial: Initial; clients: Client[]; rounding: Rounding }) {
  const [state, save, pending] = useActionState<FormState, FormData>(saveDocumentAction, {});
  const [rows, setRows] = useState<Row[]>(() => (initial.lines.length ? initial.lines.map(toRow) : [toRow()]));
  const e = state.errors ?? {};
  const isInvoice = initial.kind === "invoice";
  // 入力ミスのときは、入れた値に戻す（送信後にフォームが初期値に戻るため）。明細は画面側で持っているので消えない
  const v = (k: "clientId" | "subject" | "issueDate" | "dueDate" | "notes") => state.values?.[k] ?? String(initial[k] ?? "");

  const set = (key: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: v } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const a = [...rs]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });
  // 入力途中の値（空欄など）は0として、合計の目安を出す
  const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);
  const totals = calcTotals(rows.map((r) => ({ unitPrice: Math.trunc(num(r.unitPrice)), quantity: num(r.quantity), taxRate: Number(r.taxRate) as TaxRate })), rounding);

  return (
    <form action={save} className="card">
      {state.message && <div className="notice ng" role="alert">{state.message}</div>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={initial.kind} />
      <div className="grid2">
        <label className="field"><span>取引先</span>
          <select name="clientId" defaultValue={v("clientId")}>
            <option value="">選んでください</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {e.clientId && <div className="err">{e.clientId}</div>}
        </label>
        <label className="field"><span>件名</span>
          <input name="subject" defaultValue={v("subject")} placeholder="例: Webサイト改修" />
          {e.subject && <div className="err">{e.subject}</div>}
        </label>
        <label className="field"><span>発行日</span>
          <input type="date" name="issueDate" defaultValue={v("issueDate")} />
          {e.issueDate && <div className="err">{e.issueDate}</div>}
        </label>
        <label className="field"><span>{isInvoice ? "お支払期限" : "有効期限"}（任意）</span>
          <input type="date" name="dueDate" defaultValue={v("dueDate")} />
          {e.dueDate && <div className="err">{e.dueDate}</div>}
        </label>
      </div>

      <h2>明細 <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>単価は税抜で入力します</span></h2>
      <table className="lines">
        <thead>
          <tr><th style={{ width: "36%" }}>品目</th><th style={{ width: 90 }}>数量</th><th style={{ width: 80 }}>単位</th>
            <th style={{ width: 120 }}>単価（円）</th><th style={{ width: 130 }}>税率</th><th className="num" style={{ width: 110 }}>金額</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key}>
              <td><input name={`lines.${i}.description`} value={r.description} onChange={(ev) => set(r.key, "description", ev.target.value)} aria-label={`品目${i + 1}`} />
                {e[`lines.${i}.description`] && <div className="err">{e[`lines.${i}.description`]}</div>}</td>
              <td><input name={`lines.${i}.quantity`} value={r.quantity} inputMode="decimal" onChange={(ev) => set(r.key, "quantity", ev.target.value)} aria-label={`数量${i + 1}`} />
                {e[`lines.${i}.quantity`] && <div className="err">{e[`lines.${i}.quantity`]}</div>}</td>
              <td><input name={`lines.${i}.unit`} value={r.unit} onChange={(ev) => set(r.key, "unit", ev.target.value)} aria-label={`単位${i + 1}`} /></td>
              <td><input name={`lines.${i}.unitPrice`} value={r.unitPrice} inputMode="numeric" onChange={(ev) => set(r.key, "unitPrice", ev.target.value)} aria-label={`単価${i + 1}`} />
                {e[`lines.${i}.unitPrice`] && <div className="err">{e[`lines.${i}.unitPrice`]}</div>}</td>
              <td><select name={`lines.${i}.taxRate`} value={r.taxRate} onChange={(ev) => set(r.key, "taxRate", ev.target.value)} aria-label={`税率${i + 1}`}>
                <option value="10">10%</option><option value="8">8%（軽減）</option></select></td>
              <td className="num" style={{ paddingTop: 11 }}>{yen(lineAmount({ unitPrice: Math.trunc(num(r.unitPrice)), quantity: num(r.quantity) }))}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button type="button" className="btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ">↑</button>{" "}
                <button type="button" className="btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="下へ">↓</button>{" "}
                <button type="button" className="btn danger" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} disabled={rows.length === 1} aria-label="この行を消す">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {e.lines && <div className="err">{e.lines}</div>}
      <div className="row" style={{ margin: "8px 0 16px" }}>
        <button type="button" className="btn" onClick={() => setRows((rs) => [...rs, toRow()])} disabled={rows.length >= 50}>＋ 明細を足す</button>
      </div>

      <table className="totals">
        <tbody>
          {totals.byRate.map((t) => (
            <tr key={t.rate}><td>{t.rate}%対象 {yen(t.base)}</td><td className="num">消費税 {yen(t.tax)}</td></tr>
          ))}
          <tr><td>小計（税抜）</td><td className="num">{yen(totals.subtotal)}</td></tr>
          <tr><td>消費税（1円未満{ROUNDING_LABEL[rounding]}）</td><td className="num">{yen(totals.tax)}</td></tr>
          <tr className="grand"><td>合計（税込）</td><td className="num">{yen(totals.total)}</td></tr>
        </tbody>
      </table>

      <label className="field" style={{ marginTop: 16 }}><span>備考（任意）</span>
        <textarea name="notes" rows={3} defaultValue={v("notes")} />
        {e.notes && <div className="err">{e.notes}</div>}
      </label>
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? "保存中…" : "下書きとして保存"}</button>
        <Link className="btn" href={initial.id ? `/documents/${initial.id}` : "/"}>やめる</Link>
      </div>
    </form>
  );
}
