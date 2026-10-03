import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDocumentAction, invoiceFromQuoteAction, setStatusAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { DocumentPaper } from "@/components/DocumentPaper";
import { getDb } from "@/lib/db";
import { KIND_LABEL, STATUS_LABEL, getDocument, listDocuments } from "@/lib/repo";

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const doc = getDocument(getDb(), Number((await params).id));
  if (!doc) notFound();
  const fromQuote = doc.sourceQuoteId ? getDocument(getDb(), doc.sourceQuoteId) : null;
  const invoices = doc.kind === "quote" ? listDocuments(getDb()).filter((d) => d.sourceQuoteId === doc.id) : [];

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{KIND_LABEL[doc.kind]} {doc.number}</h1>
        <span className={`badge ${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
        <div className="spacer" />
        <Link className="btn" href={`/documents/${doc.id}/print`} target="_blank">印刷・PDF</Link>
        {doc.status === "draft" && <Link className="btn" href={`/documents/${doc.id}/edit`}>編集</Link>}
        {doc.status === "draft" && <ActionButton action={setStatusAction} fields={{ id: doc.id, status: "issued" }} label="発行済みにする" className="btn primary"
          confirm="発行済みにすると編集できなくなります。よろしいですか？" />}
        {doc.status === "issued" && doc.kind === "invoice" && <ActionButton action={setStatusAction} fields={{ id: doc.id, status: "paid" }} label="入金済みにする" className="btn primary" />}
        {doc.status === "issued" && <ActionButton action={setStatusAction} fields={{ id: doc.id, status: "draft" }} label="下書きに戻す" confirm="下書きに戻すと、内容を編集できるようになります。よろしいですか？" />}
        {doc.status === "paid" && <ActionButton action={setStatusAction} fields={{ id: doc.id, status: "issued" }} label="入金済みを取り消す" />}
        {doc.kind === "quote" && <ActionButton action={invoiceFromQuoteAction} fields={{ id: doc.id }} label="この見積書から請求書を作る" />}
        {doc.status === "draft" && <ActionButton action={deleteDocumentAction} fields={{ id: doc.id }} label="削除" className="btn danger" confirm="この下書きを削除します。よろしいですか？" />}
      </div>
      {(fromQuote || invoices.length > 0) && (
        <div className="card no-print" style={{ marginBottom: 12, padding: 12 }}>
          {fromQuote && <>元の見積書：<Link href={`/documents/${fromQuote.id}`}>{fromQuote.number}</Link></>}
          {invoices.length > 0 && <>この見積書から作った請求書：{invoices.map((i) => <Link key={i.id} href={`/documents/${i.id}`} style={{ marginRight: 10 }}>{i.number}</Link>)}</>}
        </div>
      )}
      <DocumentPaper doc={doc} />
    </>
  );
}
