import { Block } from "@/components/paper/Block";
import type { ReconView } from "@/lib/domain/recon";
import { formatSigned } from "@/lib/money";

/** Per-account book vs statement from each account's latest reconciliation, with the total difference. */
export function ReconTable({ recon }: { recon: ReconView }) {
  return (
    <Block label="帳戶">
      <table className="ledger">
        <caption className="sr">帳戶對帳（各帳戶最近一次對帳的數字）</caption>
        <colgroup>
          <col style={{ width: 62 }} />
          <col />
          <col />
          <col style={{ width: 58 }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">帳戶</th>
            <th scope="col" className="n">
              帳面
            </th>
            <th scope="col" className="n">
              帳單
            </th>
            <th scope="col" className="n">
              差
            </th>
          </tr>
        </thead>
        <tbody>
          {recon.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td className="n">{formatSigned(r.book)}</td>
              <td className="n">{r.statement === null ? "—" : formatSigned(r.statement)}</td>
              {r.matched === null ? (
                <td className="n dim">未對帳</td>
              ) : r.matched ? (
                <td className="n ok">對上</td>
              ) : (
                <td className="n bad">{formatSigned(r.diff ?? 0)}</td>
              )}
            </tr>
          ))}
          <tr className="sum">
            <td colSpan={3}>差合計</td>
            {recon.totalDiff === 0 ? <td className="n ok">對上</td> : <td className="n bad">{formatSigned(recon.totalDiff)}</td>}
          </tr>
        </tbody>
      </table>
    </Block>
  );
}
