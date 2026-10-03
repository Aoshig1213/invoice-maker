// データの読み書き。業務ルール（採番・発行後は編集不可・見積→請求の変換）もここで守る
import type Database from "better-sqlite3";
import type { ClientInput, DocumentInput, SettingsInput } from "./schema";
import { calcTotals, type DocumentTotals, type Rounding, type TaxRate } from "./tax";

export type Kind = "quote" | "invoice";
export type Status = "draft" | "issued" | "paid";
export const KIND_LABEL: Record<Kind, string> = { quote: "見積書", invoice: "請求書" };
export const STATUS_LABEL: Record<Status, string> = { draft: "下書き", issued: "発行済み", paid: "入金済み" };

export class RuleError extends Error {}

export type Settings = SettingsInput;
export type Client = ClientInput & { id: number };
export type Line = { description: string; quantity: number; unit: string; unitPrice: number; taxRate: TaxRate };
export type Issuer = Omit<Settings, "rounding">;
export type Doc = {
  id: number; kind: Kind; number: string; clientId: number; clientName: string; clientHonorific: string;
  issueDate: string; dueDate: string; subject: string; notes: string; status: Status; rounding: Rounding;
  issuer: Issuer; sourceQuoteId: number | null; lines: Line[]; totals: DocumentTotals;
};

// ---------- 自社情報 ----------
export function getSettings(db: Database.Database): Settings {
  const r = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, string>;
  return { companyName: r.company_name, registrationNumber: r.registration_number, postalCode: r.postal_code,
    address: r.address, phone: r.phone, bankInfo: r.bank_info, rounding: r.rounding as Rounding };
}

export function saveSettings(db: Database.Database, s: Settings): void {
  db.prepare(`UPDATE settings SET company_name=?, registration_number=?, postal_code=?, address=?, phone=?, bank_info=?, rounding=? WHERE id=1`)
    .run(s.companyName, s.registrationNumber, s.postalCode, s.address, s.phone, s.bankInfo, s.rounding);
}

// ---------- 取引先 ----------
const toClient = (r: Record<string, unknown>): Client => ({ id: r.id as number, name: r.name as string, honorific: r.honorific as "御中" | "様",
  contactPerson: r.contact_person as string, email: r.email as string, address: r.address as string });

export function listClients(db: Database.Database): (Client & { documentCount: number })[] {
  return (db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM documents d WHERE d.client_id = c.id) AS document_count
    FROM clients c ORDER BY c.name`).all() as Record<string, unknown>[]).map((r) => ({ ...toClient(r), documentCount: r.document_count as number }));
}

export function getClient(db: Database.Database, id: number): Client | null {
  const r = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? toClient(r) : null;
}

export function saveClient(db: Database.Database, c: ClientInput, id?: number): number {
  if (id) {
    const res = db.prepare("UPDATE clients SET name=?, honorific=?, contact_person=?, email=?, address=? WHERE id=?")
      .run(c.name, c.honorific, c.contactPerson, c.email, c.address, id);
    if (!res.changes) throw new RuleError("取引先が見つかりません");
    return id;
  }
  return Number(db.prepare("INSERT INTO clients (name, honorific, contact_person, email, address) VALUES (?,?,?,?,?)")
    .run(c.name, c.honorific, c.contactPerson, c.email, c.address).lastInsertRowid);
}

export function deleteClient(db: Database.Database, id: number): void {
  const used = (db.prepare("SELECT COUNT(*) AS n FROM documents WHERE client_id = ?").get(id) as { n: number }).n;
  if (used) throw new RuleError(`この取引先には書類が${used}件あるため削除できません`);
  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
}

// ---------- 書類 ----------
// 番号は「種類の頭文字-発行年-4桁の連番」。種類と年ごとに1から振る
export function nextNumber(db: Database.Database, kind: Kind, issueDate: string): string {
  const prefix = `${kind === "quote" ? "Q" : "I"}-${issueDate.slice(0, 4)}-`;
  const r = db.prepare("SELECT number FROM documents WHERE number LIKE ? ORDER BY number DESC LIMIT 1").get(prefix + "%") as { number: string } | undefined;
  const n = r ? Number(r.number.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(4, "0");
}

function issuerFrom(s: Settings): string {
  const { companyName, registrationNumber, postalCode, address, phone, bankInfo } = s;
  return JSON.stringify({ companyName, registrationNumber, postalCode, address, phone, bankInfo });
}

function writeLines(db: Database.Database, docId: number, lines: DocumentInput["lines"]): void {
  db.prepare("DELETE FROM document_lines WHERE document_id = ?").run(docId);
  const ins = db.prepare("INSERT INTO document_lines (document_id, position, description, quantity, unit, unit_price, tax_rate) VALUES (?,?,?,?,?,?,?)");
  lines.forEach((l, i) => ins.run(docId, i + 1, l.description, l.quantity, l.unit, l.unitPrice, l.taxRate));
}

export function createDocument(db: Database.Database, d: DocumentInput, sourceQuoteId: number | null = null): number {
  return db.transaction(() => {
    if (!getClient(db, d.clientId)) throw new RuleError("取引先が見つかりません");
    const s = getSettings(db);
    const id = Number(db.prepare(`INSERT INTO documents (kind, number, client_id, issue_date, due_date, subject, notes, rounding, issuer_snapshot, source_quote_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(d.kind, nextNumber(db, d.kind, d.issueDate), d.clientId, d.issueDate, d.dueDate, d.subject, d.notes,
      s.rounding, issuerFrom(s), sourceQuoteId).lastInsertRowid);
    writeLines(db, id, d.lines);
    return id;
  })();
}

