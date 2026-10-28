import { formatAmount } from "@/lib/money";

/** 合計列：`NT$` 與金額不可斷行，金額下方雙底線。 */
export function TotalLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="total">
      <span className="lab">{label}</span>
      <span className="amt">
        <span className="cur">NT$</span>
        {formatAmount(amount)}
      </span>
    </div>
  );
}
