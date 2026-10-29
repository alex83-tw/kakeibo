import Link from "next/link";
import type { ReconView } from "@/lib/domain/recon";
import { formatSigned } from "@/lib/money";

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/**
 * 一個帳戶一行：帳簿餘額｜實際餘額｜差額｜對帳日，取各帳戶最近一次對帳的數字。
 * 差額為零用青緑「對上」，不為零用朱色數字；兩者都有字，不靠顏色。
 * linkAccounts：帳戶名稱連到下方的輸入單並選好該帳戶。
 */
export function ReconTable({ recon, linkAccounts = false }: { recon: ReconView; linkAccounts?: boolean }) {
  return (
    <table className="rt rc">
      <caption className="sr">帳戶對帳（各帳戶最近一次對帳的數字）</caption>
      <thead>
        <tr>
          <th scope="col">帳戶</th>
          <th scope="col" className="n">帳簿</th>
          <th scope="col" className="n">實際</th>
          <th scope="col" className="n">差額</th>
          <th scope="col" className="n">日期</th>
        </tr>
      </thead>
      <tbody>
        {recon.rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="empty">
              還沒有帳戶，<Link href="/settings/accounts">先到設定建立</Link>。
            </td>
          </tr>
        ) : null}
        {recon.rows.map((r) => (
          <tr key={r.id}>
            <th scope="row">
              {linkAccounts ? (
                <Link className="rc-name" href={`/settings/accounts?a=${r.id}#recon-form`}>
                  {r.name}
                  <span className="sr">：輸入實際餘額</span>
                </Link>
              ) : (
                r.name
              )}
            </th>
            <td className="n">{formatSigned(r.book)}</td>
            <td className="n">{r.statement === null ? "—" : formatSigned(r.statement)}</td>
            {r.matched === null ? (
              <td className="n dim">未對帳</td>
            ) : r.matched ? (
              <td className="n ok">對上</td>
            ) : (
              <td className="n bad">{formatSigned(r.diff ?? 0)}</td>
            )}
            <td className="n dim">{r.date ? shortDate(r.date) : "—"}</td>
          </tr>
        ))}
        {recon.rows.length > 0 ? (
          <tr className="sum">
            <td colSpan={3}>差額合計</td>
            {recon.totalDiff === 0 ? <td className="n ok">對上</td> : <td className="n bad">{formatSigned(recon.totalDiff)}</td>}
            <td />
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