export function updateDocument(db: Database.Database, id: number, d: DocumentInput): void {
  db.transaction(() => {
    const cur = getDocument(db, id);
    if (!cur) throw new RuleError("書類が見つかりません");
    if (cur.status !== "draft") throw new RuleError("発行済みの書類は編集できません。内容を変えるときは、新しい書類を作ってください");
    if (cur.kind !== d.kind) throw new RuleError("書類の種類は変えられません");
    // 下書きのあいだは、自社情報と端数処理を今の設定に合わせる
    const s = getSettings(db);
    db.prepare(`UPDATE documents SET client_id=?, issue_date=?, due_date=?, subject=?, notes=?, rounding=?, issuer_snapshot=?,
      updated_at=datetime('now','localtime') WHERE id=?`).run(d.clientId, d.issueDate, d.dueDate, d.subject, d.notes, s.rounding, issuerFrom(s), id);
    writeLines(db, id, d.lines);
  })();
}

export function setStatus(db: Database.Database, id: number, status: Status): void {
  const cur = getDocument(db, id);
  if (!cur) throw new RuleError("書類が見つかりません");
  const allowed: Record<Status, Status[]> = { draft: ["issued"], issued: cur.kind === "invoice" ? ["paid", "draft"] : ["draft"], paid: ["issued"] };
  if (!allowed[cur.status].includes(status)) throw new RuleError(`「${STATUS_LABEL[cur.status]}」から「${STATUS_LABEL[status]}」には変えられません`);
  if (status === "issued" && cur.status === "draft") {
    const s = getSettings(db);
    if (!s.companyName) throw new RuleError("発行する前に、自社情報（会社名・屋号）を登録してください");
    if (cur.kind === "invoice" && !cur.issuer.registrationNumber) throw new RuleError("請求書を発行する前に、自社情報に登録番号（T＋13桁）を登録してください");
  }
  db.prepare("UPDATE documents SET status=?, updated_at=datetime('now','localtime') WHERE id=?").run(status, id);
}

export function deleteDocument(db: Database.Database, id: number): void {
  const cur = getDocument(db, id);
  if (!cur) return;
  if (cur.status !== "draft") throw new RuleError("削除できるのは下書きだけです");
  const ref = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE source_quote_id = ?").get(id) as { n: number };
  if (ref.n) throw new RuleError("この見積書から作った請求書があるため削除できません");
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
}

// 見積書の内容を写して、請求書の下書きを作る
export function invoiceFromQuote(db: Database.Database, quoteId: number, issueDate: string, dueDate: string): number {
  const q = getDocument(db, quoteId);
  if (!q || q.kind !== "quote") throw new RuleError("見積書が見つかりません");
  return createDocument(db, { kind: "invoice", clientId: q.clientId, issueDate, dueDate, subject: q.subject, notes: q.notes,
    lines: q.lines.map((l) => ({ ...l })) }, quoteId);
}

type DocRow = Record<string, unknown>;
const toDoc = (r: DocRow, lines: Line[]): Doc => {
  const rounding = r.rounding as Rounding;
  return { id: r.id as number, kind: r.kind as Kind, number: r.number as string, clientId: r.client_id as number,
    clientName: r.client_name as string, clientHonorific: r.client_honorific as string, issueDate: r.issue_date as string,
    dueDate: r.due_date as string, subject: r.subject as string, notes: r.notes as string, status: r.status as Status, rounding,
    issuer: JSON.parse(r.issuer_snapshot as string), sourceQuoteId: (r.source_quote_id as number) ?? null, lines, totals: calcTotals(lines, rounding) };
};

const DOC_SELECT = `SELECT d.*, c.name AS client_name, c.honorific AS client_honorific FROM documents d JOIN clients c ON c.id = d.client_id`;

function linesOf(db: Database.Database, ids: number[]): Map<number, Line[]> {
  const m = new Map<number, Line[]>(ids.map((i) => [i, []]));
  if (!ids.length) return m;
  const rows = db.prepare(`SELECT * FROM document_lines WHERE document_id IN (${ids.map(() => "?").join(",")}) ORDER BY document_id, position`).all(...ids) as DocRow[];
  for (const r of rows) m.get(r.document_id as number)!.push({ description: r.description as string, quantity: r.quantity as number,
    unit: r.unit as string, unitPrice: r.unit_price as number, taxRate: r.tax_rate as TaxRate });
  return m;
}

export function getDocument(db: Database.Database, id: number): Doc | null {
  const r = db.prepare(`${DOC_SELECT} WHERE d.id = ?`).get(id) as DocRow | undefined;
  return r ? toDoc(r, linesOf(db, [id]).get(id)!) : null;
}

export type ListFilter = { q?: string; kind?: Kind | ""; status?: Status | "" };
export function listDocuments(db: Database.Database, f: ListFilter = {}): Doc[] {
  const where: string[] = [], args: unknown[] = [];
  if (f.q) { where.push("(d.number LIKE ? OR d.subject LIKE ? OR c.name LIKE ?)"); args.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`); }
  if (f.kind) { where.push("d.kind = ?"); args.push(f.kind); }
  if (f.status) { where.push("d.status = ?"); args.push(f.status); }
  const rows = db.prepare(`${DOC_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY d.issue_date DESC, d.id DESC`).all(...args) as DocRow[];
  const lines = linesOf(db, rows.map((r) => r.id as number));
  return rows.map((r) => toDoc(r, lines.get(r.id as number)!));
}
