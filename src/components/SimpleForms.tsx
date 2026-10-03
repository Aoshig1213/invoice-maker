"use client";
// 自社情報と取引先の入力フォーム
import Link from "next/link";
import { useActionState } from "react";
import { saveClientAction, saveSettingsAction, type FormState } from "@/app/actions";
import type { Client, Settings } from "@/lib/repo";

function Field({ name, label, def, err, placeholder, area }: { name: string; label: string; def?: string; err?: string; placeholder?: string; area?: boolean }) {
  // defaultValue は送信後のリセットで戻る値。入力ミスのときは、入れた値に戻す
  return (
    <label className="field"><span>{label}</span>
      {area ? <textarea name={name} defaultValue={def} rows={3} placeholder={placeholder} /> : <input name={name} defaultValue={def} placeholder={placeholder} />}
      {err && <div className="err">{err}</div>}
    </label>
  );
}

export function SettingsForm({ s }: { s: Settings }) {
  const [state, save, pending] = useActionState<FormState, FormData>(saveSettingsAction, {});
  const e = state.errors ?? {};
  const v = (k: keyof Settings) => state.values?.[k] ?? s[k];
  return (
    <form action={save} className="card" style={{ maxWidth: 680 }}>
      {state.message && <div className={`notice ${state.ok ? "ok" : "ng"}`} role="status">{state.message}</div>}
      <Field name="companyName" label="会社名・屋号" def={v("companyName")} err={e.companyName} />
      <Field name="registrationNumber" label="適格請求書発行事業者の登録番号（請求書を発行するときに必要）" def={v("registrationNumber")} err={e.registrationNumber} placeholder="T1234567890123" />
      <div className="grid2">
        <Field name="postalCode" label="郵便番号" def={v("postalCode")} err={e.postalCode} />
        <Field name="phone" label="電話番号" def={v("phone")} err={e.phone} />
      </div>
      <Field name="address" label="住所" def={v("address")} err={e.address} />
      <Field name="bankInfo" label="振込先（請求書に載せます）" def={v("bankInfo")} err={e.bankInfo} area placeholder={"例: ○○銀行 △△支店 普通 1234567\nサンプル（カ"} />
      <label className="field"><span>消費税の端数処理（1円未満）</span>
        <select name="rounding" defaultValue={v("rounding")}>
          <option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option>
        </select>
        <div className="muted" style={{ fontSize: 13 }}>税率ごとに1回だけ処理します。発行済みの書類には影響しません。</div>
      </label>
      <button className="btn primary" disabled={pending}>{pending ? "保存中…" : "保存する"}</button>
    </form>
  );
}

export function ClientForm({ c }: { c?: Client }) {
  const [state, save, pending] = useActionState<FormState, FormData>(saveClientAction, {});
  const e = state.errors ?? {};
  const v = (k: "name" | "honorific" | "contactPerson" | "email" | "address") => state.values?.[k] ?? c?.[k];
  return (
    <form action={save} className="card" style={{ maxWidth: 680 }}>
      {state.message && <div className="notice ng" role="alert">{state.message}</div>}
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid2">
        <Field name="name" label="取引先名" def={v("name")} err={e.name} placeholder="株式会社サンプル" />
        <label className="field"><span>敬称</span>
          <select name="honorific" defaultValue={v("honorific") ?? "御中"}><option>御中</option><option>様</option></select></label>
      </div>
      <div className="grid2">
        <Field name="contactPerson" label="担当者（任意）" def={v("contactPerson")} err={e.contactPerson} />
        <Field name="email" label="メールアドレス（任意）" def={v("email")} err={e.email} />
      </div>
      <Field name="address" label="住所（任意）" def={v("address")} err={e.address} />
      <div className="row">
        <button className="btn primary" disabled={pending}>{pending ? "保存中…" : "保存する"}</button>
        <Link className="btn" href="/clients">やめる</Link>
      </div>
    </form>
  );
}
