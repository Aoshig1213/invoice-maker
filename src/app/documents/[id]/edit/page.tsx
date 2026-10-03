import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentForm } from "@/components/DocumentForm";
import { getDb } from "@/lib/db";
import { KIND_LABEL, getDocument, getSettings, listClients } from "@/lib/repo";

export default async function EditDocumentPage({ params }: PageProps<"/documents/[id]/edit">) {
  const db = getDb();
  const doc = getDocument(db, Number((await params).id));
  if (!doc) notFound();
  if (doc.status !== "draft") {
    return <div className="card">発行済みの書類は編集できません。<Link href={`/documents/${doc.id}`}>書類に戻る</Link></div>;
  }
  return (
    <>
      <h1>{KIND_LABEL[doc.kind]} {doc.number} を編集</h1>
      <DocumentForm clients={listClients(db)} rounding={getSettings(db).rounding}
        initial={{ id: doc.id, kind: doc.kind, clientId: doc.clientId, issueDate: doc.issueDate, dueDate: doc.dueDate, subject: doc.subject, notes: doc.notes, lines: doc.lines }} />
    </>
  );
}
