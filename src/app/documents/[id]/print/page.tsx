import { notFound } from "next/navigation";
import { DocumentPaper } from "@/components/DocumentPaper";
import { PrintButton } from "@/components/PrintButton";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/repo";

export default async function PrintPage({ params }: PageProps<"/documents/[id]/print">) {
  const doc = getDocument(getDb(), Number((await params).id));
  if (!doc) notFound();
  return (
    <>
      <div className="row no-print" style={{ marginBottom: 12, justifyContent: "center" }}>
        <PrintButton />
        <span className="muted">印刷画面で「PDFに保存」を選ぶと、PDFにできます</span>
      </div>
      <DocumentPaper doc={doc} />
    </>
  );
}
