import Link from "next/link";
import { Head } from "@/components/paper/Head";
import { Run } from "@/components/paper/Run";
import { getUserId } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/repos/accounts";
import { createServerClient } from "@/lib/server/supabase";

export default async function SettingsPage() {
  const userId = await getUserId();
  const client = await createServerClient();
  const accounts = await listAccounts(client, userId);
  const rows: { href: string; label: string; note: string }[] = [
    { href: "/settings/categories", label: "科目", note: "改名・合併" },
    { href: "/settings/accounts", label: "帳戶・對帳", note: accounts.filter((a) => !a.archived).length > 0 ? `${accounts.filter((a) => !a.archived).length} 個` : "尚未建立" },
    { href: "/settings/recurring", label: "週期帳目", note: "每月固定的收支" },
    { href: "/settings/rules", label: "自動分類", note: "關鍵字對應科目" },
    { href: "/settings/rates", label: "匯率", note: "USD・JPY 換算台幣" },
    { href: "/settings/import-export", label: "匯入・匯出", note: "CSV・信用卡明細" },
  ];
  return (
    <>
      <Run label="設定" />
      <Head title="設定" />
      <nav className="menu" aria-label="設定項目">
          {rows.map((r) => (
            <Link key={r.href} href={r.href}>
              <span>{r.label}</span>
              <span>{r.note}</span>
            </Link>
          ))}
      </nav>
    </>
  );
}
