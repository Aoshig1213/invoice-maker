"use server";
// フォームから呼ばれるサーバー側の処理。入力チェック → 保存 → 画面の再読み込み
// ※ 1人で使う前提のサンプルのため、ログインと権限の確認は入れていない（README に記載）
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";
import { clientSchema, documentSchema, fieldErrors, settingsSchema } from "@/lib/schema";

// values: 入力ミスで保存しなかったとき、入れた内容を画面に戻すための値（送信後にフォームが初期値に戻るため）
export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const id = (fd: FormData) => Number(fd.get("id"));
const values = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

function fail(e: unknown, fd?: FormData): FormState {
  if (e instanceof repo.RuleError) return { message: e.message, values: fd && values(fd) };
  throw e;
}

export async function saveSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = settingsSchema.safeParse({ companyName: str(fd, "companyName"), registrationNumber: str(fd, "registrationNumber"),
    postalCode: str(fd, "postalCode"), address: str(fd, "address"), phone: str(fd, "phone"), bankInfo: str(fd, "bankInfo"), rounding: str(fd, "rounding") });
  if (!p.success) return { errors: fieldErrors(p.error), values: values(fd) };
  repo.saveSettings(getDb(), p.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "保存しました" };
}

export async function saveClientAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = clientSchema.safeParse({ name: str(fd, "name"), honorific: str(fd, "honorific"), contactPerson: str(fd, "contactPerson"),
    email: str(fd, "email"), address: str(fd, "address") });
  if (!p.success) return { errors: fieldErrors(p.error), values: values(fd) };
  try {
    repo.saveClient(getDb(), p.data, id(fd) || undefined);
  } catch (e) { return fail(e, fd); }
  revalidatePath("/clients");
  redirect("/clients");
}

export async function deleteClientAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    repo.deleteClient(getDb(), id(fd));
  } catch (e) { return fail(e); }
  revalidatePath("/clients");
  return { ok: true, message: "削除しました" };
}

// 明細は lines.0.description のような名前で届くので、配列に組み直す
function readDocument(fd: FormData) {
  const lines: Record<string, string>[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^lines\.(\d+)\.(\w+)$/.exec(k);
    if (m) (lines[Number(m[1])] ??= {})[m[2]] = String(v);
  }
  return documentSchema.safeParse({ kind: str(fd, "kind"), clientId: str(fd, "clientId"), issueDate: str(fd, "issueDate"),
    dueDate: str(fd, "dueDate"), subject: str(fd, "subject"), notes: str(fd, "notes"), lines: lines.filter(Boolean) });
}

export async function saveDocumentAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = readDocument(fd);
  if (!p.success) return { errors: fieldErrors(p.error), message: "入力内容を確認してください", values: values(fd) };
  let docId = id(fd);
  try {
    if (docId) repo.updateDocument(getDb(), docId, p.data);
    else docId = repo.createDocument(getDb(), p.data);
  } catch (e) { return fail(e, fd); }
  revalidatePath("/");
  redirect(`/documents/${docId}`);
}

export async function setStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    repo.setStatus(getDb(), id(fd), str(fd, "status") as repo.Status);
  } catch (e) { return fail(e); }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteDocumentAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    repo.deleteDocument(getDb(), id(fd));
  } catch (e) { return fail(e); }
  revalidatePath("/");
  redirect("/");
}

export async function invoiceFromQuoteAction(_: FormState, fd: FormData): Promise<FormState> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  let newId: number;
  try {
    newId = repo.invoiceFromQuote(getDb(), id(fd), today, "");
  } catch (e) { return fail(e); }
  revalidatePath("/");
  redirect(`/documents/${newId}/edit`);
}
