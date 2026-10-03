import { notFound } from "next/navigation";
import { ClientForm } from "@/components/SimpleForms";
import { getDb } from "@/lib/db";
import { getClient } from "@/lib/repo";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const c = getClient(getDb(), Number((await params).id));
  if (!c) notFound();
  return (
    <>
      <h1>取引先を編集</h1>
      <ClientForm c={c} />
    </>
  );
}
