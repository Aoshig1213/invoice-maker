import Link from "next/link";
import { DocumentForm } from "@/components/DocumentForm";
import { getDb } from "@/lib/db";
import { KIND_LABEL, getSettings, listClients, type Kind } from "@/lib/repo";

export default async function NewDocumentPage({ searchParams }: PageProps<"/documents/new">) {
  const kind: Kind = (await searchParams).kind === "invoice" ? "invoice" : "quote";
  const db = getDb();
  const clients = listClients(db);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  return (
    <>
      <h1>{KIND_LABEL[kind]}を作る</h1>
      {clients.length === 0 ? (
        <div className="card">先に取引先を登録してください。<Link href="/clients/new">取引先を登録する</Link></div>
      ) : (
        <DocumentForm clients={clients} rounding={getSettings(db).rounding}
          initial={{ kind, issueDate: today, dueDate: "", subject: "", notes: "", lines: [] }} />
      )}
    </>
  );
}
