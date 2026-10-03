import { SettingsForm } from "@/components/SimpleForms";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/repo";

export default function SettingsPage() {
  return (
    <>
      <h1>自社情報</h1>
      <p className="muted">書類に載せる自社の情報です。変更は、これから作る書類と下書きに反映されます（発行済みの書類は変わりません）。</p>
      <SettingsForm s={getSettings(getDb())} />
    </>
  );
}
