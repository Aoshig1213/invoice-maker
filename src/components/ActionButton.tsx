"use client";
// 1つのボタンで1つのサーバー処理を呼ぶ（状態の変更・削除・請求書への変換など）
import { useActionState } from "react";
import type { FormState } from "@/app/actions";

type Props = {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  fields: Record<string, string | number>;
  label: string;
  className?: string;
  confirm?: string;
};

export function ActionButton({ action, fields, label, className = "btn", confirm }: Props) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} style={{ display: "inline" }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={className} disabled={pending}>{pending ? "処理中…" : label}</button>
      {state.message && !state.ok && <div className="err" role="alert">{state.message}</div>}
    </form>
  );
}
